const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('../lib/supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPTS = {
  j1: (lead) => `Tu es un agent immobilier expert en relation client.
Rédige un email de relance chaleureux et professionnel pour ce prospect qui n'a pas répondu depuis 24h.
Ton : chaleureux, humain, pas de pression.
Lead : ${lead.nom} — Projet : ${lead.projet} — Budget : ${lead.budget ? lead.budget + '€' : 'non précisé'}
Réponds UNIQUEMENT avec le contenu de l'email, sans objet, sans balises.`,

  j7: (lead) => `Tu es un agent immobilier expert en relation client.
Rédige un email de relance informatif pour ce prospect sans réponse depuis 7 jours.
Ton : informatif, apporte de la valeur (marché, opportunités), pas de pression.
Lead : ${lead.nom} — Projet : ${lead.projet} — Budget : ${lead.budget ? lead.budget + '€' : 'non précisé'}
Réponds UNIQUEMENT avec le contenu de l'email, sans objet, sans balises.`,

  j14: (lead) => `Tu es un agent immobilier expert en relation client.
Rédige un dernier email de relance direct pour ce prospect sans réponse depuis 14 jours.
Ton : direct, dernière tentative, laisse la porte ouverte.
Lead : ${lead.nom} — Projet : ${lead.projet} — Budget : ${lead.budget ? lead.budget + '€' : 'non précisé'}
Réponds UNIQUEMENT avec le contenu de l'email, sans objet, sans balises.`,
};

const OBJETS = {
  j1: (nom) => `Votre projet immobilier — ${nom}`,
  j7: (nom) => `Les opportunités du marché pour votre projet — ${nom}`,
  j14: (nom) => `Dernière chance de concrétiser votre projet — ${nom}`,
};

async function genererEmailRelance(lead, type) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: PROMPTS[type](lead) }],
  });
  return {
    objet: OBJETS[type](lead.nom),
    contenu: response.content[0].text.trim(),
  };
}

async function traiterRelances() {
  const now = new Date();
  const resultats = { j1: 0, j7: 0, j14: 0, erreurs: 0 };

  const delais = [
    { type: 'j1',  champ: 'relance_j1_sent',  jours: 1  },
    { type: 'j7',  champ: 'relance_j7_sent',  jours: 7  },
    { type: 'j14', champ: 'relance_j14_sent', jours: 14 },
  ];

  for (const { type, champ, jours } of delais) {
    const seuil = new Date(now - jours * 24 * 60 * 60 * 1000).toISOString();

    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq(champ, false)
      .in('statut', ['chaud', 'tiede'])
      .lt('dernier_contact', seuil);

    if (error) { console.error(`[relances] Erreur Supabase ${type}:`, error.message); continue; }
    if (!leads?.length) { console.log(`[relances] Aucun lead à relancer en ${type}`); continue; }

    for (const lead of leads) {
      try {
        const { objet, contenu } = await genererEmailRelance(lead, type);

        const { data: relance, error: relErr } = await supabase
          .from('relances')
          .insert({ lead_id: lead.id, type_relance: type, email_contenu: contenu })
          .select().single();

        if (relErr) throw new Error(relErr.message);

        await supabase.from('leads').update({
          [champ]: true,
          dernier_contact: now.toISOString(),
        }).eq('id', lead.id);

        resultats[type]++;
        console.log(`[relances] ${type} envoyé pour ${lead.nom} (simulation — Brevo à connecter)`);
      } catch (err) {
        console.error(`[relances] Erreur pour ${lead.nom}:`, err.message);
        resultats.erreurs++;
      }
    }
  }

  return resultats;
}

module.exports = { traiterRelances, genererEmailRelance };
