// Génération de recettes par IA (facultative). L'IA ne choisit que parmi les ingrédients autorisés (vocabulaire fermé),
// sa sortie est structurée puis REVALIDÉE par les règles de l'app (temps par catégorie, ingrédients connus, quantités).
// Aucune donnée personnelle n'est envoyée : seulement des identifiants d'ingrédients autorisés et des consignes.
import { INGREDIENTS, GROUPS } from '../shared/ingredients.js';
import { CATEGORIES, EQUIPMENT, MEALS, validateRecipe } from '../shared/recipes.js';
import { uid } from '../shared/util.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

export const buildPrompt = ({ meal = 'souper', cat = 'express', prefer = [], allowed = null, timeMax = null }) => {
  const ids = (allowed?.length ? allowed : Object.keys(INGREDIENTS)).filter((id) => INGREDIENTS[id]);
  const vocab = ids.map((id) => `${id} (${INGREDIENTS[id].name}, ${INGREDIENTS[id].unit})`).join('; ');
  const catInfo = CATEGORIES[cat];
  return {
    system:
      'Tu es un cuisinier belge pragmatique. Tu crées UNE recette en français, pour UNE personne adulte d’appétit normal (portion de référence). ' +
      'Réponds uniquement par un objet JSON, sans texte autour. Utilise exclusivement les identifiants d’ingrédients de la liste fournie. ' +
      'Quantités dans l’unité de l’ingrédient (g, ml ou pièces). Les basiques (sel, poivre, huile, épices, ail, oignon…) sont autorisés en petites quantités.',
    user:
      `Repas : ${MEALS[meal]?.label ?? meal}. Catégorie : ${catInfo?.label ?? cat} (${catInfo?.hint ?? ''}). ` +
      (catInfo?.maxTotal ? `Temps total (préparation + cuisson) ≤ ${catInfo.maxTotal} min. ` : '') +
      (timeMax ? `Temps total ≤ ${timeMax} min. ` : '') +
      (prefer.length ? `Construis la recette autour de : ${prefer.join(', ')}. ` : '') +
      `\nIngrédients autorisés : ${vocab}.\nMatériel possible : ${Object.keys(EQUIPMENT).join(', ')}.` +
      '\nFormat JSON : {"name":"","emoji":"","prep":0,"cook":0,"diff":"facile|moyen","eq":["plaques"],' +
      '"ing":[{"id":"","q":0,"opt":false}],"steps":[{"t":"texte","timer":0}],"keep":"conservation des restes"}',
  };
};

const extractJson = (text) => {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('réponse sans JSON');
  return JSON.parse(m[0]);
};

/** Convertit la sortie de l’IA en recette de l’app et la valide. Lève une erreur détaillée si elle est incohérente. */
export const toRecipe = (raw, { meal = 'souper', cat = 'express', allowed = null } = {}) => {
  const allowedSet = allowed?.length ? new Set(allowed) : null;
  const basics = new Set(Object.values(INGREDIENTS).filter((i) => i.basic).map((i) => i.id));
  const recipe = {
    id: `ia-${uid()}`,
    name: String(raw.name ?? '').slice(0, 80),
    emoji: String(raw.emoji ?? '🍽️').slice(0, 4),
    meals: [meal],
    cat,
    tags: [],
    prep: Number(raw.prep),
    cook: Number(raw.cook),
    diff: raw.diff === 'moyen' ? 'moyen' : 'facile',
    eq: (raw.eq ?? ['plaques']).filter((k) => EQUIPMENT[k]),
    ing: (raw.ing ?? []).map((l) => [String(l.id), Number(l.q), l.opt ? { opt: true } : undefined].filter((x) => x !== undefined)),
    steps: (raw.steps ?? []).map((s) => (s.timer > 0 ? [String(s.t), Number(s.timer)] : String(s.t))),
    keep: String(raw.keep ?? '2 jours au frigo'),
    batch: 1,
    source: 'ia',
  };
  const errs = validateRecipe(recipe);
  if (allowedSet) for (const [id] of recipe.ing) if (!allowedSet.has(id) && !basics.has(id)) errs.push(`ingrédient non autorisé: ${id}`);
  if (errs.length) throw new Error(errs.join(' ; '));
  return recipe;
};

export async function generateRecipe(request, fetchImpl = fetch) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Clé ANTHROPIC_API_KEY absente : la génération par IA est désactivée.');
  const { system, user } = buildPrompt(request);
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`API Anthropic : HTTP ${res.status}`);
  const body = await res.json();
  const text = (body.content ?? []).map((c) => c.text ?? '').join('');
  return toRecipe(extractJson(text), request);
}

export { GROUPS };
