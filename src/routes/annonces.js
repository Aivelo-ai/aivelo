const express = require('express');
const { genererAnnonce } = require('../agents/annoncesAgent');

const router = express.Router();

router.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== process.env.API_SECRET_KEY) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
});

router.post('/', async (req, res) => {
  try {
    const { type_bien, ville, surface, prix, points_forts } = req.body;

    if (!type_bien || !ville) {
      return res.status(400).json({
        error: 'Champs obligatoires manquants',
        required: ['type_bien', 'ville'],
      });
    }

    const result = await genererAnnonce({ type_bien, ville, surface, prix, points_forts });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[annonces] Erreur :', err.message);
    return res.status(500).json({
      error: 'Erreur lors de la génération',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

module.exports = router;
