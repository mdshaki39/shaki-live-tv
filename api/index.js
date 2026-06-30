// Vercel serverless entry point.
// Vercel treats any module that exports an Express app (a callable
// (req, res) handler) as a valid serverless function — no extra wrapping
// needed. All requests to /api/* are routed here (see vercel.json).
module.exports = require('../server.js');
