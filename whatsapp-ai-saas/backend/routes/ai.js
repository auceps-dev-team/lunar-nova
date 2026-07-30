const express = require('express');
const { z } = require('zod');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const aiController = require('../aiController');
const crypto = require('crypto');
const { logCopilotInteraction } = require('../db');
const { getCachedProposals, setCachedProposals } = require('../redisClient');

// Rate Limiter for AI endpoints
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

router.post('/ai/models', aiLimiter, async (req, res) => {
    try {
        const provider = req.body.provider;
        const apiKey = req.body.apiKey;
        const models = await aiController.listModels(provider, apiKey);
        res.json({ status: 'success', models });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint to test model / API key connection (Soft Validation)
router.post('/test-model', aiLimiter, async (req, res) => {
    // `model` n'est pas utilisé : le test valide la clé et l'accès au
    // fournisseur en listant ses modèles, pas la disponibilité d'un modèle précis.
    const { provider, apiKey } = req.body;
    try {
        const models = await aiController.listModels(provider, apiKey);
        if (models && (Array.isArray(models) ? models.length > 0 : (models.chat && models.chat.length > 0))) {
            res.json({ status: 'success', message: 'API connection successful' });
        } else {
            res.json({ status: 'warning', message: 'API connection successful but no models returned' });
        }
    } catch (err) {
        // Soft validation: return warning instead of 500 error
        res.json({ status: 'warning', message: 'API connection failed: ' + err.message });
    }
});

// Debug: return nvidia model definition (hot-loaded)
router.get('/debug/nvidia-model', aiLimiter, async (req, res) => {
    try {
        const id = req.query.id;
        try { delete require.cache[require.resolve('../nvidiaModels')]; } catch {}
        const nm = require('../nvidiaModels');
        const def = nm.getModelDef(id);
        res.json({ status: 'success', model: def });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

// Endpoint to fetch Copilot Generative Replies
router.post('/ai/copilot', aiLimiter, async (req, res) => {
    // Requires instance_id for DB logging in a multi-tenant environment.
    // Usually passed as part of the request. Let's assume frontend passes it.
    const { instance_id, chatContext, model, provider } = req.body;

    if (!chatContext) {
        return res.status(400).json({ error: 'Missing chat context.' });
    }

    try {
        // Feature: Redis Session Caching
        // Create an MD5 hash of the last 3 messages to use as a cache key.
        // This prevents excessive API billing if user spams the button without new messages.
        const contextFingerprint = chatContext.contactName + '_' +
            chatContext.messages.slice(-3).map(m => m.text).join('|') + '_' + (model || 'gemini-1.5-pro');

        const cacheKey = 'copilot:' + crypto.createHash('md5').update(contextFingerprint).digest('hex');

        const cached = await getCachedProposals(cacheKey);
        if (cached) {
            console.log(`[Cache Hit] Returning cached proposals for ${chatContext.contactName}`);
            return res.json({
                status: 'success',
                cached: true,
                proposals: cached
            });
        }

        // Generate via AI Controller
        console.log(`[Cache Miss] Generating new proposals for ${chatContext.contactName}`);
        const proposalsObj = await aiController.generateProposals(chatContext, model, provider);
        const proposals = proposalsObj.proposed_replies || [];
        
        // Obtenir le provider depuis la réponse ou utiliser les valeurs par défaut
        const usedProvider = proposalsObj.provider || provider || 'gemini';
        const usedModel = proposalsObj.model || model || 'gemini-1.5-pro';
        const tokens = proposalsObj.tokens || 0;
        const cost = proposalsObj.cost || 0.0;
        const status = proposalsObj.status || 'success';

        // Cache for 60 seconds
        await setCachedProposals(cacheKey, proposals, 60);

        // Feature: Audit Logging
        // Asynchronously log the transaction for analytics and security
        logCopilotInteraction(
            instance_id || 'unknown_instance',
            chatContext.contactName,
            chatContext,
            proposals,
            usedProvider,
            usedModel,
            tokens,
            cost,
            status
        );

        res.json({
            status: 'success',
            cached: false,
            proposals: proposals
        });
    } catch (error) {
        console.error('Copilot Route Error:', error);
        res.status(500).json({ error: 'Failed to generate copilot proposals.' });
    }
});

// Schema de validation Zod pour l'agent
const agentSchema = z.object({
    persona: z.string().nullish(),
    message: z.string().nullish(),
    messages: z.array(z.any()).nullish(),
    imageParams: z.object({
        data: z.string(),
        mimeType: z.string()
    }).nullish(),
    attachments: z.array(z.object({
        data: z.string(),
        mimeType: z.string(),
        fileName: z.string().optional()
    })).nullish(),
    promptFormat: z.string().nullish(),
    currentTasks: z.array(z.any()).nullish(),
    isRealTime: z.boolean().nullish(),
    modelOverride: z.string().nullish(),
    provider: z.string().nullish(),
    model: z.string().nullish()
}).refine(data => data.message || (data.messages && data.messages.length > 0), {
    message: "Missing message.",
});

// Endpoint for specialized Persona AI Agents (Legal, Creative)
router.post('/ai/agent', aiLimiter, async (req, res) => {
    try {
        // Validation des inputs avec Zod
        const validatedData = agentSchema.parse(req.body);
        const { persona, message, messages, imageParams, attachments, promptFormat, currentTasks, isRealTime, modelOverride, provider, model } = validatedData;

        // Use provider and model from frontend as overrides
        const finalProvider = provider || null;
        const finalModel = modelOverride || model || null;

        const aiResponse = await aiController.chatWithAgent(persona, message, imageParams, attachments, promptFormat, messages, currentTasks, isRealTime, finalModel, finalProvider);
        res.json({
            status: 'success',
            response: aiResponse.response
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        console.error('Agent Route Error:', error);
        res.status(500).json({ error: 'Failed to chat with agent.' });
    }
});

// Endpoint to generate an image (Gemini, NVIDIA NIM, etc.)
router.post('/ai/generate-image', aiLimiter, async (req, res) => {
    const { prompt, aspectRatio, imageParams, editMode, mode, provider, imageModel } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt.' });
    }

    try {
        const generationResponse = await aiController.generateImage(prompt, aspectRatio, imageParams, editMode, mode, provider || null, imageModel || null);
        if (generationResponse.error) {
            // Retourner 200 avec status 'error' pour que le frontend puisse afficher le message
            return res.json({ status: 'error', error: generationResponse.error });
        }
        res.json({
            status: 'success',
            imageStore: generationResponse.imageBytes
        });
    } catch (error) {
        console.error('Image Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate image via API.' });
    }
});

// La route /api/ai/generate-image-qwen a été retirée en v1.39.1 : aucun appelant
// dans le dépôt, et elle acceptait un paramètre `size` qu'elle n'utilisait pas.
// Pour générer une image avec Qwen, passer par /api/ai/generate-image en
// précisant imageModel: 'qwen/qwen-image'.
module.exports = router;
