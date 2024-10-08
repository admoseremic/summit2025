const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });  // Enable CORS for all origins

// Cloud Function to return the API key securely
exports.getApiKey = functions.https.onRequest((req, res) => {
    cors(req, res, () => {
        const apiKey = functions.config().app.firebaseapikey;
        res.json({ apiKey });
    });
});
