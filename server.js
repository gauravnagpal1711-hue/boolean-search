/* ──────────────────────────────────────────────────────────────
   GetWork Recruiter Support Hub — backend server
   - Serves the static pages from the repo root (same folder as server.js)
   - /api/claude   : proxies requests to the Anthropic Messages API
   - /api/fetch-jd : fetches a GetWork JD page server-side (avoids CORS)
   Node 18+ required (uses built-in fetch).
   ────────────────────────────────────────────────────────────── */
const express = require('express');
const path = require('path');

const app = express();

/* Generous body limit: the chatbot sends the full playbook + multi-turn history */
app.use(express.json({ limit: '4mb' }));

/* Serve all HTML files placed in the /public folder */
app.use(express.static(__dirname));  // serves index.html and the other pages from the repo root

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/* ── Proxy to Anthropic Messages API ──
   Forwards the ENTIRE request body (model, max_tokens, messages, system, ...)
   so single-shot tools and the multi-turn chatbot both work unchanged. */
app.post('/api/claude', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY is not set on the server.' } });
    }
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    const data = await upstream.json();
    /* Always return JSON with the upstream status so the frontend never
       receives an HTML error page (the cause of the earlier chatbot error). */
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

/* ── Fetch a GetWork JD page server-side (browsers block cross-origin fetch) ── */
app.post('/api/fetch-jd', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'No URL provided.' });
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GetWorkBot/1.0)' } });
    const html = await r.text();
    return res.json({ html });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* Health check */
app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GetWork Recruiter Hub running on port ${PORT}`));
