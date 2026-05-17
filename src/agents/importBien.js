const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const API_SECRET = process.env.API_SECRET_KEY || 'aivelo-2026-ArthurS-immo';

const SYSTEM_PROMPT = `Tu es un expert immobilier français. Analyse le contenu fourni et extrais toutes les informations disponibles sur le bien immobilier.
Réponds UNIQUEMENT en JSON valide sans markdown ni commentaire, avec les champs disponibles parmi :
{
  "type_bien": "", "pieces": "", "surface": "", "surface_carrez": "", "prix": "", "net_vendeur": "",
  "dpe": "", "ges": "", "adresse": "", "ville": "",
  "proprio_nom": "", "etage": "", "ascenseur": "", "exposition": "", "annee_construction": "",
  "balcon": "", "cave": "", "parking": "", "taxe_fonciere": "",
  "residence": "", "numero_lot": "", "charges_copro": "", "nb_lots": "", "syndic": "",
  "mandat_type": "", "mandat_num": "", "mandat_debut": "", "mandat_fin": "", "mandat_honoraires": "",
  "mandat_charge": "", "mandat_reconduction": "", "carte_pro": "", "garantie_fin": "", "parcelle_cadastrale": ""
}
N'inclus que les champs trouvés. Laisse vide si non trouvé. Réponds uniquement avec le JSON.`;

router.post('/', async (req, res) => {
  if (req.headers['x-api-key'] !== API_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const { texte, image_base64, image_type } = req.body;

  if (!texte && !image_base64) {
    return res.status(400).json({ error: 'texte ou image_base64 requis' });
  }

  try {
    let messages;

    if (image_base64) {
      messages = [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: image_type || 'image/jpeg', data: image_base64 }
          },
          { type: 'text', text: 'Extrais toutes les informations immobilières de ce document.' }
        ]
      }];
    } else {
      messages = [{
        role: 'user',
        content: `Extrais les informations immobilières de ce contenu :\n\n${texte}`
      }];
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages
    });

    const rawText = response.content[0].text.trim();
    let data;
    try {
      data = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Réponse Claude non parseable', raw: rawText });
    }

    return res.json({ success: true, data, tokens_used: response.usage.input_tokens + response.usage.output_tokens });

  } catch (err) {
    console.error('[ImportBien] Erreur :', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
