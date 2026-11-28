/**
 * État des fonctionnalités activables (Marketplace, ticket #30).
 *
 * Le backend fait foi : l'état vit dans la table `features` (migration v13).
 * Ce module le lit et l'écrit en appliquant les règles du catalogue :
 * - une fonctionnalité du noyau n'est pas désactivable ;
 * - on n'active pas une fonctionnalité dont une dépendance est éteinte ;
 * - on n'éteint pas une fonctionnalité dont une autre, active, dépend.
 *
 * Pas de cache : chaque appel relit la table. Le serveur MCP et le CLI
 * tournent dans d'autres processus que l'application, et l'utilisateur peut
 * basculer une fonctionnalité pendant qu'ils sont ouverts. Une lecture
 * SQLite locale par appel ne coûte presque rien.
 *
 * Aucune voie d'accès externe (outil MCP, commande CLI) ne doit appeler
 * `definir` : seul l'utilisateur, depuis l'application, change l'état.
 */
const db = require('./db');
const { fonctionnalites, parId } = require('./featuresCatalogue');

class ErreurFonctionnalite extends Error {
    /**
     * @param {string} code FEATURE_UNKNOWN, FEATURE_CORE, FEATURE_DEPENDENCIES_DISABLED, FEATURE_REQUIRED_BY
     * @param {number} statut statut HTTP à renvoyer
     * @param {string} message
     * @param {object} [details] ids concernés (dependances, dependantes)
     */
    constructor(code, statut, message, details = {}) {
        super(message);
        this.code = code;
        this.statut = statut;
        this.details = details;
    }
}

function fonctionnalite(id) {
    const f = parId.get(id);
    if (!f) throw new ErreurFonctionnalite('FEATURE_UNKNOWN', 404, `Fonctionnalité inconnue : « ${id} ».`, { feature: id });
    return f;
}

async function lireTable() {
    await db.initDB();
    const { rows } = await db.pool.query('SELECT id, enabled FROM features');
    return new Map(rows.map((r) => [r.id, Number(r.enabled) === 1]));
}

const activeDans = (table, f) => (f.noyau ? true : (table.has(f.id) ? table.get(f.id) : f.defaut));

/**
 * Le catalogue, dans son ordre, avec l'état de chaque fonctionnalité.
 * @returns {Promise<Array<object>>}
 */
async function etat() {
    const table = await lireTable();
    return fonctionnalites.map((f) => ({ ...f, enabled: activeDans(table, f) }));
}

/**
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function estActive(id) {
    const f = fonctionnalite(id);
    if (f.noyau) return true;
    return activeDans(await lireTable(), f);
}

/**
 * Active ou désactive une fonctionnalité, après contrôle des règles.
 * @param {string} id
 * @param {boolean} enabled
 * @returns {Promise<object>} la fonctionnalité avec son nouvel état
 * @throws {ErreurFonctionnalite}
 */
async function definir(id, enabled) {
    const f = fonctionnalite(id);
    if (typeof enabled !== 'boolean') {
        throw new TypeError('`enabled` doit être un booléen.');
    }
    if (f.noyau) {
        if (!enabled) {
            throw new ErreurFonctionnalite('FEATURE_CORE', 409, `« ${id} » fait partie du noyau : elle ne peut pas être désactivée.`, { feature: id });
        }
        return { ...f, enabled: true };
    }

    const table = await lireTable();
    if (enabled) {
        const eteintes = f.dependances.filter((d) => !activeDans(table, fonctionnalite(d)));
        if (eteintes.length) {
            throw new ErreurFonctionnalite(
                'FEATURE_DEPENDENCIES_DISABLED', 409,
                `« ${id} » nécessite : ${eteintes.join(', ')}. Activez-les d'abord.`,
                { feature: id, dependances: eteintes }
            );
        }
    } else {
        const dependantes = fonctionnalites
            .filter((autre) => autre.dependances.includes(id) && activeDans(table, autre))
            .map((autre) => autre.id);
        if (dependantes.length) {
            throw new ErreurFonctionnalite(
                'FEATURE_REQUIRED_BY', 409,
                `« ${id} » est requise par : ${dependantes.join(', ')}. Désactivez-les d'abord.`,
                { feature: id, dependantes }
            );
        }
    }

    await db.pool.query(
        `INSERT INTO features (id, enabled, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`,
        [id, enabled ? 1 : 0]
    );
    return { ...f, enabled };
}

module.exports = { etat, estActive, definir, ErreurFonctionnalite };
