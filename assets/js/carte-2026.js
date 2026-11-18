/* Cartes 2026 de La Marmite Express — source UNIQUE des prix de la caisse.
 *
 * Transcrit des PDF du restaurant, vérifiés visuellement le 18/11/2026 :
 *  - Boissons : marmite-carte-boissons/Carte_boissons_La_Marmite_Express.pdf (Canva « carte boissons 2026 menu », 10/11/2026)
 *  - Plats    : carte nourriture validée le 03/11/2026 (carte-marmite-express.original.pdf)
 * Rien n'est inventé : noms, descriptions et prix sont ceux imprimés. Seules
 * corrections d'orthographe de marque : « Jet 27/31 » → Get 27/31 ; doublon
 * « vanille » des sirops retiré. « Left » (bière 0 %) est repris tel qu'imprimé.
 *
 * Appliqué une seule fois par la caisse (marmite-express-caisse.html,
 * applyCarte2026) et au menu cloud par scripts/apply-carte-2026.mjs.
 * - items  : produits de la carte, DANS L'ORDRE d'affichage. `id` existant =
 *            produit mis à jour (photo, fiche détaillée, stock conservés) ;
 *            nouvel id = produit créé. `img` = reprendre la photo d'un ancien produit.
 * - retire : produits absents des nouvelles cartes → désactivés (pas supprimés,
 *            réactivables dans Admin → Produits).
 * La TVA n'est PAS modifiée (taux existants de la caisse conservés).
 */
(function (root) {
  const V3 = (a, b, c) => [{ label: '1 personne', price: a }, { label: '2 personnes', price: b }, { label: '3 personnes', price: c }];
  const GARN = 'Garniture au choix : pommes de terre sautées, salade, pâtes ou frites maison';
  const SAL = 'Salade, tomates, pommes de terre sautées';

  const CARTE = {
    version: '2026-11',
    newCats: [
      { id: 'cafes', name: 'Cafés', icon: '☕', noCuisine: true, after: 'softs' }
    ],
    items: [
      // ───────────── ENTRÉES ─────────────
      { id: 'p37', cat: 'entrees', section: 'Entrées', name: 'Salade de gésiers — entrée', sub: SAL + ', gésiers', price: 12 },
      { id: 'p38', cat: 'entrees', section: 'Entrées', name: "L'ardoise de charcuterie", sub: 'Pour 1, 2 ou 3 personnes · selon arrivages', price: 12, hasVariant: true, variants: V3(12, 20, 30) },
      { id: 'p39', cat: 'entrees', section: 'Entrées', name: "L'ardoise créole", sub: 'Pour 1, 2 ou 3 personnes · calamars, accras et beignets de morue', price: 12, hasVariant: true, variants: V3(12, 20, 30) },
      { id: 'p131', cat: 'entrees', section: 'Entrées', name: 'Escargots de Bourgogne', sub: "6 ou 12 pièces, au beurre d'escargot", price: 12, hasVariant: true, variants: [{ label: '6 pièces', price: 12 }, { label: '12 pièces', price: 18 }] },
      { id: 'p41', cat: 'entrees', section: 'Entrées', name: 'Os à moelle', sub: '20 min de cuisson', price: 12 },

      // ───────────── PLATS ─────────────
      { id: 'p43', cat: 'plats', section: 'Plats', keep: true }, // Plat du jour : fonction de la caisse, conservé tel quel
      { id: 'p46', cat: 'plats', section: 'Plats', name: "L'assiette de la mer", sub: 'Poisson du jour selon arrivage, calamars, crevettes et pesto maison à la pistache', price: 25 },
      { id: 'p47', cat: 'plats', section: 'Plats', name: 'Le burger maison', sub: 'Steak charolais haché maison ou steak végétarien, avocat, cheddar, oignons, salade', price: 17.5 },
      { id: 'p48', cat: 'plats', section: 'Plats', name: 'Le burger maison — version double', sub: 'Steak charolais haché maison ou steak végétarien, avocat, cheddar, oignons, salade', price: 22 },
      { id: 'p49', cat: 'plats', section: 'Plats', name: "Les côtes d'agneau", sub: GARN, price: 19.5 },
      { id: 'p120', cat: 'plats', section: 'Plats', name: "La bavette à l'échalote", sub: GARN, price: 17 },
      { id: 'p50', cat: 'plats', section: 'Plats', name: "L'entrecôte charolaise 300 g", sub: GARN + ' (sauce au choix)', price: 28 },
      { id: 'p51', cat: 'plats', section: 'Plats', name: 'La côte de bœuf 1 kg', sub: 'Garniture au choix : pommes de terre sautées, salade, pâtes, frites maison et légumes grillés de saison avec ses 3 sauces', price: 70 },
      { id: 'p52', cat: 'plats', section: 'Suppléments', name: 'Garniture supplémentaire', sub: '', price: 4 },
      { id: 'p132', cat: 'plats', section: 'Suppléments', name: 'Sauce supplémentaire', sub: '', price: 1 },

      // ───────────── SALADES ─────────────
      { id: 'p53', cat: 'salades', section: 'Salades', name: 'La Chèvre / Vegan', sub: SAL + ', lardons, toast de chèvre chaud / Vegan sans lardon + avocat', price: 17 },
      { id: 'p54', cat: 'salades', section: 'Salades', name: 'Salade de gésiers — plat', sub: SAL + ', gésiers', price: 17 },
      { id: 'p55', cat: 'salades', section: 'Salades', name: 'La Chicken', sub: SAL + ', poulet au curry', price: 18 },
      { id: 'p56', cat: 'salades', section: 'Salades', name: 'La Gourmande', sub: SAL + ', lardons, toast de chèvre chaud, gésiers', price: 19.5 },

      // ───────────── DESSERTS ─────────────
      { id: 'p57', cat: 'desserts', section: 'Desserts', name: 'Tarte de saison', sub: '', price: 7 },
      { id: 'p58', cat: 'desserts', section: 'Desserts', name: 'Crumble banane et Nutella', sub: 'Flambé au rhum', price: 9 },
      { id: 'p59', cat: 'desserts', section: 'Desserts', name: 'Crème brûlée maison', sub: '', price: 7 },
      { id: 'p121', cat: 'desserts', section: 'Desserts', name: 'Salade de fruits frais', sub: '', price: 8 },
      { id: 'p122', cat: 'desserts', section: 'Desserts', name: 'Blanc-manger coco', sub: '', price: 7 },
      { id: 'p60', cat: 'desserts', section: 'Desserts', name: 'Mousse au chocolat', sub: '', price: 7 },
      { id: 'p61', cat: 'desserts', section: 'Desserts', name: 'Tiramisu', sub: '', price: 9 },
      { id: 'p62', cat: 'desserts', section: 'Desserts', name: 'Café gourmand', sub: '', price: 9 },

      // ───────────── SOFTS ─────────────
      { id: 'p1', cat: 'softs', section: 'Softs', name: 'Sodas', sub: 'Coca, Coca 0, Orangina, Oasis, Ice tea, Fanta, Perrier, Arizona, Schweppes (agrumes ou tonic)', price: 4 },
      { id: 'p2', cat: 'softs', section: 'Softs', name: 'Sirops', sub: 'Anis, pomme verte, kiwi, fruit de la passion, citron, pamplemousse, cerise, orgeat, vanille, menthe, sucre de canne, figue, grenadine, pêche, violette', price: 3.5 },
      { id: 'p3', cat: 'softs', section: 'Softs', name: 'Jus', sub: 'Tomate, fraise, goyave, ananas, orange', price: 4 },
      { id: 'p4', cat: 'softs', section: 'Softs', name: 'Bière 0%', sub: 'Left, Desperados', price: 4 },
      { id: 'p5', cat: 'softs', section: 'Softs', name: 'Diabolo', sub: '', price: 3.5 },
      { id: 'p6', cat: 'softs', section: 'Softs', name: 'Mocktail', sub: '', price: 4.5 },
      { id: 'p7', cat: 'softs', section: 'Eaux', name: 'San Pellegrino 50cl', sub: '', price: 4 },
      { id: 'p8', cat: 'softs', section: 'Eaux', name: 'San Pellegrino 1L', sub: '', price: 5 },
      { id: 'p9', cat: 'softs', section: 'Eaux', name: 'Vittel 50cl', sub: '', price: 4 },
      { id: 'p130', cat: 'softs', section: 'Eaux', name: 'Vittel 1L', sub: '', price: 5, img: 'p9' },

      // ───────────── CAFÉS ─────────────
      { id: 'p140', cat: 'cafes', section: 'Cafés', name: 'Café', sub: '', price: 1.9 },
      { id: 'p141', cat: 'cafes', section: 'Cafés', name: 'Café allongé', sub: '', price: 2.2 },
      { id: 'p142', cat: 'cafes', section: 'Cafés', name: 'Café crème', sub: '', price: 2.5 },
      { id: 'p143', cat: 'cafes', section: 'Cafés', name: 'Double expresso', sub: '', price: 3.8 },
      { id: 'p144', cat: 'cafes', section: 'Cafés', name: 'Thé', sub: '', price: 3.5 },
      { id: 'p145', cat: 'cafes', section: 'Cafés', name: 'Chocolat', sub: '', price: 3 },

      // ───────────── BIÈRES ─────────────
      { id: 'p20', cat: 'alcools', section: 'Bières pression', name: 'Blonde 25cl', sub: 'Pression', price: 4 },
      { id: 'p150', cat: 'alcools', section: 'Bières pression', name: 'Blonde 33cl', sub: 'Pression', price: 5.5, img: 'p20', hasSirop: true },
      { id: 'p21', cat: 'alcools', section: 'Bières pression', name: 'Blonde 50cl', sub: 'Pression', price: 8 },
      { id: 'p22', cat: 'alcools', section: 'Bières pression', name: 'Blanche 25cl', sub: 'Pression', price: 4.5 },
      { id: 'p151', cat: 'alcools', section: 'Bières pression', name: 'Blanche 33cl', sub: 'Pression', price: 6.5, img: 'p22', hasSirop: true },
      { id: 'p23', cat: 'alcools', section: 'Bières pression', name: 'Blanche 50cl', sub: 'Pression', price: 9 },
      { id: 'p24', cat: 'alcools', section: 'Bières pression', name: 'Ambrée 25cl', sub: 'Pression', price: 4.5 },
      { id: 'p152', cat: 'alcools', section: 'Bières pression', name: 'Ambrée 33cl', sub: 'Pression', price: 6.5, img: 'p24', hasSirop: true },
      { id: 'p25', cat: 'alcools', section: 'Bières pression', name: 'Ambrée 50cl', sub: 'Pression', price: 9 },
      { id: 'p125', cat: 'alcools', section: 'Bières pression', name: 'Rouge 25cl', sub: 'Pression', price: 5 },
      { id: 'p153', cat: 'alcools', section: 'Bières pression', name: 'Rouge 33cl', sub: 'Pression', price: 7, img: 'p25b', hasSirop: true },
      { id: 'p25b', cat: 'alcools', section: 'Bières pression', name: 'Rouge 50cl', sub: 'Pression', price: 10 },
      { id: 'p66', cat: 'alcools', section: 'Bières pression', name: 'Picon 25cl', sub: 'Pression', price: 6.5 },
      { id: 'p154', cat: 'alcools', section: 'Bières pression', name: 'Picon 33cl', sub: 'Pression', price: 8.5, img: 'p66' },
      { id: 'p155', cat: 'alcools', section: 'Bières pression', name: 'Picon 50cl', sub: 'Pression', price: 10, img: 'p66' },
      { id: 'p26', cat: 'alcools', section: 'Bières bouteille', name: 'Desperados', sub: '', price: 5 },
      { id: 'p63', cat: 'alcools', section: 'Bières bouteille', name: 'Mort subite', sub: '', price: 5 },
      { id: 'p64', cat: 'alcools', section: 'Bières bouteille', name: 'Kriek cerise', sub: '', price: 5 },
      { id: 'p27', cat: 'alcools', section: 'Bières bouteille', name: 'Chimay blonde', sub: '', price: 5 },
      { id: 'p28', cat: 'alcools', section: 'Bières bouteille', name: 'Duvel', sub: '', price: 5 },
      { id: 'p65', cat: 'alcools', section: 'Bières bouteille', name: 'Black by Licorne', sub: '', price: 5 },
      { id: 'p29', cat: 'alcools', section: 'Bières aromatisées', name: 'Panaché', sub: '', price: 4 },
      { id: 'p30', cat: 'alcools', section: 'Bières aromatisées', name: 'Monaco', sub: '', price: 4 },

      // ───────────── APÉRITIFS ─────────────
      { id: 'p10', cat: 'alcools', section: 'Apéritifs', name: 'Ricard', sub: '', price: 4 },
      { id: 'p156', cat: 'alcools', section: 'Apéritifs', name: 'Pastis', sub: '', price: 4, img: 'p10' },
      { id: 'p11', cat: 'alcools', section: 'Apéritifs', name: 'Martini', sub: 'Rouge ou blanc', price: 4 },
      { id: 'p96', cat: 'alcools', section: 'Apéritifs', name: 'Vodka', sub: '', price: 6 },
      { id: 'p94', cat: 'alcools', section: 'Apéritifs', name: 'Whisky Clan Campbell', sub: '', price: 6 },
      { id: 'p93', cat: 'alcools', section: 'Apéritifs', name: "Whisky Jack Daniel's", sub: '', price: 7 },
      { id: 'p95', cat: 'alcools', section: 'Apéritifs', name: 'Whisky Aberlour', sub: '', price: 8 },
      { id: 'p69', cat: 'alcools', section: 'Apéritifs', name: 'Campari', sub: '', price: 4 },
      { id: 'p12', cat: 'alcools', section: 'Apéritifs', name: 'Kir tranquille', sub: '', price: 4 },
      { id: 'p67', cat: 'alcools', section: 'Apéritifs', name: 'Kir pétillant', sub: '', price: 5.5 },
      { id: 'p18', cat: 'alcools', section: 'Apéritifs', name: 'Shooter', sub: '', price: 3.5 },
      { id: 'p19', cat: 'alcools', section: 'Apéritifs', name: '1m de shooters', sub: '', price: 30 },

      // ───────────── COCKTAILS ─────────────
      { id: 'p13', cat: 'alcools', section: 'Cocktails', name: 'Mojito', sub: '', price: 8 },
      { id: 'p123', cat: 'alcools', section: 'Cocktails', name: 'La piscine de rosé', sub: '', price: 5 },
      { id: 'p14', cat: 'alcools', section: 'Cocktails', name: 'Aperol spritz', sub: '', price: 8 },
      { id: 'p15', cat: 'alcools', section: 'Cocktails', name: 'Sangria', sub: '', price: 6 },
      { id: 'p68', cat: 'alcools', section: 'Cocktails', name: 'Americano', sub: '', price: 7.5 },
      { id: 'p16', cat: 'alcools', section: 'Cocktails', name: 'Gin tonic', sub: '', price: 6 },
      { id: 'p17', cat: 'alcools', section: 'Cocktails', name: 'Cuba libre', sub: '', price: 7 },
      { id: 'p85', cat: 'alcools', section: 'Cocktails', name: 'Curaçao', sub: '', price: 8 },

      // ───────────── DIGESTIFS ─────────────
      { id: 'p82', cat: 'alcools', section: 'Digestifs', name: 'Get 27', sub: '', price: 6 },
      { id: 'p124', cat: 'alcools', section: 'Digestifs', name: 'Get 31', sub: '', price: 6 },
      { id: 'p87', cat: 'alcools', section: 'Digestifs', name: 'Poire', sub: '', price: 6 },
      { id: 'p86', cat: 'alcools', section: 'Digestifs', name: 'Menthe pastille', sub: '', price: 6 },
      { id: 'p92', cat: 'alcools', section: 'Digestifs', name: 'Rhum arrangé maison', sub: '', price: 6 },
      { id: 'p88', cat: 'alcools', section: 'Digestifs', name: 'Calvados', sub: '', price: 8 },
      { id: 'p90', cat: 'alcools', section: 'Digestifs', name: 'Armagnac', sub: '', price: 8 },
      { id: 'p91', cat: 'alcools', section: 'Digestifs', name: 'Rhum ambré', sub: '', price: 8 },
      { id: 'p83', cat: 'alcools', section: 'Digestifs', name: 'Baileys', sub: '', price: 8 },
      { id: 'p84', cat: 'alcools', section: 'Digestifs', name: 'Cointreau', sub: '', price: 8 },
      { id: 'p89', cat: 'alcools', section: 'Digestifs', name: 'Cognac', sub: '', price: 8 },

      // ───────────── VINS ROUGES ─────────────
      { id: 'p31', cat: 'alcools', section: 'Vins rouges', name: "L'Anthocyane (verre)", sub: 'IGP Val de Loire · 2025', price: 5 },
      { id: 'p105', cat: 'alcools', section: 'Vins rouges', name: "L'Anthocyane (bout.)", sub: 'IGP Val de Loire · 2025', price: 23 },
      { id: 'p160', cat: 'alcools', section: 'Vins rouges', name: 'Coteaux du Vendômois rouge (verre)', sub: 'AOC · Domaine du Four à Chaux 2025', price: 6 },
      { id: 'p161', cat: 'alcools', section: 'Vins rouges', name: 'Coteaux du Vendômois rouge (bout.)', sub: 'AOC · Domaine du Four à Chaux 2025', price: 26 },
      { id: 'p70', cat: 'alcools', section: 'Vins rouges', name: 'Chinon Cuvée Prestige (bout.)', sub: 'AOP · Pierre Chainier 2024', price: 27 },
      { id: 'p97', cat: 'alcools', section: 'Vins rouges', name: 'Saumur-Champigny (bout.)', sub: 'AOP · Château de Villeneuve 2023', price: 26 },
      { id: 'p101', cat: 'alcools', section: 'Vins rouges', name: 'Saint-Nicolas-de-Bourgueil (bout.)', sub: 'AOC · Vieilles Vignes 2025', price: 29 },
      { id: 'p32', cat: 'alcools', section: 'Vins rouges', name: 'Côte de Bœuf (verre)', sub: "IGP Pays d'Oc · Syrah-Marselan 2024", price: 6 },
      { id: 'p106', cat: 'alcools', section: 'Vins rouges', name: 'Côte de Bœuf (bout.)', sub: "IGP Pays d'Oc · Syrah-Marselan 2024", price: 26 },
      { id: 'p98', cat: 'alcools', section: 'Vins rouges', name: 'Côtes-du-Rhône (bout.)', sub: 'AOP · 2024', price: 26 },
      { id: 'p99', cat: 'alcools', section: 'Vins rouges', name: 'Graves (bout.)', sub: 'AOP · Château de Portets 2023', price: 32 },
      { id: 'p162', cat: 'alcools', section: 'Vins rouges', name: 'Saint-Émilion (bout.)', sub: "AOC · Château d'Arthus 2022", price: 38, img: 'p100' },
      { id: 'p163', cat: 'alcools', section: 'Vins rouges', name: 'Givry Premier Cru (bout.)', sub: 'AOC Bourgogne · 2024', price: 65 },
      { id: 'p102', cat: 'alcools', section: 'Vins rouges', name: 'Pauillac (bout.)', sub: 'AOC · Château Batailley 2020', price: 70 },
      { id: 'p164', cat: 'alcools', section: 'Vins rouges', name: 'Côte-Rôtie (bout.)', sub: 'AOC · Domaine Degache Frères 2023', price: 80 },

      // ───────────── VINS BLANCS ─────────────
      { id: 'p165', cat: 'alcools', section: 'Vins blancs', name: 'Bourgogne Chardonnay (verre)', sub: 'AOP · 2024', price: 5.5, img: 'p34' },
      { id: 'p166', cat: 'alcools', section: 'Vins blancs', name: 'Bourgogne Chardonnay (bout.)', sub: 'AOP · 2024', price: 24, img: 'p108' },
      { id: 'p167', cat: 'alcools', section: 'Vins blancs', name: 'Jasnières (verre)', sub: 'AOP · Cuvée particulière 2025', price: 7, img: 'p71' },
      { id: 'p168', cat: 'alcools', section: 'Vins blancs', name: 'Jasnières (bout.)', sub: 'AOP · Cuvée particulière 2025', price: 28, img: 'p72' },
      { id: 'p103', cat: 'alcools', section: 'Vins blancs', name: 'Chablis (bout.)', sub: 'AOC · 2024', price: 36 },
      { id: 'p169', cat: 'alcools', section: 'Vins blancs', name: 'Riesling (bout.)', sub: 'AOC · Greiner-Schleret 2024 · sec', price: 28 },
      { id: 'p170', cat: 'alcools', section: 'Vins blancs', name: 'Edelzwicker (verre)', sub: 'AOC · Greiner-Schleret 2024', price: 5.5 },
      { id: 'p33', cat: 'alcools', section: 'Vins blancs', name: 'Chardonnay moelleux (verre)', sub: 'IGP · Domaine du Four à Chaux 2024', price: 6 },
      { id: 'p107', cat: 'alcools', section: 'Vins blancs', name: 'Chardonnay moelleux (bout.)', sub: 'IGP · Domaine du Four à Chaux 2024', price: 26 },
      { id: 'p171', cat: 'alcools', section: 'Vins blancs', name: 'Gewurztraminer (bout.)', sub: 'AOC · Greiner-Schleret 2023 · moelleux', price: 29 },

      // ───────────── VINS ROSÉS ─────────────
      { id: 'p172', cat: 'alcools', section: 'Vins rosés', name: 'Méditerranée (verre)', sub: 'IGP · 2025', price: 5.5, img: 'p35' },
      { id: 'p173', cat: 'alcools', section: 'Vins rosés', name: 'Méditerranée (bout.)', sub: 'IGP · 2025', price: 24, img: 'p109' },
      { id: 'p174', cat: 'alcools', section: 'Vins rosés', name: 'Coteaux du Vendômois rosé (verre)', sub: 'AOC · Le Cocagne 2025', price: 5.5, img: 'p75' },
      { id: 'p175', cat: 'alcools', section: 'Vins rosés', name: 'Coteaux du Vendômois rosé (bout.)', sub: 'AOC · Le Cocagne 2025', price: 24, img: 'p76' },
      { id: 'p77', cat: 'alcools', section: 'Vins rosés', name: "Cabernet d'Anjou (verre)", sub: 'AOP · 2025', price: 5.5 },
      { id: 'p78', cat: 'alcools', section: 'Vins rosés', name: "Cabernet d'Anjou (bout.)", sub: 'AOP · 2025', price: 24 },
      { id: 'p104', cat: 'alcools', section: 'Vins rosés', name: 'Côtes-de-Provence (bout.)', sub: 'AOP · Charles Adelin 2024', price: 28 },

      // ───────────── PÉTILLANTS ─────────────
      { id: 'p79', cat: 'alcools', section: 'Pétillants', name: 'Vouvray Brut (verre)', sub: 'AOC · La Croix de Maunay', price: 6 },
      { id: 'p80', cat: 'alcools', section: 'Pétillants', name: 'Vouvray Brut (bout.)', sub: 'AOC · La Croix de Maunay', price: 24 },
      { id: 'p176', cat: 'alcools', section: 'Pétillants', name: 'Charme aux Dames (verre)', sub: 'Vin mousseux · Vignerons du Vendômois', price: 6, img: 'p79' },
      { id: 'p177', cat: 'alcools', section: 'Pétillants', name: 'Charme aux Dames (bout.)', sub: 'Vin mousseux · Vignerons du Vendômois', price: 24, img: 'p80' },
      { id: 'p36', cat: 'alcools', section: 'Pétillants', name: 'Champagne Nicolas Feuillatte (verre)', sub: 'Grande Réserve Brut', price: 9.5 },
      { id: 'p81', cat: 'alcools', section: 'Pétillants', name: 'Champagne Nicolas Feuillatte (bout.)', sub: 'Grande Réserve Brut', price: 62 }
    ],
    // Absents des cartes 2026 → désactivés (réactivables dans Admin → Produits)
    retire: ['p40', 'p42', 'p44', 'p45',          // Carpaccio burrata, Méchouia, Saumon frais, Poisson du jour
             'p34', 'p108', 'p71', 'p72', 'p73', 'p74', // Chardonnay sec, Jasnière Vert Galant / Cuvée Perrés
             'p35', 'p109', 'p75', 'p76', 'p100']   // Iles de Beauté, Montagne Blanche, Lussac St-Émilion
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CARTE;
  else root.CARTE_2026 = CARTE;
})(typeof window !== 'undefined' ? window : globalThis);
