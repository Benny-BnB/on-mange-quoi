// Besoins moyens en énergie (Average Requirements, MJ/jour) — EFSA, Dietary Reference Values for energy,
// EFSA Journal 2013;11(1):3005. Valeurs reprises telles quelles depuis l'outil officiel « EFSA DRV Finder »
// (multimedia.efsa.europa.eu/drvs), qui sert les mêmes tableaux que la publication.
// PAL = niveau d'activité physique : 1,4 faible (sédentaire) · 1,6 moyen · 1,8 actif · 2,0 très actif.
// Les PAL non publiés pour un âge (ex. 1,6 avant 4 ans) sont absents : on prend le PAL publié le plus proche.

/** Enfants : âge → { PAL: MJ/jour } */
const CHILD_M = {
  1: { 1.4: 3.3 }, 2: { 1.4: 4.3 }, 3: { 1.4: 4.9 },
  4: { 1.4: 5.3, 1.6: 6.0, 1.8: 6.8 }, 5: { 1.4: 5.6, 1.6: 6.4, 1.8: 7.2 }, 6: { 1.4: 5.9, 1.6: 6.7, 1.8: 7.6 },
  7: { 1.4: 6.3, 1.6: 7.2, 1.8: 8.1 }, 8: { 1.4: 6.7, 1.6: 7.6, 1.8: 8.6 }, 9: { 1.4: 7.0, 1.6: 8.1, 1.8: 9.1 },
  10: { 1.6: 8.1, 1.8: 9.1, 2.0: 10.1 }, 11: { 1.6: 8.5, 1.8: 9.6, 2.0: 10.7 }, 12: { 1.6: 9.1, 1.8: 10.2, 2.0: 11.4 },
  13: { 1.6: 9.8, 1.8: 11.0, 2.0: 12.2 }, 14: { 1.6: 10.5, 1.8: 11.8, 2.0: 13.1 }, 15: { 1.6: 11.3, 1.8: 12.7, 2.0: 14.1 },
  16: { 1.6: 11.9, 1.8: 13.4, 2.0: 14.9 }, 17: { 1.6: 12.3, 1.8: 13.8, 2.0: 15.4 },
};
const CHILD_F = {
  1: { 1.4: 3.0 }, 2: { 1.4: 4.0 }, 3: { 1.4: 4.6 },
  4: { 1.4: 4.9, 1.6: 5.6, 1.8: 6.3 }, 5: { 1.4: 5.2, 1.6: 5.9, 1.8: 6.7 }, 6: { 1.4: 5.5, 1.6: 6.3, 1.8: 7.1 },
  7: { 1.4: 5.8, 1.6: 6.7, 1.8: 7.5 }, 8: { 1.4: 6.2, 1.6: 7.1, 1.8: 7.9 }, 9: { 1.4: 6.6, 1.6: 7.5, 1.8: 8.4 },
  10: { 1.6: 7.6, 1.8: 8.6, 2.0: 9.5 }, 11: { 1.6: 8.0, 1.8: 9.0, 2.0: 10.0 }, 12: { 1.6: 8.4, 1.8: 9.4, 2.0: 10.5 },
  13: { 1.6: 8.8, 1.8: 9.9, 2.0: 11.0 }, 14: { 1.6: 9.1, 1.8: 10.2, 2.0: 11.4 }, 15: { 1.6: 9.3, 1.8: 10.5, 2.0: 11.7 },
  16: { 1.6: 9.5, 1.8: 10.6, 2.0: 11.8 }, 17: { 1.6: 9.5, 1.8: 10.7, 2.0: 11.9 },
};
const adult = (a, b, c, d) => ({ 1.4: a, 1.6: b, 1.8: c, 2.0: d });
/** Adultes : tranche d'âge → { PAL: MJ/jour }. Pas de valeur publiée pour ≥ 80 ans. */
const ADULT_M = {
  '18-29': adult(9.8, 11.2, 12.6, 14.0), '30-39': adult(9.5, 10.8, 12.2, 13.5), '40-49': adult(9.3, 10.7, 12.0, 13.4),
  '50-59': adult(9.2, 10.5, 11.9, 13.2), '60-69': adult(8.4, 9.6, 10.9, 12.1), '70-79': adult(8.3, 9.5, 10.7, 11.9),
};
const ADULT_F = {
  '18-29': adult(7.9, 9.0, 10.1, 11.2), '30-39': adult(7.6, 8.7, 9.8, 10.8), '40-49': adult(7.5, 8.6, 9.7, 10.7),
  '50-59': adult(7.5, 8.5, 9.6, 10.7), '60-69': adult(6.8, 7.8, 8.8, 9.7), '70-79': adult(6.8, 7.7, 8.7, 9.6),
};

export const EFSA_TABLES = { CHILD_M, CHILD_F, ADULT_M, ADULT_F };

/** Adulte de référence : moyenne homme/femme 30-39 ans, activité moyenne (PAL 1,6). */
export const REF_MJ = (ADULT_M['30-39'][1.6] + ADULT_F['30-39'][1.6]) / 2; // 9,75 MJ/jour

export const AGE_CATS = {
  enfant_3_6: { label: 'Enfant 3-6 ans', ages: [3, 4, 5, 6] },
  enfant_7_12: { label: 'Enfant 7-12 ans', ages: [7, 8, 9, 10, 11, 12] },
  ado_13_17: { label: 'Ado 13-17 ans', ages: [13, 14, 15, 16, 17] },
  adulte: { label: 'Adulte', brackets: ['30-39'] }, // tranche de référence de l'adulte
  senior_65: { label: 'Senior 65+', brackets: ['60-69', '70-79'] }, // pas de valeur ≥ 80 ans chez l'EFSA
};
export const ACTIVITY_PAL = { faible: 1.4, moyenne: 1.6, sportif: 1.8 };

const nearest = (row, pal) => {
  const pals = Object.keys(row).map(Number);
  pals.sort((a, b) => Math.abs(a - pal) - Math.abs(b - pal) || a - b); // égalité → PAL le plus bas
  return row[pals[0]];
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const needFor = (cat, sex, pal) => {
  const c = AGE_CATS[cat] || AGE_CATS.adulte;
  const one = (s) => {
    if (c.ages) return mean(c.ages.map((a) => nearest((s === 'F' ? CHILD_F : CHILD_M)[a], pal)));
    return mean(c.brackets.map((b) => nearest((s === 'F' ? ADULT_F : ADULT_M)[b], pal)));
  };
  if (sex === 'homme') return one('M');
  if (sex === 'femme') return one('F');
  return (one('M') + one('F')) / 2; // non précisé
};

/** Besoin énergétique du profil, MJ/jour (EFSA). */
export const energyNeedMJ = (p) => needFor(p.ageCat, p.sex, ACTIVITY_PAL[p.activity] ?? ACTIVITY_PAL.moyenne);

export const DEFAULT_APPETITE = { petit: 0.85, normal: 1, gros: 1.15 };

/** Coefficient de portion = besoin du profil ÷ besoin de l'adulte de référence, ajusté par l'appétit. */
export const portionCoef = (profile, appetite = DEFAULT_APPETITE) =>
  (energyNeedMJ(profile) / REF_MJ) * (appetite[profile.appetite] ?? 1);
