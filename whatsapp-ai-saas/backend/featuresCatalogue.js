/**
 * Catalogue des fonctionnalités activables (Marketplace, ticket #30).
 *
 * Source unique : `features/catalogue.json`, lu aussi par l'interface. Ce
 * module ne fait que le charger et l'indexer ; il n'a aucune dépendance, pour
 * que db.js (migration, synchronisation) et features.js (état) puissent tous
 * deux le charger sans dépendance circulaire.
 *
 * Le fichier est hors de backend/ : il est embarqué par l'entrée
 * `features/**\/*` de package.json > build.files (vérifié par
 * featuresCatalogue.test.js).
 */
const catalogue = require('../features/catalogue.json');

const fonctionnalites = Object.freeze(catalogue.fonctionnalites.map((f) => Object.freeze({ ...f })));
const parId = new Map(fonctionnalites.map((f) => [f.id, f]));

// Les identifiants sont insérés tels quels dans des requêtes SQL (migration
// v13, synchronisation) : ils doivent rester des chaînes sans risque.
const ID_VALIDE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

module.exports = {
    versionCatalogue: catalogue.version,
    fonctionnalites,
    parId,
    ID_VALIDE
};
