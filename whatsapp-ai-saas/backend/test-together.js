/**
 * test-together.js — Test de l'intégration Together AI / Qwen-Image
 * Usage : node backend/test-together.js
 */
require('dotenv').config({ path: __dirname + '/.env' });

const openaiService = require(__dirname + '/openaiService');

const apiKey = process.env.TOGETHER_API_KEY;
console.log('Together AI key present:', !!apiKey, '| prefix:', apiKey?.slice(0, 20) + '...');

if (!apiKey) {
    console.error('TOGETHER_API_KEY manquante dans backend/.env');
    process.exit(1);
}

console.log('\n→ Appel Together AI /images/generations avec Qwen/Qwen-Image...\n');

openaiService.analyzeOrEditImage(
    'A photorealistic fashion model wearing a red silk dress in a white studio, soft lighting',
    null,
    apiKey,
    'https://integrate.api.nvidia.com/v1',   // baseURL ignoré pour qwen (Together AI override)
    'qwen/qwen-image'
).then(res => {
    if (res.error) {
        console.error('❌ ERROR:', res.error);
    } else {
        console.log('✅ SUCCESS!');
        console.log('   imageBytes length:', (res.imageBytes || '').length, 'chars (base64)');
        console.log('   First 80 chars:', (res.imageBytes || '').slice(0, 80));
    }
}).catch(err => {
    console.error('❌ EXCEPTION:', err.message);
    if (err.response) {
        console.error('   HTTP Status:', err.response.status);
        console.error('   Response:', JSON.stringify(err.response.data).slice(0, 500));
    }
});
