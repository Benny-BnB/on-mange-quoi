// Bibliothèque de recettes (sortie structurée). Quantités par PORTION DE RÉFÉRENCE
// (1 adulte d'appétit normal = coefficient 1). Les ingrédients sont des ids de `ingredients.js` ;
// `{ any: 'groupe' }` laisse le moteur choisir selon le stock et les promos (recettes anti-gaspi).
// Les régimes / allergènes ne sont JAMAIS saisis ici : ils sont déduits des ingrédients.
import { GROUPS, INGREDIENTS } from './ingredients.js';

export const CATEGORIES = {
  express: { label: 'Express', maxTotal: 20, color: '#e8590c', hint: 'Très peu d’étapes, peu de vaisselle' },
  equilibre: { label: 'Équilibré', maxTotal: 40, color: '#2f9e44', hint: 'Légumes majoritaires, cuisson douce' },
  plaisir: { label: 'Petit plaisir', maxTotal: null, color: '#d6336c', hint: 'Comfort food, gourmand' },
  batch: { label: 'Batch cooking', maxTotal: 90, color: '#1971c2', hint: 'Cuisiné une fois, servi 2 à 3 fois' },
  antigaspi: { label: 'Anti-gaspi', maxTotal: null, color: '#5c940d', hint: 'Vide le stock qui arrive à échéance' },
  weekend: { label: 'Week-end', maxTotal: null, color: '#7048e8', hint: 'Plat travaillé ou à partager' },
};
export const MEALS = {
  'petit-dej': { label: 'Petit-déjeuner', emoji: '☕', order: 0 },
  diner: { label: 'Dîner', emoji: '🥪', order: 1 },
  souper: { label: 'Souper', emoji: '🍽️', order: 2 },
  collation: { label: 'Collation', emoji: '🍎', order: 3 },
};
export const EQUIPMENT = {
  four: 'Four',
  microondes: 'Micro-ondes',
  airfryer: 'Airfryer',
  plaques: 'Plaques de cuisson',
  mixeur: 'Robot / mixeur',
  vapeur: 'Cuiseur vapeur',
  barbecue: 'Barbecue',
  raclette: 'Appareil à raclette',
};

const R = (id, name, emoji, meals, cat, o) => ({
  id, name, emoji, meals, cat,
  tags: o.tags ?? [], prep: o.prep, cook: o.cook, diff: o.diff ?? 'facile',
  eq: o.eq ?? ['plaques'], ing: o.ing, steps: o.steps, keep: o.keep ?? '2 jours au frigo',
  batch: o.batch ?? 1, source: 'bibliotheque',
});
const G = (g) => ({ any: g });
const OPT = { opt: true };

export const RECIPES = [
  // ====================== SOUPER — EXPRESS (≤ 20 min) ======================
  R('pates-tomate-mozza', 'Pâtes tomate-mozzarella', '🍝', ['souper', 'diner'], 'express', {
    tags: ['enfants', 'emporter'], prep: 5, cook: 12,
    ing: [['pates', 100], ['sauce-tomate', 90], ['mozzarella', 40], ['parmesan', 8, OPT], ['herbes-fraiches', 0.25, OPT], ['huile-olive', 5], ['ail', 0.5], ['sel', 2], ['poivre', 1]],
    steps: ['Portez une grande casserole d’eau salée à ébullition.', ['Cuisez les pâtes selon les indications du paquet.', 10], 'Pendant ce temps, faites chauffer la sauce tomate avec l’ail émincé dans un filet d’huile d’olive.', 'Égouttez les pâtes, mélangez-les à la sauce et ajoutez la mozzarella en morceaux.', 'Servez avec le parmesan et les herbes.'],
  }),
  R('omelette-champignons', 'Omelette aux champignons et salade', '🍳', ['souper', 'diner'], 'express', {
    tags: ['emporter'], prep: 5, cook: 10,
    ing: [['oeufs', 2.5], ['champignons', 100], ['fromage-rape', 20], ['salade', 0.25], ['beurre', 8], ['pain', 50, OPT], ['sel', 1], ['poivre', 1]],
    steps: ['Émincez les champignons et lavez la salade.', ['Faites revenir les champignons dans le beurre à feu vif.', 4], 'Battez les œufs avec sel et poivre, versez-les sur les champignons.', ['Laissez prendre à feu doux, ajoutez le fromage et repliez l’omelette.', 4], 'Servez avec la salade (et du pain si vous voulez).'],
  }),
  R('wraps-poulet', 'Wraps poulet-crudités', '🌯', ['souper', 'diner'], 'express', {
    tags: ['enfants', 'emporter'], prep: 10, cook: 8,
    ing: [['wraps', 2], ['poulet-filet', 110], ['salade', 0.2], ['tomate', 60], ['concombre', 0.15], ['yaourt-grec', 30], ['epices', 2], ['huile-olive', 5], ['sel', 1]],
    steps: ['Coupez le poulet en lanières et assaisonnez-le avec les épices et le sel.', ['Faites-le dorer à la poêle dans l’huile.', 8], 'Coupez les crudités et mélangez le yaourt avec une pincée de sel.', 'Garnissez les wraps de poulet, crudités et sauce au yaourt, puis roulez-les.'],
  }),
  R('croque-monsieur', 'Croque-monsieur et salade', '🥪', ['souper', 'diner'], 'express', {
    tags: ['enfants', 'emporter'], prep: 5, cook: 10,
    ing: [['pain', 100], ['jambon', 50], ['fromage-rape', 40], ['beurre', 10], ['salade', 0.25]],
    steps: ['Beurrez les tranches de pain d’un côté.', 'Garnissez de jambon et de fromage, refermez.', ['Faites dorer à la poêle ou au grille-pain, 4 minutes de chaque côté.', 8], 'Servez avec la salade.'],
  }),
  R('pates-saumon-epinards', 'Pâtes au saumon et aux épinards', '🍝', ['souper'], 'express', {
    prep: 5, cook: 15,
    ing: [['pates', 100], ['saumon-filet', 100], ['creme', 50], ['epinards', 60], ['citron', 0.1, OPT], ['ail', 0.5], ['huile-olive', 5], ['sel', 1], ['poivre', 1]],
    steps: ['Cuisez les pâtes dans l’eau salée.', 'Coupez le saumon en dés et faites-le dorer 3 minutes avec l’ail.', ['Ajoutez la crème et les épinards, laissez tomber 3 minutes.', 3], 'Mélangez avec les pâtes égouttées, un peu de zeste de citron, poivre.'],
  }),
  R('scampis-ail-spaghetti', 'Scampis à l’ail et spaghetti', '🦐', ['souper'], 'express', {
    prep: 8, cook: 12,
    ing: [['pates', 100], ['scampis', 100], ['tomate', 80], ['ail', 1], ['huile-olive', 8], ['herbes-fraiches', 0.25, OPT], ['sel', 1], ['poivre', 1]],
    steps: ['Décongelez les scampis sous l’eau froide.', ['Cuisez les spaghetti dans l’eau salée.', 10], 'Faites revenir l’ail dans l’huile, ajoutez les scampis 3 minutes, puis les tomates en dés 2 minutes.', 'Mélangez aux pâtes, parsemez d’herbes.'],
  }),
  R('pizza-salade', 'Pizza et salade verte', '🍕', ['souper', 'diner'], 'express', {
    tags: ['enfants'], prep: 3, cook: 15, eq: ['four'],
    ing: [['pizza-surgelee', 0.5], ['salade', 0.25], ['tomate', 50, OPT], ['fromage-rape', 15, OPT], ['huile-olive', 5], ['vinaigre', 3]],
    steps: ['Préchauffez le four selon l’emballage.', ['Enfournez la pizza, garnie de tomate et fromage si vous voulez.', 14], 'Préparez la salade avec huile, vinaigre et sel.', 'Découpez la pizza et servez avec la salade.'],
  }),
  R('quesadillas-haricots', 'Quesadillas haricots rouges-fromage', '🌮', ['souper', 'diner'], 'express', {
    tags: ['enfants'], prep: 8, cook: 8,
    ing: [['wraps', 2], ['haricots-rouges', 80], ['mais', 40], ['fromage-rape', 40], ['poivron', 60], ['epices', 2], ['huile-neutre', 3]],
    steps: ['Égouttez haricots et maïs, coupez le poivron en petits dés.', 'Étalez haricots, maïs, poivron, épices et fromage sur la moitié de chaque wrap, repliez.', ['Faites dorer à la poêle 3-4 minutes de chaque côté.', 7], 'Coupez en triangles et servez.'],
  }),
  R('riz-saute-oeuf', 'Riz sauté aux légumes et à l’œuf', '🍚', ['souper'], 'express', {
    tags: ['enfants'], prep: 8, cook: 12,
    ing: [['riz', 70], ['oeufs', 1.5], [G('legumes'), 120], ['sauce-soja', 10], ['huile-neutre', 8], ['ail', 0.5]],
    steps: [['Cuisez le riz et laissez-le refroidir un instant.', 10], 'Coupez les légumes en petits morceaux.', 'Faites sauter l’ail et les légumes 4 minutes à feu vif dans l’huile.', 'Poussez sur le côté, brouillez les œufs, puis ajoutez le riz et la sauce soja. Mélangez.'],
  }),
  R('ravioli-ricotta-epinards', 'Raviolis ricotta-épinards sauce tomate', '🥟', ['souper', 'diner'], 'express', {
    tags: ['enfants'], prep: 3, cook: 8,
    ing: [['pates-farcies', 125], ['sauce-tomate', 80], ['parmesan', 10, OPT], ['herbes-fraiches', 0.25, OPT]],
    steps: ['Portez de l’eau salée à ébullition.', ['Plongez les raviolis, cuisez-les selon le paquet (3 à 4 minutes).', 4], 'Chauffez la sauce tomate.', 'Égouttez, nappez de sauce et parsemez de parmesan.'],
  }),
  R('salade-pates-thon', 'Salade de pâtes thon-maïs', '🥗', ['souper', 'diner'], 'express', {
    tags: ['emporter'], prep: 10, cook: 10,
    ing: [['pates', 80], ['thon-boite', 60], ['mais', 40], ['tomate', 80], ['concombre', 0.2], ['yaourt-grec', 30], ['huile-olive', 5], ['sel', 1], ['poivre', 1]],
    steps: [['Cuisez les pâtes puis rincez-les à l’eau froide.', 10], 'Coupez tomate et concombre en dés, égouttez thon et maïs.', 'Mélangez le tout avec le yaourt, l’huile, sel et poivre.'],
  }),
  R('plat-prepare-legumes', 'Plat préparé et légumes poêlés', '🍲', ['souper', 'diner'], 'express', {
    tags: ['emporter'], prep: 3, cook: 15, eq: [['four', 'microondes'], 'plaques'],
    ing: [['plat-four-volaille', 240], [G('legumes'), 120], ['huile-olive', 4], ['sel', 1]],
    steps: [['Réchauffez le plat préparé au four ou au micro-ondes selon l’emballage.', 12], 'Pendant ce temps, poêlez les légumes avec un filet d’huile.', 'Servez le plat avec les légumes.'],
  }),

  // ====================== SOUPER — ÉQUILIBRÉ (≤ 40 min) ======================
  R('poke-bowl', 'Poké bowl au saumon', '🥗', ['souper', 'diner'], 'equilibre', {
    tags: ['emporter'], prep: 15, cook: 12,
    ing: [['riz', 70], [G('poisson_pret'), 100], ['avocat', 0.5], ['concombre', 0.3], ['mangue', 60], ['wakame', 30, OPT], ['carotte', 40], ['sauce-poke', 20]],
    steps: [['Cuisez le riz et laissez-le tiédir.', 12], 'Coupez le poisson, l’avocat, le concombre et la carotte en petits morceaux ; décongelez la mangue.', 'Versez le riz dans un bol et disposez joliment les ingrédients par-dessus.', 'Ajoutez le wakamé, arrosez de sauce poké et servez.'],
  }),
  R('poulet-legumes-rotis', 'Poulet et légumes rôtis au four', '🍗', ['souper'], 'equilibre', {
    prep: 10, cook: 30, eq: ['four'],
    ing: [['poulet-filet', 130], ['pomme-de-terre', 200], ['courgette', 100], ['poivron', 80], ['carotte', 80], ['huile-olive', 10], ['epices', 3], ['sel', 2]],
    steps: ['Préchauffez le four à 200 °C.', 'Coupez pommes de terre, carottes, courgette et poivron en morceaux ; coupez le poulet en gros dés.', 'Mélangez le tout avec huile, épices et sel sur une plaque.', ['Enfournez en retournant à mi-cuisson.', 30]],
  }),
  R('saumon-riz-brocoli', 'Saumon, riz et brocoli', '🐟', ['souper'], 'equilibre', {
    prep: 5, cook: 20, eq: ['plaques'],
    ing: [['saumon-filet', 130], ['riz', 70], ['brocoli', 150], ['citron', 0.1, OPT], ['huile-olive', 5], ['sel', 1], ['poivre', 1]],
    steps: [['Cuisez le riz.', 12], 'Détaillez le brocoli en fleurettes et cuisez-le à la vapeur ou à l’eau 6 minutes.', ['Poêlez le saumon 4 minutes de chaque côté dans un filet d’huile.', 8], 'Servez avec un trait de citron.'],
  }),
  R('wok-poulet-legumes', 'Wok de poulet aux légumes', '🥘', ['souper'], 'equilibre', {
    prep: 10, cook: 12,
    ing: [[G('legumes'), 200], ['poulet-filet', 110], ['riz', 60], ['sauce-soja', 15], ['huile-neutre', 8], ['ail', 0.5]],
    steps: [['Cuisez le riz.', 12], 'Coupez le poulet en lanières et les légumes en morceaux réguliers.', ['Saisissez le poulet à feu vif 4 minutes dans l’huile, réservez.', 4], ['Faites sauter les légumes 5 minutes, remettez le poulet, ajoutez la sauce soja.', 5], 'Servez sur le riz.'],
  }),
  R('veloute-legumes', 'Velouté de légumes et tartine', '🥣', ['souper', 'diner'], 'equilibre', {
    tags: ['emporter'], prep: 10, cook: 25, eq: ['plaques', 'mixeur'],
    ing: [['carotte', 120], ['pomme-de-terre', 100], ['poireau', 80], ['creme', 20, OPT], ['pain', 60], ['fromage-rape', 20], ['bouillon-cube', 0.25], ['sel', 1], ['poivre', 1]],
    steps: ['Épluchez et coupez les légumes en morceaux.', ['Couvrez d’eau avec le bouillon et laissez cuire à couvert.', 20], 'Mixez finement, ajoutez la crème, rectifiez l’assaisonnement.', 'Servez avec une tartine de pain gratinée au fromage.'],
  }),
  R('gratin-courgettes', 'Gratin de courgettes et pommes de terre', '🧀', ['souper'], 'equilibre', {
    prep: 15, cook: 25, eq: ['four'],
    ing: [['courgette', 200], ['pomme-de-terre', 100], ['creme', 40], ['fromage-rape', 30], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 200 °C.', 'Émincez courgettes et pommes de terre finement.', 'Disposez dans un plat, versez la crème salée et poivrée, parsemez de fromage.', ['Enfournez jusqu’à ce que le dessus soit doré.', 25]],
  }),
  R('eglefin-papillote', 'Églefin en papillote et pommes de terre', '🐠', ['souper'], 'equilibre', {
    prep: 10, cook: 25, eq: ['four'],
    ing: [['poisson-blanc', 140], ['pomme-de-terre', 200], ['poireau', 80], ['carotte', 60], ['citron', 0.15, OPT], ['beurre', 8], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 190 °C.', 'Coupez pommes de terre, carotte et poireau en fines rondelles ; précuisez les pommes de terre 5 minutes.', 'Déposez légumes et poisson sur une feuille de papier cuisson, ajoutez beurre, citron, sel et poivre, fermez en papillote.', ['Enfournez.', 20]],
  }),
  R('curry-pois-chiches', 'Curry de pois chiches et épinards', '🍛', ['souper'], 'equilibre', {
    prep: 10, cook: 20,
    ing: [['pois-chiches', 100], ['lait-coco', 80], ['tomates-concassees', 80], ['epinards', 60], ['riz', 70], ['oignon', 0.5], ['epices', 4], ['huile-neutre', 5], ['sel', 1]],
    steps: [['Cuisez le riz.', 12], 'Faites revenir l’oignon émincé avec les épices dans l’huile.', ['Ajoutez tomates, pois chiches égouttés et lait de coco, laissez mijoter.', 12], 'Incorporez les épinards 2 minutes avant de servir sur le riz.'],
  }),
  R('ratatouille-oeufs', 'Ratatouille et œufs pochés', '🍆', ['souper'], 'equilibre', {
    prep: 15, cook: 25,
    ing: [['courgette', 120], ['aubergine', 100], ['poivron', 80], ['tomate', 120], ['oeufs', 1.5], ['pain', 40], ['oignon', 0.5], ['huile-olive', 8], ['epices', 2], ['sel', 1]],
    steps: ['Coupez tous les légumes en dés.', ['Faites-les revenir à l’huile avec l’oignon puis laissez mijoter à couvert.', 20], 'Creusez des puits dans la ratatouille, cassez-y les œufs.', ['Laissez prendre à couvert.', 4], 'Servez avec le pain.'],
  }),
  R('batonnets-poisson-puree', 'Bâtonnets de poisson, purée et petits pois', '🐟', ['souper'], 'equilibre', {
    tags: ['enfants'], prep: 10, cook: 22, eq: [['four', 'airfryer'], 'plaques'],
    ing: [['batonnets-poisson', 120], ['pomme-de-terre', 200], ['petits-pois', 80], ['lait', 50], ['beurre', 10], ['sel', 1]],
    steps: ['Préchauffez le four à 200 °C et enfournez les bâtonnets.', ['Cuisez les pommes de terre épluchées dans l’eau salée.', 18], 'Cuisez les petits pois 5 minutes.', 'Écrasez les pommes de terre avec lait chaud et beurre.', 'Servez le tout ensemble.'],
  }),

  // ====================== SOUPER — PETIT PLAISIR ======================
  R('burger-maison', 'Burgers maison et frites au four', '🍔', ['souper'], 'plaisir', {
    tags: ['enfants'], prep: 10, cook: 25, eq: ['four', 'plaques'],
    ing: [['boeuf-hache', 130], ['pain-pistolet', 1], ['fromage-tranches', 25], ['tomate', 40], ['salade', 0.1], ['frites', 200], ['ketchup', 15], ['sel', 1]],
    steps: [['Enfournez les frites selon l’emballage.', 22], 'Façonnez des steaks avec le haché, salez et poivrez.', ['Saisissez-les à la poêle 3-4 minutes de chaque côté, ajoutez le fromage en fin de cuisson.', 8], 'Garnissez les pains de salade, tomate, steak et sauce. Servez avec les frites.'],
  }),
  R('raclette-maison', 'Raclette, pommes de terre et charcuterie', '🧀', ['souper'], 'plaisir', {
    tags: ['apero'], prep: 10, cook: 25, eq: [['raclette', 'four']],
    ing: [['fromage-raclette', 150], ['pomme-de-terre', 300], ['charcuterie-mixte', 70], ['salade', 0.2], ['vinaigre', 3], ['huile-olive', 5]],
    steps: [['Cuisez les pommes de terre dans leur peau.', 22], 'Préparez la charcuterie et une salade verte.', 'Disposez le fromage en tranches : à l’appareil ou gratiné au four sur les pommes de terre.', 'Servez chaud avec la charcuterie et la salade.'],
  }),
  R('carbonara', 'Spaghetti carbonara', '🍝', ['souper'], 'plaisir', {
    tags: ['enfants'], prep: 5, cook: 15,
    ing: [['pates', 100], ['lardons', 60], ['oeufs', 1], ['parmesan', 20], ['poivre', 1], ['sel', 1]],
    steps: [['Cuisez les spaghetti dans l’eau salée.', 10], 'Faites dorer les lardons sans matière grasse.', 'Battez l’œuf avec le parmesan et beaucoup de poivre.', 'Hors du feu, mélangez les pâtes chaudes, les lardons et la préparation en ajoutant un peu d’eau de cuisson.'],
  }),
  R('mac-cheese', 'Macaroni au fromage', '🧀', ['souper'], 'plaisir', {
    tags: ['enfants'], prep: 5, cook: 20,
    ing: [['pates', 100], ['lait', 120], ['beurre', 12], ['farine', 12], ['fromage-rape', 50], ['jambon', 30, OPT], ['sel', 1], ['poivre', 1]],
    steps: [['Cuisez les macaronis.', 10], 'Faites fondre le beurre, ajoutez la farine puis le lait petit à petit en remuant.', ['Laissez épaissir 5 minutes, ajoutez le fromage.', 5], 'Mélangez aux pâtes (et au jambon coupé).'],
  }),
  R('chipolata-puree', 'Chipolatas et purée', '🌭', ['souper'], 'plaisir', {
    tags: ['enfants'], prep: 10, cook: 25,
    ing: [['chipolata-poulet', 150], ['pomme-de-terre', 250], ['lait', 50], ['beurre', 10], [G('legumes'), 120], ['sel', 1]],
    steps: [['Cuisez les pommes de terre épluchées dans l’eau salée.', 20], ['Faites dorer les chipolatas à la poêle, en les retournant.', 12], 'Cuisez les légumes à la vapeur ou à l’eau.', 'Écrasez les pommes de terre avec lait chaud et beurre.', 'Servez ensemble.'],
  }),
  R('boulettes-sauce-tomate', 'Boulettes sauce tomate et pommes de terre', '🍅', ['souper'], 'plaisir', {
    tags: ['enfants'], prep: 5, cook: 25,
    ing: [['boulettes-viande', 150], ['sauce-tomate', 120], ['pomme-de-terre', 250], ['oignon', 0.25], ['sel', 1]],
    steps: [['Cuisez les pommes de terre dans l’eau salée.', 20], 'Faites revenir l’oignon, ajoutez la sauce tomate.', ['Ajoutez les boulettes et laissez mijoter doucement.', 10], 'Servez les boulettes nappées de sauce avec les pommes de terre.'],
  }),
  R('gratin-pdt-jambon', 'Gratin de pommes de terre au jambon', '🥔', ['souper'], 'plaisir', {
    prep: 15, cook: 40, eq: ['four'],
    ing: [['pomme-de-terre', 250], ['jambon', 60], ['creme', 60], ['fromage-rape', 30], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 190 °C.', 'Épluchez et émincez les pommes de terre ; coupez le jambon.', 'Alternez pommes de terre et jambon dans un plat, versez la crème, couvrez de fromage.', ['Enfournez jusqu’à ce que le gratin soit doré et tendre.', 40]],
    keep: '3 jours au frigo',
  }),
  R('pancakes', 'Pancakes aux fruits', '🥞', ['souper', 'petit-dej'], 'plaisir', {
    tags: ['enfants'], prep: 10, cook: 15,
    ing: [['farine', 60], ['oeufs', 1], ['lait', 150], ['sucre', 10], ['beurre', 8], [G('fruits'), 0.5], ['confiture', 15, OPT]],
    steps: ['Mélangez farine, sucre, œuf et lait pour obtenir une pâte lisse.', ['Faites cuire des petites louches de pâte dans un peu de beurre, 2 minutes par face.', 12], 'Servez avec fruits coupés et confiture.'],
  }),

  // ====================== SOUPER — BATCH COOKING (≤ 90 min, servi 2 à 3 fois) ======================
  R('bolognaise-batch', 'Spaghetti bolognaise (batch)', '🍝', ['souper'], 'batch', {
    tags: ['enfants'], prep: 15, cook: 45, batch: 2, keep: '3 jours au frigo ou 3 mois au congélateur',
    ing: [['boeuf-hache', 110], ['tomates-concassees', 120], ['carotte', 50], ['pates', 100], ['parmesan', 10, OPT], ['oignon', 0.5], ['ail', 0.5], ['huile-olive', 6], ['epices', 2], ['sel', 1]],
    steps: ['Faites revenir l’oignon, l’ail et la carotte râpée dans l’huile.', 'Ajoutez le haché et faites-le colorer en l’émiettant.', ['Versez les tomates, assaisonnez et laissez mijoter doucement.', 35], ['Cuisez les spaghetti.', 10], 'Servez la moitié ; mettez le reste de sauce au frais ou au congélateur.'],
  }),
  R('chili-con-carne', 'Chili con carne (batch)', '🌶️', ['souper'], 'batch', {
    prep: 15, cook: 50, batch: 2, keep: '3 jours au frigo ou 3 mois au congélateur',
    ing: [['boeuf-hache', 100], ['haricots-rouges', 80], ['mais', 40], ['tomates-concassees', 100], ['poivron', 50], ['riz', 60], ['oignon', 0.5], ['epices', 4], ['huile-neutre', 6], ['sel', 1]],
    steps: ['Faites revenir l’oignon et le poivron en dés, ajoutez le haché.', 'Ajoutez épices, tomates, haricots et maïs égouttés.', ['Laissez mijoter à feu doux.', 35], ['Cuisez le riz en fin de mijotage.', 12], 'Servez et gardez la moitié pour un autre repas.'],
  }),
  R('lasagnes-batch', 'Lasagnes au bœuf (batch)', '🍽️', ['souper'], 'batch', {
    tags: ['enfants'], prep: 25, cook: 55, batch: 2, eq: ['four'], diff: 'moyen', keep: '3 jours au frigo ou 3 mois au congélateur',
    ing: [['boeuf-hache', 90], ['tomates-concassees', 100], ['pates-lasagne', 60], ['lait', 150], ['beurre', 12], ['farine', 12], ['fromage-rape', 40], ['carotte', 40], ['oignon', 0.5], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 190 °C.', ['Préparez la sauce : oignon, carotte, haché, tomates, mijotez.', 20], 'Préparez la béchamel : beurre, farine, lait.', 'Montez les couches : sauce, pâtes, béchamel, et terminez par le fromage.', ['Enfournez.', 40], 'Laissez reposer 10 minutes avant de découper.'],
  }),
  R('curry-poulet-coco', 'Curry de poulet au lait de coco (batch)', '🍛', ['souper'], 'batch', {
    prep: 15, cook: 35, batch: 2, keep: '3 jours au frigo ou 3 mois au congélateur',
    ing: [['poulet-filet', 120], ['lait-coco', 80], ['legumes-surgeles', 100], ['poivron', 60], ['riz', 70], ['oignon', 0.5], ['epices', 5], ['huile-neutre', 6], ['sel', 1]],
    steps: ['Coupez le poulet en dés et faites-le dorer avec l’oignon.', 'Ajoutez les épices, le poivron et les légumes.', ['Versez le lait de coco et laissez mijoter.', 20], ['Cuisez le riz.', 12], 'Servez ; gardez le reste pour un autre repas.'],
  }),
  R('soupe-legumes-batch', 'Grande soupe de légumes (batch)', '🥣', ['souper', 'diner'], 'batch', {
    tags: ['emporter'], prep: 15, cook: 35, batch: 3, eq: ['plaques', 'mixeur'], keep: '4 jours au frigo ou 3 mois au congélateur',
    ing: [['carotte', 120], ['pomme-de-terre', 100], ['poireau', 100], ['courgette', 80], ['pain', 60], ['creme', 20, OPT], ['bouillon-cube', 0.25], ['sel', 1], ['poivre', 1]],
    steps: ['Épluchez et coupez tous les légumes.', ['Couvrez d’eau avec le bouillon et laissez cuire.', 25], 'Mixez finement.', 'Servez avec du pain ; répartissez le reste en portions.'],
  }),
  R('hachis-parmentier', 'Hachis parmentier (batch)', '🥔', ['souper'], 'batch', {
    tags: ['enfants'], prep: 25, cook: 55, batch: 2, eq: ['four'], keep: '3 jours au frigo ou 3 mois au congélateur',
    ing: [['boeuf-hache', 130], ['pomme-de-terre', 250], ['carotte', 50], ['lait', 60], ['beurre', 10], ['fromage-rape', 20], ['oignon', 0.5], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 200 °C.', ['Cuisez les pommes de terre et écrasez-les avec lait et beurre.', 20], 'Faites revenir oignon, carotte et haché.', 'Étalez la viande dans un plat, couvrez de purée et de fromage.', ['Enfournez pour gratiner.', 30]],
  }),

  // ====================== SOUPER — ANTI-GASPI ======================
  R('frittata-frigo', 'Frittata du frigo', '🍳', ['souper', 'diner'], 'antigaspi', {
    tags: ['emporter'], prep: 10, cook: 15,
    ing: [['oeufs', 2], [G('legumes'), 150], [G('fromages'), 25], [G('charcuterie'), 40, OPT], ['huile-olive', 6], ['sel', 1], ['poivre', 1]],
    steps: ['Coupez les légumes en petits morceaux et faites-les revenir.', 'Battez les œufs avec sel, poivre et fromage.', ['Versez sur les légumes, laissez prendre à feu doux à couvert.', 10], 'Retournez ou gratinez 2 minutes et servez en parts.'],
  }),
  R('soupe-vide-frigo', 'Soupe « vide-frigo »', '🥣', ['souper', 'diner'], 'antigaspi', {
    tags: ['emporter'], prep: 10, cook: 25, eq: ['plaques', 'mixeur'],
    ing: [[G('legumes'), 150], [G('legumes'), 100], ['pomme-de-terre', 100], ['bouillon-cube', 0.25], ['sel', 1], ['poivre', 1]],
    steps: ['Lavez et coupez tous les légumes disponibles.', ['Couvrez d’eau avec le bouillon et cuisez jusqu’à tendreté.', 20], 'Mixez, rectifiez l’assaisonnement.'],
  }),
  R('poelee-restes', 'Poêlée de légumes du frigo et riz', '🥘', ['souper'], 'antigaspi', {
    prep: 10, cook: 15,
    ing: [[G('legumes'), 200], ['riz', 70], ['oeufs', 1, OPT], [G('fromages'), 20, OPT], ['huile-olive', 8], ['epices', 2], ['sel', 1]],
    steps: [['Cuisez le riz.', 12], 'Coupez les légumes et poêlez-les à feu vif.', 'Ajoutez le riz, l’œuf brouillé et le fromage.', 'Assaisonnez avec les épices.'],
  }),
  R('gratin-pates-frigo', 'Gratin de pâtes et légumes du frigo', '🧀', ['souper'], 'antigaspi', {
    prep: 10, cook: 30, eq: ['four'],
    ing: [['pates', 90], [G('legumes'), 120], ['creme', 40], [G('fromages'), 40], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 200 °C.', ['Cuisez les pâtes à moitié.', 6], 'Mélangez-les aux légumes coupés et à la crème dans un plat.', 'Couvrez de fromage.', ['Enfournez jusqu’à dorure.', 20]],
  }),

  // ====================== SOUPER — WEEK-END ======================
  R('poulet-roti', 'Poulet rôti et pommes de terre', '🍗', ['souper'], 'weekend', {
    tags: ['enfants'], prep: 15, cook: 80, eq: ['four'], keep: '3 jours au frigo',
    ing: [['poulet-entier', 400], ['pomme-de-terre', 250], ['carotte', 100], ['beurre', 10], ['epices', 3], ['sel', 2], ['poivre', 1]],
    steps: ['Préchauffez le four à 200 °C.', 'Badigeonnez le poulet de beurre et d’épices, salez, posez-le dans un plat.', 'Entourez de pommes de terre et de carottes en morceaux.', ['Enfournez en arrosant régulièrement du jus de cuisson.', 75], 'Laissez reposer 10 minutes avant de découper.'],
  }),
  R('roti-porc-legumes', 'Rôti de porc, pommes de terre et carottes', '🥩', ['souper'], 'weekend', {
    prep: 15, cook: 70, eq: ['four'], keep: '3 jours au frigo',
    ing: [['roti-porc', 150], ['pomme-de-terre', 250], ['carotte', 120], ['moutarde', 10], ['huile-olive', 10], ['epices', 2], ['sel', 2]],
    steps: ['Préchauffez le four à 180 °C.', 'Badigeonnez le rôti de moutarde et d’épices, posez-le dans un plat avec l’huile.', 'Ajoutez pommes de terre et carottes en morceaux.', ['Enfournez en arrosant de temps en temps.', 65], 'Laissez reposer avant de trancher.'],
  }),
  R('stoemp-saucisses', 'Stoemp aux carottes et saucisses', '🥕', ['souper'], 'weekend', {
    tags: ['enfants'], prep: 20, cook: 35,
    ing: [['saucisse', 150], ['pomme-de-terre', 250], ['carotte', 150], ['lait', 50], ['beurre', 15], ['sel', 1], ['poivre', 1]],
    steps: ['Épluchez et coupez pommes de terre et carottes.', ['Cuisez-les ensemble dans l’eau salée.', 25], ['Faites dorer les saucisses à la poêle.', 15], 'Écrasez grossièrement les légumes avec lait chaud et beurre.', 'Servez le stoemp avec les saucisses.'],
  }),
  R('carbonnade-flamande', 'Carbonnade flamande et pommes de terre', '🍺', ['souper'], 'weekend', {
    prep: 25, cook: 150, diff: 'moyen', eq: ['plaques'], keep: '3 jours au frigo ou 3 mois au congélateur',
    ing: [['boeuf-braiser', 150], ['biere-brune', 100], ['pomme-de-terre', 250], ['oignon', 1], ['pain', 20], ['moutarde', 10], ['beurre', 10], ['sucre', 5], ['sel', 1], ['poivre', 1]],
    steps: ['Coupez la viande en cubes et faites-la dorer dans le beurre, réservez.', 'Faites fondre les oignons émincés avec le sucre.', 'Remettez la viande, couvrez de bière, ajoutez le pain tartiné de moutarde.', ['Laissez mijoter à feu très doux à couvert.', 120], ['Cuisez les pommes de terre à l’eau.', 20], 'Servez la carbonnade avec les pommes de terre.'],
  }),
  R('quiche-lorraine', 'Quiche lorraine et salade', '🥧', ['souper', 'diner'], 'weekend', {
    tags: ['emporter'], prep: 15, cook: 40, eq: ['four'],
    ing: [['pate-brisee', 0.25], ['lardons', 50], ['oeufs', 1], ['creme', 60], ['fromage-rape', 30], ['salade', 0.25], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 180 °C et garnissez un moule de pâte.', 'Faites dorer les lardons.', 'Battez œufs, crème, sel, poivre ; répartissez lardons et fromage sur la pâte.', ['Versez l’appareil et enfournez.', 35], 'Servez avec une salade verte.'],
  }),

  // ====================== DÎNER — à emporter ======================
  R('sandwich-jambon-fromage', 'Sandwich jambon-fromage', '🥖', ['diner'], 'express', {
    tags: ['emporter', 'enfants'], prep: 5, cook: 0, eq: [],
    ing: [['pain', 100], ['jambon', 40], ['fromage-tranches', 30], ['salade', 0.1], ['beurre', 8]],
    steps: ['Beurrez le pain.', 'Garnissez de jambon, fromage et salade.', 'Emballez ou servez directement.'],
    keep: 'à manger dans la journée',
  }),
  R('sandwich-thon-mais', 'Sandwich thon-maïs', '🥖', ['diner'], 'express', {
    tags: ['emporter'], prep: 6, cook: 0, eq: [],
    ing: [['pain', 100], ['thon-boite', 50], ['mais', 25], ['mayonnaise', 15], ['tomate', 40], ['salade', 0.1]],
    steps: ['Égouttez thon et maïs, mélangez avec la mayonnaise.', 'Garnissez le pain de salade, tomate et mélange de thon.'],
    keep: 'à manger dans la journée',
  }),
  R('salade-riz-oeuf', 'Salade de riz, maïs et œuf', '🥗', ['diner'], 'equilibre', {
    tags: ['emporter'], prep: 10, cook: 12,
    ing: [['riz', 60], ['oeufs', 1], ['mais', 40], ['tomate', 80], ['concombre', 0.2], ['huile-olive', 5], ['vinaigre', 3], ['sel', 1]],
    steps: [['Cuisez le riz et les œufs durs (10 minutes).', 12], 'Écalez l’œuf, coupez-le ainsi que les légumes.', 'Mélangez tous les ingrédients avec huile, vinaigre et sel.'],
  }),

  // ====================== PETIT-DÉJEUNER (formules) ======================
  R('pdj-tartines', 'Tartines beurre-confiture', '🍞', ['petit-dej'], 'express', {
    tags: ['enfants'], prep: 5, cook: 0, eq: [],
    ing: [['pain', 80], ['beurre', 10], ['confiture', 20]], steps: ['Tartinez le pain de beurre puis de confiture.'], keep: 'à manger tout de suite',
  }),
  R('pdj-porridge', 'Porridge à la banane', '🥣', ['petit-dej'], 'express', {
    tags: ['enfants'], prep: 3, cook: 5,
    ing: [['flocons-avoine', 45], ['lait', 200], ['banane', 0.5], ['sucre', 5, OPT]],
    steps: [['Chauffez flocons et lait en remuant.', 5], 'Ajoutez la banane en rondelles.'], keep: 'à manger tout de suite',
  }),
  R('pdj-yaourt-muesli', 'Yaourt, muesli et fruit', '🥛', ['petit-dej'], 'express', {
    tags: ['enfants'], prep: 3, cook: 0, eq: [],
    ing: [['yaourt-nature', 150], ['muesli', 40], [G('fruits'), 0.5]], steps: ['Versez le yaourt dans un bol, ajoutez le muesli et le fruit coupé.'], keep: 'à manger tout de suite',
  }),
  R('pdj-oeufs-toast', 'Œufs brouillés et toast', '🍳', ['petit-dej'], 'express', {
    prep: 3, cook: 5,
    ing: [['oeufs', 2], ['pain', 60], ['beurre', 8], ['sel', 1]], steps: ['Battez les œufs avec une pincée de sel.', ['Brouillez-les à feu doux dans le beurre.', 4], 'Servez sur du pain grillé.'], keep: 'à manger tout de suite',
  }),
  R('pdj-tartines-fromage', 'Tartines fromage et fruit', '🧀', ['petit-dej'], 'express', {
    tags: ['enfants'], prep: 4, cook: 0, eq: [],
    ing: [['pain', 80], ['fromage-tranches', 30], [G('fruits'), 0.5], ['beurre', 8, OPT]], steps: ['Garnissez le pain de fromage, servez avec un fruit.'], keep: 'à manger tout de suite',
  }),

  // ====================== COLLATIONS ======================
  R('col-fruit', 'Un fruit', '🍎', ['collation'], 'express', { tags: ['enfants', 'emporter'], prep: 1, cook: 0, eq: [], ing: [[G('fruits'), 1]], steps: ['Lavez le fruit et savourez.'], keep: '' }),
  R('col-yaourt', 'Yaourt nature', '🥛', ['collation'], 'express', { tags: ['enfants'], prep: 1, cook: 0, eq: [], ing: [['yaourt-nature', 125], ['confiture', 10, OPT]], steps: ['Servez le yaourt, avec une cuillère de confiture si vous voulez.'], keep: '' }),
  R('col-tartine-fromage', 'Tartine de fromage', '🧀', ['collation'], 'express', { tags: ['enfants', 'emporter'], prep: 2, cook: 0, eq: [], ing: [['pain', 40], ['fromage-tranches', 20]], steps: ['Garnissez le pain de fromage.'], keep: '' }),
  R('col-biscuits-lait', 'Biscuits et verre de lait', '🍪', ['collation'], 'express', { tags: ['enfants'], prep: 1, cook: 0, eq: [], ing: [['biscuits', 30], ['lait', 150]], steps: ['Servez les biscuits avec le lait.'], keep: '' }),
];

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const totalTime = (r) => r.prep + r.cook;

/** Contrôle de cohérence d'une recette (bibliothèque ou générée par IA). Retourne la liste des erreurs. */
export const validateRecipe = (r) => {
  const errs = [];
  if (!r.id || !r.name) errs.push('id/nom manquant');
  if (!CATEGORIES[r.cat]) errs.push(`catégorie inconnue: ${r.cat}`);
  if (!Array.isArray(r.meals) || !r.meals.length || r.meals.some((m) => !MEALS[m])) errs.push('repas invalides');
  if (!(r.prep >= 0) || !(r.cook >= 0)) errs.push('temps invalides');
  const max = CATEGORIES[r.cat]?.maxTotal;
  if (max && r.prep + r.cook > max) errs.push(`temps total ${r.prep + r.cook} min > ${max} min pour « ${CATEGORIES[r.cat].label} »`);
  if (!Array.isArray(r.ing) || !r.ing.length) errs.push('aucun ingrédient');
  for (const [ing, q] of r.ing ?? []) {
    if (typeof ing === 'string' && !INGREDIENTS[ing]) errs.push(`ingrédient inconnu: ${ing}`);
    if (ing && typeof ing === 'object' && !GROUPS[ing.any]) errs.push(`groupe inconnu: ${ing.any}`);
    if (!(q > 0)) errs.push(`quantité invalide pour ${typeof ing === 'string' ? ing : ing?.any}`);
  }
  if (!Array.isArray(r.steps) || !r.steps.length) errs.push('aucune étape');
  for (const e of r.eq ?? []) {
    for (const k of Array.isArray(e) ? e : [e]) if (!EQUIPMENT[k]) errs.push(`matériel inconnu: ${k}`);
  }
  return errs;
};
