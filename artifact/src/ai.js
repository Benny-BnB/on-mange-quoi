// Nouvelles idées de recettes par IA (capacité `sample` de la page : Claude répond sur le compte de la personne qui clique).
// L'IA ne choisit que parmi les ingrédients autorisés pour les personnes à table ; sa réponse est revalidée par les règles de l'app.
import * as St from './store.js';
import { INGREDIENTS } from '/shared/ingredients.js';
import { CATEGORIES, EQUIPMENT, MEALS, validateRecipe } from '/shared/recipes.js';
import { strictViolations, hatedHits } from '/shared/rules.js';
import { uid } from '/shared/util.js';

export const aiAvailable = () => !!St.S.caps.sample;

/** Ingrédients que toutes les personnes présentes peuvent manger (jamais de données personnelles envoyées). */
export const allowedIngredients = (people, settings) =>
  Object.keys(INGREDIENTS).filter((id) => hatedHits([id], { hated: [] }, settings).length === 0 && people.every((p) => strictViolations([id], p).length === 0 && hatedHits([id], p, settings).length === 0));

export const buildPrompt = ({ meal = 'souper', cat = 'express', prefer = [], allowed, timeMax = null }) => {
  const vocab = allowed.map((id) => `${id} (${INGREDIENTS[id].name}, ${INGREDIENTS[id].unit})`).join('; ');
  const info = CATEGORIES[cat];
  return (
    'Tu es un cuisinier belge pragmatique. Crée UNE recette en français pour UNE personne adulte d’appétit normal (portion de référence). ' +
    'Réponds uniquement par un objet JSON. Utilise exclusivement les identifiants d’ingrédients de la liste. Quantités dans l’unité de l’ingrédient (g, ml ou pièces). ' +
    'Les basiques (sel, poivre, huile, épices, ail, oignon) sont autorisés en petites quantités.\n' +
    `Repas : ${MEALS[meal]?.label ?? meal}. Catégorie : ${info?.label ?? cat} (${info?.hint ?? ''}). ` +
    (info?.maxTotal ? `Temps total (préparation + cuisson) ≤ ${info.maxTotal} min. ` : '') +
    (timeMax ? `Temps total ≤ ${timeMax} min. ` : '') +
    (prefer.length ? `Construis la recette autour de : ${prefer.join(', ')}. ` : '') +
    `\nIngrédients autorisés : ${vocab}.\nMatériel possible : ${Object.keys(EQUIPMENT).join(', ')}.` +
    '\nFormat : {"name":"","emoji":"","prep":0,"cook":0,"diff":"facile|moyen","eq":["plaques"],"ing":[{"id":"","q":0,"opt":false}],"steps":[{"t":"texte","timer":0}],"keep":"conservation des restes"}'
  );
};

/** Convertit la réponse de l'IA en recette de l'app et la valide ; lève une erreur détaillée si elle est incohérente. */
export const toRecipe = (raw, { meal = 'souper', cat = 'express', allowed = null } = {}) => {
  const allowedSet = allowed?.length ? new Set(allowed) : null;
  const basics = new Set(Object.values(INGREDIENTS).filter((i) => i.basic).map((i) => i.id));
  const recipe = {
    id: `ia-${uid()}`,
    name: String(raw.name ?? '').slice(0, 80),
    emoji: String(raw.emoji ?? '🍽️').slice(0, 4),
    meals: [meal], cat, tags: [],
    prep: Number(raw.prep), cook: Number(raw.cook),
    diff: raw.diff === 'moyen' ? 'moyen' : 'facile',
    eq: (raw.eq ?? ['plaques']).filter((k) => EQUIPMENT[k]),
    ing: (raw.ing ?? []).map((l) => [String(l.id), Number(l.q), l.opt ? { opt: true } : undefined].filter((x) => x !== undefined)),
    steps: (raw.steps ?? []).map((s) => (s.timer > 0 ? [String(s.t), Number(s.timer)] : String(s.t))),
    keep: String(raw.keep ?? '2 jours au frigo'), batch: 1, source: 'ia',
  };
  const errs = validateRecipe(recipe);
  if (allowedSet) for (const [id] of recipe.ing) if (!allowedSet.has(id) && !basics.has(id)) errs.push(`ingrédient non autorisé: ${id}`);
  if (errs.length) throw new Error(errs.join(' ; '));
  return recipe;
};

/** Demande une recette à Claude. Rejette avec un message lisible. */
export async function askRecipe({ meal, cat, prefer, people, settings, timeMax }) {
  const sample = St.S.caps.sample;
  if (!sample) throw new Error('Claude n’est pas disponible dans cette page.');
  const allowed = allowedIngredients(people, settings);
  let raw;
  try { raw = await sample.json(buildPrompt({ meal, cat, prefer, allowed, timeMax }), { modelTier: 'default', cache: false }); }
  catch (e) {
    const msg = { not_granted: 'Tu n’as pas autorisé Claude dans cette page.', rate_limited: 'Trop de demandes : réessaie dans un moment.', invalid_json: 'Claude a répondu dans un format inattendu : réessaie.' }[e?.code];
    throw new Error(msg || 'Claude n’a pas pu répondre : réessaie plus tard.');
  }
  return toRecipe(raw, { meal, cat, allowed });
}
