const express = require('express');
const { qualifierLead } = require('../agents/qualificationAgent');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { nom, projet, budget, delai, financement } = req.body;

    if (!nom || !projet) {
      return res.status(400).json({
        error: 'Champs obligatoires manquants',
        required: ['nom', 'projet'],
      });
    }

    const result = await qualifierLead({ nom, projet, budget, delai, financement });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[qualify] Erreur :', err.message);
    return res.status(500).json({
      error: 'Erreur lors de la qualification',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', agent: 'qualification', timestamp: new Date().toISOString() });
});

module.exports = router;
