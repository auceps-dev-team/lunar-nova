/**
 * Règles de numérotation utilisées par les scrapers de prospection.
 *
 * Les trois scrapers implémentaient chacun leur propre détection des numéros
 * fixes, avec des résultats divergents :
 *   - annuaireCiScraper : préfixes ivoiriens en dur, uniquement sur 10 chiffres
 *   - goAfricaScraper   : table par pays, mais comparée AVANT retrait de
 *                         l'indicatif — voir le défaut corrigé plus bas
 *   - googleMapScraper  : liste blanche de préfixes mobiles, par pays, en dur
 *
 * Le défaut corrigé
 * L'ancienne comparaison de GoAfrica testait `numéro.startsWith(préfixe)` sur le
 * numéro complet. Or l'indicatif du Togo (228) commence par son propre préfixe
 * fixe (22), et celui du Cameroun (237) par le sien (23). Tout numéro togolais
 * ou camerounais écrit en format international était donc classé « fixe » et
 * écarté : sur ces deux pays, le filtrage supprimait la totalité des prospects.
 *
 * L'indicatif est désormais retiré avant toute comparaison.
 */

const COUNTRY_PHONE_CODES = {
    ci: '225', tg: '228', sn: '221', bj: '229', bf: '226',
    ml: '223', ne: '227', cm: '237', cg: '242', cd: '243',
    ga: '241', gn: '224', ma: '212', dz: '213', za: '27',
    fr: '33',
};

// Préfixes nationaux attribués aux lignes fixes.
const LANDLINE_PREFIXES = {
    ci: ['21', '25', '27'],
    tg: ['22', '23'],
    sn: ['33'],
    bj: ['21'],
    bf: ['20', '25'],
    cm: ['22', '23', '24', '33'],
    cg: ['22'],
    ga: ['01'],
    ma: ['05'],
    dz: ['02', '03', '04'],
    fr: ['01', '02', '03', '04', '05', '09'],
};

/** Ne conserve que les chiffres. */
function normalizeDigits(raw) {
    return String(raw ?? '').replace(/\D/g, '');
}

/**
 * Retire l'indicatif pays pour obtenir le numéro national.
 *
 * Le retrait n'a lieu que s'il reste ensuite un numéro de longueur plausible :
 * sans cette garde, un numéro national commençant par les mêmes chiffres que
 * son propre indicatif serait amputé.
 */
function toNationalNumber(raw, country) {
    const digits = normalizeDigits(raw);
    const code = COUNTRY_PHONE_CODES[String(country || '').toLowerCase()];
    if (!code || !digits.startsWith(code)) return digits;

    const rest = digits.slice(code.length);
    return rest.length >= 8 ? rest : digits;
}

/**
 * Indique si le numéro correspond à une ligne fixe connue du pays donné.
 *
 * Liste noire volontaire : seuls les préfixes explicitement attribués aux lignes
 * fixes écartent un numéro. Un préfixe inconnu est conservé — en prospection,
 * garder un numéro douteux coûte un appel, en écarter un bon coûte un client.
 *
 * @param {string} raw      Numéro tel qu'extrait de la page
 * @param {string} country  Code pays sur deux lettres (ci, tg, sn…)
 */
function isLandline(raw, country) {
    const prefixes = LANDLINE_PREFIXES[String(country || '').toLowerCase()];
    if (!prefixes || prefixes.length === 0) return false;

    const national = toNationalNumber(raw, country);
    if (!national) return false;

    return prefixes.some(prefix => national.startsWith(prefix));
}

/**
 * Déduit le pays d'un numéro écrit en format international.
 * Renvoie null si aucun indicatif connu ne correspond — le scraper retombe
 * alors sur le pays de la recherche en cours.
 *
 * Les indicatifs sont testés du plus long au plus court : « 225 » doit primer
 * sur « 22 » si les deux existaient.
 */
function detectCountry(raw) {
    const digits = normalizeDigits(raw);
    if (!digits) return null;

    const entries = Object.entries(COUNTRY_PHONE_CODES)
        .sort((a, b) => b[1].length - a[1].length);

    for (const [country, code] of entries) {
        if (digits.startsWith(code) && digits.length - code.length >= 8) return country;
    }
    return null;
}

module.exports = {
    COUNTRY_PHONE_CODES,
    LANDLINE_PREFIXES,
    normalizeDigits,
    toNationalNumber,
    isLandline,
    detectCountry,
};
