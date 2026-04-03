const express = require('express');
const router = express.Router();

// Memory store for auth payloads, keyed by random session_id from client
const oauthSessions = {};

router.get('/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) return res.send('Missing code or state parameters from Google.');

    try {
        // Exchange code for token
        const fetch = (await import('node-fetch')).default;
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.VITE_GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                code,
                redirect_uri: 'http://localhost:3000/api/auth/google/callback',
                grant_type: 'authorization_code'
            })
        });

        const tokenData = await tokenResponse.json();
        
        if (!tokenData.access_token) {
            console.error('Google Token error:', tokenData);
            return res.send(`<h2>Erreur Authentification</h2><p>${JSON.stringify(tokenData)}</p>`);
        }

        // Fetch User Info using the new token
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const userInfo = await userResponse.json();

        // Map it into state so Desktop polling can grab it
        oauthSessions[state] = userInfo;

        res.send(`
            <html>
            <head>
                <style>
                    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f9fafb; margin: 0; }
                    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center; }
                    h2 { color: #10b981; margin-top: 0; }
                    p { color: #6b7280; }
                    .spinner { margin: 20px auto; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #10b981; border-radius: 50%; animation: spin 1s linear infinite; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="spinner"></div>
                    <h2>Connexion Réussie !</h2>
                    <p>Vos informations ont bien été transmises à Lunar Nova.</p>
                    <p>Vous pouvez fermer cette page et retourner à l'application.</p>
                </div>
                <script>
                    setTimeout(() => window.close(), 3000);
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Google Auth Loopback Error:', err);
        res.status(500).send('OAuth Handling Error');
    }
});

router.get('/status', (req, res) => {
    const { session_id } = req.query;
    if (oauthSessions[session_id]) {
        res.json({ status: 'success', data: oauthSessions[session_id] });
        // Clean up to prevent memory leak
        delete oauthSessions[session_id];
    } else {
        res.json({ status: 'pending' });
    }
});

module.exports = router;
