// Règles métier : profils, présence, portions, filtres (allergies / régimes / religion / goûts / matériel).
import { INGREDIENTS, GROUPS, ALLERGENS } from './ingredients.js';
import { portionCoef, DEFAULT_APPETITE } from './efsa.js';
import { dayKey, norm, uniq, niceQty } from './util.js';

export const DIETS = { aucun: 'Aucun', vegetarien: 'Végétarien', vegetalien: 'Végétalien', pesco: 'Pesco-végétarien' };
export const RELIGIOUS = { halal: 'Halal', casher: 'Casher', sans_porc: 'Sans porc', sans_alcool: 'Sans alcool en cuisine' };
export const SEXES = { homme: 'Homme', femme: 'Femme', nonprecise: 'Non précisé' };
export const ACTIVITIES = { faible: 'Faible', moyenne: 'Moyenne', sportif: 'Sportif' };
export const APPETITES = { petit: 'Petit', normal: 'Normal', gros: 'Gros' };

export const DEFAULT_SETTINGS = () => ({
  meals: { 'petit-dej': true, diner: true, souper: true, collation: false },
  equipment: { four: true, microondes: true, airfryer: false, plaques: true, mixeur: true, vapeur: false, barbecue: false, raclette: false },
  equipmentOther: '',
  feux: 4,
  freezer: 'moyen',
  budget: 120,
  basics: null, // null = liste par défaut (DEFAULT_BASICS)
  lowBasics: [],
  hated: [],
  timeRules: { semaine: { 'petit-dej': null, diner: null, souper: 20 }, weekend: { 'petit-dej': null, diner: null, souper: null } },
  appetite: { ...DEFAULT_APPETITE },
  strategicThreshold: 25,
  productMap: {},
  priceOverrides: {},
  onboarded: false,
  inventoryAt: null,
  lang: 'fr',
});

export const FREEZER_SLOTS = { aucun: 0, petit: 2, moyen: 5, grand: 10 };

export const newProfile = (over = {}) => ({
  name: '', ageCat: 'adulte', sex: 'nonprecise', appetite: 'normal', activity: 'moyenne', diet: 'aucun',
  religious: [], allergens: [], allergenFree: '', hated: [], presence: null, snacks: false, ...over,
});

export const isBasic = (ingId, settings) => {
  const set = settings?.basics ?? Object.values(INGREDIENTS).filter((i) => i.basic).map((i) => i.id);
  return set.includes(ingId);
};

// ---------- Présence & portions ----------
/** Grille de présence : presence[jour][repas] === false → absent. Défaut : toujours présent. */
export const isPresent = (profile, date, meal) => {
  const d = profile.presence?.[dayKey(date)];
  return d?.[meal] !== false;
};
export const presentProfiles = (profiles, date, meal) =>
  profiles.filter((p) => isPresent(p, date, meal) && (meal !== 'collation' || p.snacks));

export const coefOf = (profile, settings) => portionCoef(profile, settings?.appetite ?? DEFAULT_APPETITE);

/** Somme des coefficients des personnes présentes (+ invités, comptés comme des adultes de référence). */
export const slotPortions = (slot, profiles, settings) => {
  const people = presentProfiles(profiles, slot.date, slot.meal);
  const sum = people.reduce((a, p) => a + coefOf(p, settings), 0) + (slot.guests || 0);
  return { people, guests: slot.guests || 0, portions: sum, couverts: people.length + (slot.guests || 0) };
};

// ---------- Filtres ----------
const tags = (ingId) => INGREDIENTS[ingId]?.tags ?? [];
const hasAny = (ings, list) => ings.some((i) => tags(i).some((t) => list.includes(t)));

/** Ingrédients incompatibles avec un profil (exclusion STRICTE : allergie, régime, religion). */
export const strictViolations = (ingIds, profile) => {
  const bad = [];
  const free = (profile.allergenFree || '')
    .split(/[,;\n]/).map(norm).filter(Boolean);
  for (const id of ingIds) {
    const ing = INGREDIENTS[id];
    if (!ing) continue;
    for (const a of profile.allergens || []) if (ing.allergens.includes(a)) bad.push({ id, why: `allergie : ${ALLERGENS[a] ?? a}` });
    const label = norm(`${ing.name} ${id.replace(/-/g, ' ')}`);
    for (const f of free) if (label.includes(f)) bad.push({ id, why: `allergie : ${f}` });
  }
  const t = (i) => tags(i);
  const meatish = ['viande', 'volaille', 'porc'];
  const fishish = ['poisson', 'crustace', 'mollusque'];
  if (profile.diet === 'vegetarien') for (const id of ingIds) if (t(id).some((x) => [...meatish, ...fishish, 'gelatine'].includes(x))) bad.push({ id, why: 'régime végétarien' });
  if (profile.diet === 'vegetalien') for (const id of ingIds) if (INGREDIENTS[id]?.animal) bad.push({ id, why: 'régime végétalien' });
  if (profile.diet === 'pesco') for (const id of ingIds) if (t(id).some((x) => meatish.includes(x))) bad.push({ id, why: 'régime pesco-végétarien' });
  const rel = profile.religious || [];
  if (rel.includes('halal')) for (const id of ingIds) if (t(id).some((x) => ['porc', 'alcool', 'gelatine'].includes(x))) bad.push({ id, why: 'halal' });
  if (rel.includes('casher')) {
    for (const id of ingIds) if (t(id).some((x) => ['porc', 'crustace', 'mollusque', 'alcool'].includes(x))) bad.push({ id, why: 'casher' });
    if (hasAny(ingIds, ['viande', 'volaille']) && hasAny(ingIds, ['laitier'])) for (const id of ingIds) if (t(id).includes('laitier')) bad.push({ id, why: 'casher (viande + lait)' });
  }
  if (rel.includes('sans_porc')) for (const id of ingIds) if (t(id).includes('porc')) bad.push({ id, why: 'sans porc' });
  if (rel.includes('sans_alcool')) for (const id of ingIds) if (t(id).includes('alcool')) bad.push({ id, why: 'sans alcool' });
  return bad;
};

/** Aliments détestés (exclusion SOUPLE) : du profil + du foyer. */
export const hatedHits = (ingIds, profile, settings) => {
  const list = [...(profile.hated || []), ...(settings?.hated || [])].map(norm).filter(Boolean);
  if (!list.length) return [];
  const hits = [];
  for (const id of ingIds) {
    const ing = INGREDIENTS[id];
    if (!ing) continue;
    const label = norm(`${ing.name} ${id.replace(/-/g, ' ')}`);
    for (const h of list) if (label.includes(h)) hits.push({ id, word: h });
  }
  return hits;
};

/** Matériel : chaîne = requis ; tableau = au moins un parmi. */
export const equipmentOk = (recipe, settings) => {
  const eq = settings?.equipment ?? {};
  return (recipe.eq ?? []).every((e) => (Array.isArray(e) ? e.some((k) => eq[k]) : !!eq[e]));
};

export const groupMembers = (g) => GROUPS[g] ?? [];

/**
 * Vérifie la recette pour des personnes données (lignes déjà résolues).
 * - allergie / régime / religion : exclusion stricte (une ligne optionnelle en conflit est simplement retirée)
 * - détesté : souple (ligne optionnelle retirée, sinon pénalité)
 */
export const checkLines = (lines, people, settings) => {
  const dropped = new Set();
  const reasons = [];
  const hated = [];
  for (const p of people) {
    const ids = uniq(lines.filter((l) => !dropped.has(l.i)).map((l) => l.ing));
    const bad = strictViolations(ids, p);
    for (const b of bad) {
      const ls = lines.filter((l) => l.ing === b.id);
      if (ls.every((l) => l.opt)) ls.forEach((l) => dropped.add(l.i));
      else reasons.push(`${p.name || 'Profil'} : ${b.why} (${INGREDIENTS[b.id]?.name ?? b.id})`);
    }
    for (const h of hatedHits(uniq(lines.filter((l) => !dropped.has(l.i)).map((l) => l.ing)), p, settings)) {
      const ls = lines.filter((l) => l.ing === h.id && !dropped.has(l.i));
      if (ls.length && ls.every((l) => l.opt)) ls.forEach((l) => dropped.add(l.i));
      else hated.push({ who: p.name, ing: h.id });
    }
  }
  // aliments détestés du foyer, même sans personne présente
  return { ok: reasons.length === 0, reasons, dropped: [...dropped], hated };
};

/** Étiquettes déduites des ingrédients (jamais saisies à la main). */
export const derivedTags = (recipe, ingIds) => {
  const all = ingIds ?? recipe.ing.flatMap(([i]) => (typeof i === 'string' ? [i] : []));
  const out = new Set(recipe.tags || []);
  const t = (id) => tags(id);
  const meat = all.some((i) => t(i).some((x) => ['viande', 'volaille', 'porc'].includes(x)));
  const fish = all.some((i) => t(i).some((x) => ['poisson', 'crustace', 'mollusque'].includes(x)));
  const animal = all.some((i) => INGREDIENTS[i]?.animal);
  if (!meat && !fish) out.add('vegetarien');
  if (!animal) out.add('vegetalien');
  if (!meat && fish) out.add('pesco');
  const needsOven = (recipe.eq ?? []).some((e) => e === 'four' || (Array.isArray(e) && e.every((x) => x === 'four')));
  if (!needsOven) out.add('sans-four');
  return [...out];
};

export const allergensOf = (ingIds) => uniq(ingIds.flatMap((i) => INGREDIENTS[i]?.allergens ?? []));

export { niceQty };
