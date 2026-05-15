const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('../lib/supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es un expert en rédaction d'annonces immobilières françaises professionnelles.
Tu génères des annonces adaptées aux plateformes SeLoger, LeBonCoin et Bien'ici.

Règles :
- Ton professionnel, accrocheur et vendeur
- Maximum 300 mots
- Structure : accroche percutante, description du bien, points forts, informations pratiques
- Adapté au marché immobilier français
- Jamais de fautes d'orthographe

Réponds UNIQUEMENT avec le texte de l'annonce, sans titre, sans balises, sans commentaire.`;

async function genererAnnonce(data) {
  const { type_bien, surface, ville, prix, points_forts } = data;

  const userMessage = `
Génère une annonce immobilière professionnelle pour :
Type de bien : ${type_bien}
Surface : ${surface ? surface + ' m²' : 'Non précisé'}
Ville : ${ville}
Prix : ${prix ? prix + ' €' : 'Non précisé'}
Points forts : ${points_forts || 'Non précisé'}
  `.trim();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const texte_annonce = response.content[0].text.trim();

  const { data: annonce, error } = await supabase
    .from('annonces')
    .insert({
      type_bien,
      surface:       surface ?? null,
      ville,
      prix: prix ? parseFloat(prix.toString().replace(/[^0-9.]/g, '')) : null,
      points_forts:  points_forts ? [points_forts] : [],
      texte_annonce,
      generated_at:  new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Erreur Supabase : ${error.message}`);

  return {
    annonce_id:   annonce.id,
    texte_annonce,
    tokens_used:  response.usage.input_tokens + response.usage.output_tokens,
  };
}

module.exports = { genererAnnonce };
