// Base d'ingrédients génériques : unités, formats vendus, conservation, allergènes, régimes,
// et motifs de correspondance avec les noms de produits des folders (matching Delhaize ↔ ingrédient).
// Les prix sont des ESTIMATIONS de prix habituels (hors promo), utilisées seulement pour chiffrer un budget
// quand aucune promo n'existe : à ajuster dans l'app (Foyer) au fil des tickets.
import { norm } from './util.js';

export const ALLERGENS = {
  gluten: 'Céréales contenant du gluten',
  crustaces: 'Crustacés',
  oeufs: 'Œufs',
  poissons: 'Poissons',
  arachides: 'Arachides',
  soja: 'Soja',
  lait: 'Lait (lactose inclus)',
  fruits_a_coque: 'Fruits à coque',
  celeri: 'Céleri',
  moutarde: 'Moutarde',
  sesame: 'Graines de sésame',
  sulfites: 'Anhydride sulfureux et sulfites',
  lupin: 'Lupin',
  mollusques: 'Mollusques',
};

/** Rayons, dans l'ordre d'un parcours de magasin. */
export const RAYONS = [
  ['fruits-legumes', 'Fruits & légumes', '🥦'],
  ['boulangerie', 'Pain & boulangerie', '🥖'],
  ['boucherie', 'Viandes & volailles', '🥩'],
  ['poissonnerie', 'Poissons & fruits de mer', '🐟'],
  ['charcuterie', 'Charcuterie & traiteur', '🥓'],
  ['laitier', 'Produits laitiers & œufs', '🧀'],
  ['epicerie', 'Épicerie', '🍝'],
  ['conserves', 'Conserves & sauces', '🥫'],
  ['surgeles', 'Surgelés', '🧊'],
  ['boissons', 'Boissons', '🥤'],
  ['maison', 'Hygiène & maison', '🧴'],
  ['autre', 'Autre', '🛒'],
];
export const RAYON_LABEL = Object.fromEntries(RAYONS.map(([k, l]) => [k, l]));
export const RAYON_ICON = Object.fromEntries(RAYONS.map(([k, , i]) => [k, i]));
export const RAYON_ORDER = Object.fromEntries(RAYONS.map(([k], i) => [k, i]));

// [id, nom, rayon, unité, options]
// options : b=basique supposé présent · t=étiquettes · al=allergènes · pk=formats vendus (unité de base)
//           pr=prix habituel estimé (€/kg, €/l ou €/pièce) · sh=conservation (jours) · loc=frigo|placard|congelateur
//           m=motif de correspondance produit (texte normalisé) · x=motif d'exclusion · sub=substituts · pro=famille de protéine
const RAW = [
  // ----- Fruits & légumes -----
  ['carotte', 'Carottes', 'fruits-legumes', 'g', { pr: 1.6, sh: 14, loc: 'frigo', pk: [1000, 500], m: 'carotte', x: 'puree' }],
  ['pomme-de-terre', 'Pommes de terre', 'fruits-legumes', 'g', { pr: 1.4, sh: 21, loc: 'placard', pk: [2000, 1000], m: 'pommes? de terre|grenaille', sub: [] }],
  ['courgette', 'Courgettes', 'fruits-legumes', 'g', { pr: 2.5, sh: 7, loc: 'frigo', pk: [400], m: 'courgette' }],
  ['poivron', 'Poivrons', 'fruits-legumes', 'g', { pr: 3.5, sh: 7, loc: 'frigo', pk: [400], m: 'poivron' }],
  ['tomate', 'Tomates', 'fruits-legumes', 'g', { pr: 3.2, sh: 6, loc: 'frigo', pk: [500], m: '^(delhaize )?tomates?\\b|tomates? (grappe|cerise|ronde)' }],
  ['champignons', 'Champignons', 'fruits-legumes', 'g', { pr: 7.5, sh: 5, loc: 'frigo', pk: [250, 400], m: 'champignon' }],
  ['epinards', 'Épinards', 'fruits-legumes', 'g', { pr: 6, sh: 4, loc: 'frigo', pk: [250], m: 'epinards?\\b(?! et)' }],
  ['brocoli', 'Brocoli', 'fruits-legumes', 'g', { pr: 3, sh: 6, loc: 'frigo', pk: [500], m: 'brocoli' }],
  ['chou-fleur', 'Chou-fleur', 'fruits-legumes', 'g', { pr: 2.8, sh: 6, loc: 'frigo', pk: [800], m: 'chou-?fleur' }],
  ['poireau', 'Poireaux', 'fruits-legumes', 'g', { pr: 2.6, sh: 10, loc: 'frigo', pk: [500], m: 'poireau' }],
  ['aubergine', 'Aubergines', 'fruits-legumes', 'g', { pr: 3.5, sh: 7, loc: 'frigo', pk: [400], m: 'aubergine' }],
  ['legumes-wok', 'Légumes pour wok', 'fruits-legumes', 'g', { pr: 6, sh: 5, loc: 'frigo', pk: [400], m: 'legumes? pour wok|poelee de legumes' }],
  ['concombre', 'Concombre', 'fruits-legumes', 'pc', { pr: 1.0, sh: 7, loc: 'frigo', pk: [1], m: 'concombre' }],
  ['salade', 'Salade (laitue)', 'fruits-legumes', 'pc', { pr: 1.3, sh: 5, loc: 'frigo', pk: [1], m: 'laitue|salade (verte|iceberg|mixte)|mesclun|roquette' }],
  ['avocat', 'Avocat', 'fruits-legumes', 'pc', { pr: 1.2, sh: 5, loc: 'frigo', pk: [1], m: 'avocat' }],
  ['citron', 'Citron', 'fruits-legumes', 'pc', { pr: 0.4, sh: 14, loc: 'frigo', pk: [1], m: 'citron' }],
  ['herbes-fraiches', 'Herbes fraîches (basilic, persil…)', 'fruits-legumes', 'pc', { pr: 1.6, sh: 5, loc: 'frigo', pk: [1], m: '^(delhaize )?(basilic|persil|ciboulette|coriandre)\\b' }],
  ['pomme', 'Pommes', 'fruits-legumes', 'pc', { pr: 0.4, sh: 21, loc: 'frigo', pk: [6], m: 'pommes?\\b(?! de terre)' }],
  ['poire', 'Poires', 'fruits-legumes', 'pc', { pr: 0.5, sh: 10, loc: 'frigo', pk: [4], m: 'poires?\\b' }],
  ['banane', 'Bananes', 'fruits-legumes', 'pc', { pr: 0.25, sh: 6, loc: 'placard', pk: [5], m: 'banane' }],
  ['mandarine', 'Mandarines', 'fruits-legumes', 'g', { pr: 2.6, sh: 10, loc: 'frigo', pk: [1000], m: 'mandarine|clementine' }],
  ['orange', 'Oranges', 'fruits-legumes', 'pc', { pr: 0.6, sh: 14, loc: 'frigo', pk: [4], m: 'orange' }],
  ['kiwi', 'Kiwis', 'fruits-legumes', 'pc', { pr: 0.5, sh: 14, loc: 'frigo', pk: [6], m: 'kiwi' }],
  // ----- Boulangerie -----
  ['pain', 'Pain', 'boulangerie', 'g', { pr: 3.5, sh: 4, loc: 'placard', al: ['gluten'], pk: [800, 400], m: '^(delhaize )?pain|pain (suedois|complet|gris)' }],
  ['pain-pistolet', 'Pistolets', 'boulangerie', 'pc', { pr: 0.3, sh: 2, loc: 'placard', al: ['gluten'], pk: [6], m: 'pistolet|petits? pains' }],
  ['wraps', 'Wraps (tortillas)', 'boulangerie', 'pc', { pr: 0.4, sh: 21, loc: 'placard', al: ['gluten'], pk: [8, 6], m: 'wraps?\\b|tortillas?' }],
  ['pate-brisee', 'Pâte brisée', 'boulangerie', 'pc', { pr: 1.8, sh: 20, loc: 'frigo', al: ['gluten'], pk: [1], m: 'pate brisee|pate feuilletee' }],
  // ----- Viandes & volailles -----
  ['poulet-filet', 'Filet de poulet', 'boucherie', 'g', { pr: 10.5, sh: 3, loc: 'frigo', t: ['volaille', 'viande'], pro: 'poulet', pk: [600, 300], m: 'filets? de poulet|blancs? de poulet|aiguillettes? de poulet', sub: ['dinde-filet'] }],
  ['dinde-filet', 'Filet de dinde', 'boucherie', 'g', { pr: 11, sh: 3, loc: 'frigo', t: ['volaille', 'viande'], pro: 'dinde', pk: [500], m: 'dinde', sub: ['poulet-filet'] }],
  ['poulet-entier', 'Poulet entier', 'boucherie', 'g', { pr: 5.5, sh: 3, loc: 'frigo', t: ['volaille', 'viande'], pro: 'poulet', pk: [1500], m: 'poulet (entier|roti|fermier)' }],
  ['chipolata-poulet', 'Chipolatas de poulet', 'boucherie', 'g', { pr: 9.5, sh: 4, loc: 'frigo', t: ['volaille', 'viande'], al: ['gluten'], pro: 'poulet', pk: [325, 650], m: 'chipolata', sub: ['saucisse'] }],
  ['saucisse', 'Saucisses', 'boucherie', 'g', { pr: 8, sh: 3, loc: 'frigo', t: ['porc', 'viande'], al: ['gluten'], pro: 'porc', pk: [400], m: 'saucisses?\\b|merguez', sub: ['chipolata-poulet'] }],
  ['boeuf-hache', 'Bœuf haché', 'boucherie', 'g', { pr: 10, sh: 2, loc: 'frigo', t: ['viande'], pro: 'boeuf', pk: [500, 400], m: '\\bhache\\b|boeuf hache' }],
  ['boeuf-braiser', 'Bœuf à braiser', 'boucherie', 'g', { pr: 14, sh: 3, loc: 'frigo', t: ['viande'], pro: 'boeuf', pk: [600], m: 'stoofvlees|boeuf a braiser|carbonnade' }],
  ['roti-porc', 'Rôti de porc', 'boucherie', 'g', { pr: 9, sh: 3, loc: 'frigo', t: ['porc', 'viande'], pro: 'porc', pk: [800], m: 'roti de porc|filet de porc|filet mignon' }],
  ['lardons', 'Lardons', 'charcuterie', 'g', { pr: 9, sh: 7, loc: 'frigo', t: ['porc', 'viande'], pro: 'porc', pk: [200], m: 'lardons?' }],
  ['boulettes-viande', 'Boulettes de viande cuites', 'boucherie', 'g', { pr: 12, sh: 5, loc: 'frigo', t: ['viande'], al: ['gluten', 'oeufs'], pro: 'boeuf', pk: [500], m: 'boulettes? de viande|ribs' }],
  ['plat-four-volaille', 'Plat préparé au four (volaille)', 'boucherie', 'g', { pr: 12, sh: 4, loc: 'frigo', t: ['volaille', 'viande', 'alcool'], al: ['celeri', 'gluten', 'sulfites', 'lait'], pro: 'poulet', pk: [480], m: 'plat au four|coq au vin|plat prepare' }],
  // ----- Poissons -----
  ['saumon-filet', 'Filet de saumon', 'poissonnerie', 'g', { pr: 24, sh: 2, loc: 'frigo', t: ['poisson'], al: ['poissons'], pro: 'poisson', pk: [250, 500], m: 'saumon (atlantique|bio|classique)|pave de saumon|filet de saumon', sub: ['poisson-blanc'] }],
  ['poisson-blanc', 'Poisson blanc (églefin, cabillaud)', 'poissonnerie', 'g', { pr: 28, sh: 2, loc: 'frigo', t: ['poisson'], al: ['poissons'], pro: 'poisson', pk: [300], m: 'eglefin|cabillaud|colin|merlu|lieu noir', sub: ['saumon-filet'] }],
  ['scampis', 'Scampis', 'surgeles', 'g', { pr: 21, sh: 90, loc: 'congelateur', t: ['crustace'], al: ['crustaces'], pro: 'crustace', pk: [185, 400], m: 'scampis?|crevettes?|gambas' }],
  ['tataki-saumon', 'Tataki de saumon (prêt à manger)', 'poissonnerie', 'g', { pr: 63, sh: 3, loc: 'frigo', t: ['poisson'], al: ['poissons', 'soja', 'sesame'], pro: 'poisson', pk: [110], m: 'tataki' }],
  ['saumon-fume', 'Saumon fumé', 'poissonnerie', 'g', { pr: 40, sh: 10, loc: 'frigo', t: ['poisson'], al: ['poissons'], pro: 'poisson', pk: [100, 200], m: 'saumon fume' }],
  ['thon-boite', 'Thon en boîte', 'conserves', 'g', { pr: 10, sh: 730, loc: 'placard', t: ['poisson'], al: ['poissons'], pro: 'poisson', pk: [140], m: 'thon' }],
  ['batonnets-poisson', 'Bâtonnets de poisson', 'surgeles', 'g', { pr: 9, sh: 180, loc: 'congelateur', t: ['poisson'], al: ['poissons', 'gluten'], pro: 'poisson', pk: [300], m: 'batonnets? de (poisson|colin)|poisson pane' }],
  // ----- Charcuterie -----
  ['jambon', 'Jambon blanc', 'charcuterie', 'g', { pr: 14, sh: 5, loc: 'frigo', t: ['porc', 'viande'], pro: 'porc', pk: [100, 200], m: 'jambon' }],
  ['charcuterie-mixte', 'Charcuterie (salami, filet de saxe…)', 'charcuterie', 'g', { pr: 20, sh: 7, loc: 'frigo', t: ['porc', 'viande'], pro: 'porc', pk: [100], m: 'salami|filet de saxe|charcuterie|saucisson|coppa|speck|rosette' }],
  // ----- Laitiers & œufs -----
  ['oeufs', 'Œufs', 'laitier', 'pc', { pr: 0.35, sh: 21, loc: 'frigo', t: ['oeuf'], al: ['oeufs'], pk: [6, 12], m: 'oeufs?\\b' }],
  ['lait', 'Lait', 'laitier', 'ml', { pr: 1.0, sh: 7, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [1000], m: 'lait (demi|entier|ecreme|uht)|^lait\\b(?! de croissance| de coco)' }],
  ['beurre', 'Beurre', 'laitier', 'g', { pr: 11, sh: 45, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [250], m: 'beurre\\b(?! de cacahuete)' }],
  ['creme', 'Crème liquide', 'laitier', 'ml', { pr: 4.5, sh: 14, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [200, 250], m: 'creme (liquide|fraiche|entiere|cuisine)' }],
  ['yaourt-nature', 'Yaourt nature', 'laitier', 'g', { pr: 3, sh: 14, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [500], m: 'yaourt|activia|yoplait' , x: 'skyr|grec'}],
  ['yaourt-grec', 'Yaourt grec', 'laitier', 'g', { pr: 4, sh: 14, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [440], m: 'yaourt a la grecque|yaourt grec|grec' }],
  ['skyr', 'Skyr / fromage frais protéiné', 'laitier', 'g', { pr: 6, sh: 14, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [450], m: 'skyr|fromage frais proteine|produit laitier proteine' }],
  ['fromage-rape', 'Fromage râpé', 'laitier', 'g', { pr: 10, sh: 21, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [200, 150], m: 'fromage rape|emmental rape|gouda rape' }],
  ['fromage-tranches', 'Fromage en tranches / bloc', 'laitier', 'g', { pr: 12, sh: 21, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [200], m: 'passendale|pere joseph|fromage en bloc|fromage en tranches|gouda|edam|maasdam' }],
  ['mozzarella', 'Mozzarella', 'laitier', 'g', { pr: 9, sh: 10, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [125, 250], m: 'mozzarella|burrata' }],
  ['parmesan', 'Parmesan', 'laitier', 'g', { pr: 20, sh: 60, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [100], m: 'parmesan|grana padano|parmigiano' }],
  ['fromage-raclette', 'Fromage à raclette', 'laitier', 'g', { pr: 11, sh: 21, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [400], m: 'raclette' }],
  ['gorgonzola', 'Gorgonzola', 'laitier', 'g', { pr: 12, sh: 14, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [200], m: 'gorgonzola|roquefort|fromage en portion' }],
  ['feta', 'Feta', 'laitier', 'g', { pr: 11, sh: 21, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [200], m: 'feta' }],
  // ----- Épicerie -----
  ['pates', 'Pâtes', 'epicerie', 'g', { pr: 1.8, sh: 730, loc: 'placard', al: ['gluten'], pk: [500], m: '\\bpates\\b|spaghetti|penne|tagliatelle|fusilli|macaroni|linguine', x: 'farcies|ravioli|tortellini|sauce|base pour' }],
  ['pates-lasagne', 'Feuilles de lasagne', 'epicerie', 'g', { pr: 3.5, sh: 730, loc: 'placard', al: ['gluten'], pk: [500], m: 'lasagne' }],
  ['pates-farcies', 'Pâtes farcies (ravioli…)', 'epicerie', 'g', { pr: 8, sh: 14, loc: 'frigo', al: ['gluten', 'lait', 'oeufs'], pk: [250], m: 'pates farcies|ravioli|tortellini|tortelloni' }],
  ['riz', 'Riz', 'epicerie', 'g', { pr: 2.2, sh: 730, loc: 'placard', pk: [1000, 500], m: '\\briz\\b', x: 'barres?|galettes?|toast|biscuit|souffle' }],
  ['flocons-avoine', "Flocons d'avoine", 'epicerie', 'g', { pr: 2.5, sh: 365, loc: 'placard', al: ['gluten'], pk: [500], m: 'flocons? d.avoine|porridge' }],
  ['muesli', 'Muesli / céréales', 'epicerie', 'g', { pr: 5, sh: 180, loc: 'placard', al: ['gluten', 'fruits_a_coque'], pk: [500], m: 'muesli|cereales|granola|cornflakes' }],
  ['confiture', 'Confiture', 'epicerie', 'g', { pr: 6, sh: 365, loc: 'placard', pk: [335], m: 'confiture|pate a tartiner' }],
  ['biscuits', 'Biscuits', 'epicerie', 'g', { pr: 6, sh: 120, loc: 'placard', al: ['gluten', 'lait', 'oeufs'], pk: [200], m: 'biscuits?\\b|speculoos|galettes au beurre' }],
  ['chocolat', 'Chocolat', 'epicerie', 'g', { pr: 12, sh: 365, loc: 'placard', al: ['lait', 'soja'], pk: [200], m: 'chocolat|cote d.or' }],
  ['sauce-soja', 'Sauce soja', 'epicerie', 'ml', { pr: 8, sh: 365, loc: 'placard', al: ['soja', 'gluten'], pk: [150], m: 'sauce soja' }],
  ['sauce-poke', 'Sauce poké', 'epicerie', 'ml', { pr: 18, sh: 365, loc: 'placard', al: ['soja', 'sesame', 'gluten'], pk: [250], m: 'poke sauce|sauce poke' }],
  ['wakame', "Salade d'algues wakamé", 'epicerie', 'g', { pr: 22, sh: 14, loc: 'frigo', al: ['soja', 'sesame'], pk: [125], m: 'wakame|algues' }],
  ['lait-coco', 'Lait de coco', 'conserves', 'ml', { pr: 3, sh: 730, loc: 'placard', pk: [400], m: 'lait de coco|creme de coco' }],
  ['beurre-cacahuete', 'Beurre de cacahuète', 'epicerie', 'g', { pr: 9, sh: 365, loc: 'placard', al: ['arachides'], pk: [350], m: 'beurre de cacahuete|peanut' }],
  // ----- Conserves & sauces -----
  ['sauce-tomate', 'Sauce tomate (bocal)', 'conserves', 'g', { pr: 3.5, sh: 540, loc: 'placard', al: ['celeri'], pk: [400], m: 'sauce (pour pates|tomate)|base pour sauce|mutti|bertolli' }],
  ['tomates-concassees', 'Tomates concassées', 'conserves', 'g', { pr: 2.2, sh: 730, loc: 'placard', pk: [400], m: 'tomates? (concassees|pelees)|conserve de tomates|passata' }],
  ['haricots-rouges', 'Haricots rouges (boîte)', 'conserves', 'g', { pr: 3, sh: 730, loc: 'placard', pk: [400], m: 'haricots? rouges?' }],
  ['pois-chiches', 'Pois chiches (boîte)', 'conserves', 'g', { pr: 3, sh: 730, loc: 'placard', pk: [400], m: 'pois chiches?' }],
  ['mais', 'Maïs (boîte)', 'conserves', 'g', { pr: 3.5, sh: 730, loc: 'placard', pk: [285], m: '\\bmais\\b' }],
  // ----- Surgelés -----
  ['frites', 'Frites surgelées', 'surgeles', 'g', { pr: 3, sh: 180, loc: 'congelateur', pk: [750, 1000], m: 'frites|croquettes' }],
  ['pizza-surgelee', 'Pizza surgelée', 'surgeles', 'pc', { pr: 3.5, sh: 180, loc: 'congelateur', al: ['gluten', 'lait'], pk: [1], m: 'pizza|stromboli' }],
  ['petits-pois', 'Petits pois', 'surgeles', 'g', { pr: 4, sh: 180, loc: 'congelateur', pk: [450], m: 'petits pois' }],
  ['legumes-surgeles', 'Légumes surgelés', 'surgeles', 'g', { pr: 4, sh: 180, loc: 'congelateur', pk: [750, 450], m: 'legumes? (bio|surgeles)|poelee surgelee' }],
  ['mangue', 'Mangue (morceaux)', 'surgeles', 'g', { pr: 5.3, sh: 180, loc: 'congelateur', pk: [250], m: 'mangue' }],
  ['fruits-rouges', 'Fruits rouges surgelés', 'surgeles', 'g', { pr: 8, sh: 180, loc: 'congelateur', pk: [300], m: 'fruits rouges|framboises?|myrtilles?' }],
  ['puree-legumes', 'Purée de légumes', 'fruits-legumes', 'g', { pr: 6.3, sh: 6, loc: 'frigo', al: ['lait'], t: ['laitier'], pk: [500], m: 'puree' }],
  // ----- Alcool (cuisine) -----
  ['biere-brune', 'Bière brune', 'boissons', 'ml', { pr: 3, sh: 365, loc: 'placard', t: ['alcool'], al: ['gluten'], pk: [330], m: 'biere (brune|d.abbaye)|leffe' }],
  ['vin-rouge', 'Vin rouge (cuisine)', 'boissons', 'ml', { pr: 6, sh: 30, loc: 'placard', t: ['alcool'], al: ['sulfites'], pk: [750], m: 'vin rouge' }],
  // ----- Basiques (supposés toujours présents) -----
  ['sel', 'Sel', 'epicerie', 'g', { b: 1, pk: [1000] }],
  ['poivre', 'Poivre', 'epicerie', 'g', { b: 1, pk: [50] }],
  ['huile-olive', "Huile d'olive", 'epicerie', 'ml', { b: 1, pk: [750] }],
  ['huile-neutre', 'Huile de tournesol', 'epicerie', 'ml', { b: 1, pk: [1000] }],
  ['vinaigre', 'Vinaigre', 'epicerie', 'ml', { b: 1, pk: [500] }],
  ['sucre', 'Sucre', 'epicerie', 'g', { b: 1, pk: [1000] }],
  ['farine', 'Farine', 'epicerie', 'g', { b: 1, al: ['gluten'], pk: [1000] }],
  ['epices', 'Épices & herbes séchées (paprika, curry, origan…)', 'epicerie', 'g', { b: 1, pk: [50] }],
  ['bouillon-cube', 'Bouillon (cubes)', 'epicerie', 'pc', { b: 1, al: ['celeri'], pk: [12] }],
  ['moutarde', 'Moutarde', 'epicerie', 'g', { b: 1, al: ['moutarde'], pk: [200] }],
  ['ketchup', 'Ketchup', 'epicerie', 'g', { b: 1, pk: [500] }],
  ['mayonnaise', 'Mayonnaise', 'epicerie', 'g', { b: 1, al: ['oeufs', 'moutarde'], t: ['oeuf'], pk: [300] }],
  ['ail', 'Ail', 'fruits-legumes', 'pc', { b: 1, pk: [1] }],
  ['oignon', 'Oignons', 'fruits-legumes', 'pc', { b: 1, pk: [1] }],
];

const ANIMAL_TAGS = ['viande', 'volaille', 'porc', 'poisson', 'crustace', 'mollusque', 'laitier', 'oeuf', 'miel', 'gelatine'];

export const INGREDIENTS = Object.fromEntries(
  RAW.map(([id, name, rayon, unit, o = {}]) => [
    id,
    {
      id,
      name,
      rayon,
      unit,
      basic: !!o.b,
      tags: o.t ?? [],
      allergens: o.al ?? [],
      packs: o.pk ?? [1],
      price: o.pr ?? 0,
      shelf: o.sh ?? 365,
      loc: o.loc ?? 'placard',
      protein: o.pro ?? null,
      match: o.m ? new RegExp(o.m) : null,
      exclude: o.x ? new RegExp(o.x) : null,
      sub: o.sub ?? [],
      animal: (o.t ?? []).some((t) => ANIMAL_TAGS.includes(t)),
    },
  ])
);

export const DEFAULT_BASICS = Object.values(INGREDIENTS).filter((i) => i.basic).map((i) => i.id);

/** Groupes pour les recettes flexibles (anti-gaspi) : l'ingrédient est choisi selon le stock et les promos. */
export const GROUPS = {
  legumes: ['carotte', 'courgette', 'poivron', 'tomate', 'champignons', 'brocoli', 'chou-fleur', 'poireau', 'epinards', 'aubergine', 'legumes-surgeles', 'petits-pois', 'legumes-wok'],
  fruits: ['pomme', 'banane', 'mandarine', 'kiwi', 'poire', 'orange'],
  poisson_pret: ['tataki-saumon', 'saumon-fume', 'saumon-filet'],
  charcuterie: ['jambon', 'charcuterie-mixte'],
  fromages: ['fromage-rape', 'fromage-tranches', 'mozzarella'],
  feculents: ['riz', 'pates'],
};

export const ingName = (id) => INGREDIENTS[id]?.name ?? id;

/** Produit d'un folder → ingrédient générique (premier motif qui correspond ; l'ordre de RAW compte). */
export const matchIngredient = (text, productMap = {}) => {
  const t = norm(text);
  if (productMap[t]) return productMap[t];
  for (const ing of Object.values(INGREDIENTS)) {
    if (ing.match && ing.match.test(t) && !(ing.exclude && ing.exclude.test(t))) return ing.id;
  }
  return null;
};

/** Rayon pour un produit non rattaché à un ingrédient (affichage « autres promos »). */
export const guessRayon = (text) => {
  const t = norm(text);
  if (/biere|vin |gin|whisky|coca|soda|boisson|jus |eau |ice tea|red bull|spa |limonade|cafe|the /.test(t)) return 'boissons';
  if (/lessive|papier|mouchoir|gel douche|deodorant|lames|vaisselle|adoucissant|shampo|soin|chats|allume-feu|bloc w|dentifrice/.test(t)) return 'maison';
  if (/fromage|yaourt|lait|beurre|creme|dessert/.test(t)) return 'laitier';
  if (/poulet|boeuf|porc|viande|saucisse|cerf|steak|roti/.test(t)) return 'boucherie';
  if (/poisson|saumon|crevette|scampi|eglefin|thon/.test(t)) return 'poissonnerie';
  if (/surgel|pizza|glace/.test(t)) return 'surgeles';
  if (/chips|biscuit|chocolat|praline|bonbon|snack|cafe|confiture|brioche|cereale/.test(t)) return 'epicerie';
  if (/salade|legume|fruit|pomme|poire|kiwi/.test(t)) return 'fruits-legumes';
  return 'autre';
};

/** Combine un format vendu en pack(s) : choisit la combinaison qui couvre `need` en gaspillant le moins. */
export const packsFor = (need, sizes) => {
  if (need <= 0) return { size: sizes[0] ?? 1, n: 0, total: 0 };
  let best = null;
  for (const s of sizes) {
    const n = Math.ceil(need / s - 1e-9);
    const total = n * s;
    if (!best || total < best.total - 1e-9 || (Math.abs(total - best.total) < 1e-9 && n < best.n)) best = { size: s, n, total };
  }
  return best;
};
