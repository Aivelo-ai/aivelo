const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('../lib/supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es un expert en matching immobilier pour agences françaises.
On te donne un bien à vendre et une liste d'acheteurs qualifiés.
Tu dois retourner les 3 meilleurs matchs en JSON valide avec exactement cette structure :
{
  "matches": [
    {
      "lead_id": <string>,
      "nom": <string>,
      "score_match": <entier 0-100>,
      "raison": <string, 1 phrase max, très concrète ex: "Budget compatible, cherche T3 à Lyon, projet immédiat">,
      "points_forts": [<string>, <string>],
      "alerte": <string ou null, ex: "Budget légèrement en dessous du prix affiché">
    }
  ]
}

Critères de matching (total max = 100) :
- Budget lead compatible avec prix bien  → jusqu'à +40 pts (budget >= 90% du prix = parfait)
- Type de bien recherché correspond       → jusqu'à +25 pts
- Ville / zone géographique compatible    → jusqu'à +20 pts
- Délai d'achat court (< 3 mois)         → jusqu'à +15 pts

Si moins de 3 leads fournis, retourne seulement ceux disponibles.
Ne réponds qu'avec le JSON, sans markdown, sans commentaire.`;

async function matcherCandidats(bienId, agencyId) {
  // 1. Récupérer le bien
  const { data: bien, error: bienError } = await supabase
    .from('biens')
    .select('*')
    .eq('id', bienId)
    .eq('agency_id', agencyId)
    .single();

  if (bienError || !bien) throw new Error('Bien introuvable');

  // 2. Récupérer tous les leads acheteurs de l'agence
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, nom, projet, budget, delai, financement, score, statut, email, telephone, resume')
    .eq('agency_id', agencyId)
    .in('statut', ['chaud', 'tiede']) // on ignore les leads froids
    .order('score', { ascending: false });

  if (leadsError) throw new Error(`Erreur Supabase leads : ${leadsError.message}`);
  if (!leads || leads.length === 0) return { matches: [], bien };

  // 3. Construire le prompt
  const bienDesc = `
BIEN À VENDRE :
- Référence : ${bien.reference}
- Type : ${bien.type_bien}
- Adresse : ${bien.adresse || '—'}, ${bien.ville}
- Surface : ${bien.surface ? bien.surface + ' m²' : 'NC'}
- Prix : ${bien.prix ? bien.prix.toLocaleString('fr-FR') + ' €' : 'NC'}
- Statut : ${bien.statut}
`.trim();

  const leadsDesc = leads.map((l, i) => `
ACHETEUR ${i + 1} :
- ID : ${l.id}
- Nom : ${l.nom}
- Projet : ${l.projet || 'NC'}
- Budget : ${l.budget ? l.budget.toLocaleString('fr-FR') + ' €' : 'NC'}
- Délai : ${l.delai || 'NC'}
- Financement : ${l.financement || 'NC'}
- Score qualification : ${l.score}/100 (${l.statut})
- Résumé : ${l.resume || 'NC'}
`).join('\n');

  const userMessage = `${bienDesc}\n\nLISTE DES ACHETEURS QUALIFIÉS :\n${leadsDesc}\n\nRetourne les 3 meilleurs matchs pour ce bien.`;

  // 4. Appel Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const rawText = response.content[0].text.trim();
  let result;
  try {
    result = JSON.parse(rawText);
  } catch {
    throw new Error(`Réponse Claude non parseable : ${rawText}`);
  }

  // 5. Enrichir les matches avec les données complètes du lead
  const matchesEnrichis = result.matches.map(match => {
    const lead = leads.find(l => l.id === match.lead_id);
    return {
      ...match,
      email: lead?.email || null,
      telephone: lead?.telephone || null,
      statut: lead?.statut || null,
      score_qualification: lead?.score || null,
    };
  });

  return {
    bien,
    matches: matchesEnrichis,
    tokens_used: response.usage.input_tokens + response.usage.output_tokens,
  };
}

module.exports = { matcherCandidats };
