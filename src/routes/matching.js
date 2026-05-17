const express = require('express');
const router = express.Router();
const { matcherCandidats } = require('../agents/matchingAgent');

const API_SECRET = process.env.API_SECRET_KEY || 'aivelo-2026-ArthurS-immo';

router.post('/', async (req, res) => {
  if (req.headers['x-api-key'] !== API_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  const { bien_id, agency_id } = req.body;
  if (!bien_id || !agency_id) {
    return res.status(400).json({ error: 'bien_id et agency_id requis' });
  }
  try {
    const result = await matcherCandidats(bien_id, agency_id);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Matching] Erreur :', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
