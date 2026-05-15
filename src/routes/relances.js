const express = require('express');
const { traiterRelances, genererEmailRelance } = require('../agents/relancesAgent');

const router = express.Router();

router.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== process.env.API_SECRET_KEY) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
});

// POST /api/relances/run — déclenche manuellement le cron
router.post('/run', async (req, res) => {
  try {
    console.log('[relances] Déclenchement manuel...');
    const resultats = await traiterRelances();
    return res.json({ success: true, resultats });
  } catch (err) {
    console.error('[relances] Erreur :', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/relances/preview — prévisualise un email pour un lead
router.post('/preview', async (req, res) => {
  try {
    const { lead, type } = req.body;
    if (!lead || !type) return res.status(400).json({ error: 'lead et type requis' });
    const email = await genererEmailRelance(lead, type);
    return res.json({ success: true, data: email });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', agent: 'relances', timestamp: new Date().toISOString() });
});

module.exports = router;
