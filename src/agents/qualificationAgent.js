const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('../lib/supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es un expert en qualification de leads pour agences immobilières françaises.
Tu dois TOUJOURS répondre en JSON valide avec exactement cette structure :
{
  "score": <entier entre 0 et 100>,
  "statut": <"chaud" | "tiede" | "froid">,
  "resume": <string, 2-3 phrases max, ton professionnel>,
  "points_cles": [<string>, ...],
  "recommandation": <string, action concrète pour l'agent immobilier>
}

Grille de scoring (total max = 100) :
- Budget défini et réaliste  → jusqu'à +30 pts
- Délai < 3 mois             → jusqu'à +25 pts
- Financement OK             → jusqu'à +25 pts
- Projet précis              → jusqu'à +20 pts

Interprétation :
- 80-100 → chaud : rappel immédiat recommandé
- 40-79  → tiède : relance J+1 automatique
- 0-39   → froid : nurturing long terme

Ne réponds qu'avec le JSON, sans markdown, sans commentaire.`;

async function qualifierLead(leadData) {
  const { nom, projet, budget, delai, financement, agency_id, email, telephone, source } = leadData;

  const userMessage = `
Qualifie ce lead immobilier :
Nom : ${nom}
Projet : ${projet}
Budget : ${budget ? `${budget.toLocaleString('fr-FR')} €` : 'Non précisé'}
Délai souhaité : ${delai || 'Non précisé'}
Financement : ${financement || 'Non précisé'}
  `.trim();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const rawText = response.content[0].text.trim();
  let qualification;
  try {
    qualification = JSON.parse(rawText);
  } catch {
    throw new Error(`Réponse Claude non parseable : ${rawText}`);
  }

  const { score, statut, resume } = qualification;
  if (typeof score !== 'number' || !['chaud', 'tiede', 'froid'].includes(statut)) {
    throw new Error(`Structure JSON invalide : ${rawText}`);
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      agency_id:        agency_id ?? null,
      nom,
      projet,
      budget:           budget ?? null,
      delai:            delai ?? null,
      financement:      financement ?? null,
      email:            email ?? null,
      telephone:        telephone ?? null,
      source:           source ?? null,
      score,
      statut,
      resume,
    })
    .select()
    .single();

  if (error) throw new Error(`Erreur Supabase : ${error.message}`);

  return {
    lead_id:        lead.id,
    score,
    statut,
    resume,
    points_cles:    qualification.points_cles ?? [],
    recommandation: qualification.recommandation ?? '',
    tokens_used:    response.usage.input_tokens + response.usage.output_tokens,
  };
}

module.exports = { qualifierLead };
