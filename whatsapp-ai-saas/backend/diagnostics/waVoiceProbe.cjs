#!/usr/bin/env node
/**
 * Sonde A1 — les notes vocales sont-elles visibles par l'observateur de commandes ?
 *
 * `orderListener.attachObserver` ne remonte que les nœuds portant
 * `.copyable-text[data-pre-plain-text]` (orderListener.js ~l.312). Les messages
 * audio de WhatsApp Web ne portent probablement pas cet attribut — mais c'est
 * une déduction de lecture, pas une mesure. Cette sonde la transforme en fait.
 *
 * Elle répond à trois questions en une exécution :
 *   1. Un vocal apparaît-il dans le DOM, et sous quelle forme ?
 *   2. Porte-t-il `[data-pre-plain-text]` — donc l'observateur actuel le voit-il ?
 *   3. Les octets audio sont-ils récupérables depuis le blob, en contexte page ?
 *
 * CONFIDENTIALITÉ — cette sonde tourne sur de vraies conversations. Elle ne
 * remonte jamais de contenu : ni texte de message, ni nom de contact, ni numéro.
 * Uniquement des structures (balises, attributs, testids) et des longueurs.
 * C'est la règle du CONTRIBUTING sur les captures de pages.
 *
 * USAGE
 *   1. Lancer WaCopilote, connecter une instance WhatsApp.
 *   2. S'envoyer une note vocale dans n'importe quelle conversation, puis
 *      ouvrir cette conversation (le message doit être à l'écran).
 *   3. node backend/diagnostics/waVoiceProbe.cjs
 *
 * Options
 *   --rows N        nombre de lignes de message à inspecter (défaut : 25)
 *   --fetch-blob    tente aussi de récupérer les octets audio (question 3)
 *   --deep          inspecte la structure d'une ligne vocale, sans interaction
 *   --json          sortie JSON brute, pour archivage
 *
 * Ce fichier est de l'instrumentation, pas du produit : il n'est branché ni au
 * CLI ni au serveur. A1 est tranché (19/09/2026), mais il reste l'outil pour
 * re-mesurer quand WhatsApp Web changera de structure — voiceNoteService et la
 * détection de orderListener dépendent d'ancres internes (`ptt-status`,
 * `conv-msg-<id>`, fibre React) qu'une refonte cassera.
 *
 * LIMITE CONNUE — la question 2 ne teste que l'ancre historique de
 * l'observateur. Celui-ci en a deux autres ([data-id], div[role="row"]) :
 * « vu par l'observateur : non » ne veut donc PAS dire que la ligne lui échappe
 * (erreur d'interprétation faite le 19/09, corrigée le 01/10).
 */

const puppeteer = require('puppeteer-core');

const CDP_URL = process.env.WACOPILOTE_CDP_URL || 'http://127.0.0.1:8315';

const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const numArg = (f, def) => {
    const i = args.indexOf(f);
    if (i === -1 || !args[i + 1]) return def;
    const n = Number(args[i + 1]);
    return Number.isFinite(n) && n > 0 ? n : def;
};

const ROWS = numArg('--rows', 25);
const FETCH_BLOB = hasFlag('--fetch-blob');
const AS_JSON = hasFlag('--json');
const DEEP = hasFlag('--deep');

const c = {
    dim: (s) => `\x1b[90m${s}\x1b[0m`,
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`
};

/**
 * Inspecte le DOM des dernières lignes de message.
 *
 * Exécuté dans le contexte de la page : pas d'accès aux modules Node, et tout
 * ce qui sort d'ici traverse la frontière CDP — d'où la discipline de ne
 * renvoyer que des métadonnées.
 */
function inspectRows(maxRows) {
    const rows = Array.from(document.querySelectorAll('div[role="row"]')).slice(-maxRows);

    // Ce que l'observateur de orderListener sélectionne aujourd'hui.
    const OBSERVER_SELECTOR = '.copyable-text[data-pre-plain-text]';

    const describe = (row, index) => {
        const audios = Array.from(row.querySelectorAll('audio'));
        const testids = Array.from(row.querySelectorAll('[data-testid]'))
            .map((el) => el.getAttribute('data-testid'))
            .filter(Boolean);
        const dataIdEl = row.querySelector('[data-id]');
        const dataId = dataIdEl ? dataIdEl.getAttribute('data-id') : null;

        // `data-id` a la forme `false_<jid>@c.us_<hash>` (entrant) ou `true_…`
        // (sortant). Le JID contient le numéro : on n'en garde que la direction.
        let direction = null;
        if (dataId) direction = dataId.startsWith('true_') ? 'sortant' : 'entrant';

        const observerNode = row.matches(OBSERVER_SELECTOR)
            ? row
            : row.querySelector(OBSERVER_SELECTOR);

        const textNode = row.querySelector('span.selectable-text, span.copyable-text, span[dir="ltr"]');

        return {
            index,
            direction,
            // Longueur seulement, jamais le texte.
            textLength: textNode && textNode.innerText ? textNode.innerText.length : 0,
            vuParLObservateur: Boolean(observerNode),
            audio: audios.map((a) => ({
                src: a.getAttribute('src') || '',
                schemeSrc: (a.getAttribute('src') || '').split(':')[0] || '(vide)',
                duration: Number.isFinite(a.duration) ? Math.round(a.duration * 10) / 10 : null,
                hasSourceChild: Boolean(a.querySelector('source'))
            })),
            // Signaux qui trahissent un vocal même sans balise <audio> montée.
            indices: {
                boutonLecture: Boolean(row.querySelector('[data-icon="audio-play"], [data-icon="ptt-play"], button[aria-label*="lecture" i], button[aria-label*="play" i]')),
                iconePtt: Boolean(row.querySelector('[data-icon*="ptt"], [data-icon*="mic"]')),
                waveform: Boolean(row.querySelector('svg[class*="wave" i], canvas')),
                telechargement: Boolean(row.querySelector('[data-icon="audio-download"], [data-icon="download"]'))
            },
            testids: Array.from(new Set(testids)).slice(0, 12),
            // Empreinte de structure : utile pour reconnaître le gabarit sans
            // rien divulguer.
            balises: Array.from(new Set(
                Array.from(row.querySelectorAll('*')).map((el) => el.tagName.toLowerCase())
            )).sort().join(',')
        };
    };

    return {
        totalRows: document.querySelectorAll('div[role="row"]').length,
        observerSelector: OBSERVER_SELECTOR,
        vusParLObservateur: document.querySelectorAll(OBSERVER_SELECTOR).length,
        rows: rows.map(describe)
    };
}

/**
 * Inspection approfondie d'une ligne vocale, sans interaction.
 *
 * Le premier relevé a montré qu'aucune balise <audio> n'est montée tant que
 * l'utilisateur n'a pas appuyé sur lecture : WhatsApp ne déchiffre le média
 * qu'à la demande. Cette fonction cherche donc par où les octets pourraient
 * sortir **sans** simuler de clic — un clic marquerait le vocal comme écouté
 * dans la vraie conversation de l'interlocuteur.
 *
 * Toujours aucune donnée personnelle : on ne remonte que des noms de balises,
 * d'attributs et des schémas d'URL.
 */
function deepInspect(testId) {
    const row = Array.from(document.querySelectorAll('div[role="row"]'))
        .find((r) => r.querySelector(`[data-testid="${testId}"]`) || r.getAttribute('data-testid') === testId);
    if (!row) return { trouve: false };

    const noms = new Set();
    const attributs = new Set();
    const schemasUrl = new Set();
    const boutons = [];

    for (const el of row.querySelectorAll('*')) {
        noms.add(el.tagName.toLowerCase());
        for (const a of el.attributes) {
            attributs.add(a.name);
            // Repère toute URL exploitable, quel que soit l'attribut.
            if (/^(blob|data|https?):/.test(a.value)) {
                schemasUrl.add(`${a.name}=${a.value.split(':')[0]}:`);
            }
        }
        if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
            boutons.push({
                ariaLabel: (el.getAttribute('aria-label') || '').slice(0, 40),
                dataIcon: el.querySelector('[data-icon]')?.getAttribute('data-icon')
                    || el.getAttribute('data-icon') || null,
                testid: el.getAttribute('data-testid') || null
            });
        }
    }

    // Une poignée interne exposée par WhatsApp Web permettrait de récupérer le
    // média sans passer par le DOM. On regarde si quelque chose est visible.
    const globalesInteressantes = ['Store', 'WWebJS', 'require', 'webpackChunkwhatsapp_web_client', '__debug']
        .filter((k) => typeof window[k] !== 'undefined');

    return {
        trouve: true,
        balises: Array.from(noms).sort().join(','),
        attributs: Array.from(attributs).sort().join(','),
        schemasUrl: Array.from(schemasUrl),
        boutons,
        globalesInteressantes,
        // Les clés React/propriétés internes attachées au nœud : parfois une
        // voie d'accès au modèle de message.
        clesInternes: Object.keys(row).filter((k) => k.startsWith('__react') || k.startsWith('__')).slice(0, 6)
    };
}

/**
 * Question 3 : les octets sont-ils atteignables ?
 * On ne rapatrie pas l'audio — seulement sa taille et son nombre magique, qui
 * suffit à identifier le conteneur (OggS = Ogg/Opus, ftyp = MP4/M4A).
 */
function probeBlob(srcUrl) {
    return fetch(srcUrl)
        .then((r) => r.arrayBuffer())
        .then((buf) => {
            const head = new Uint8Array(buf.slice(0, 12));
            const ascii = Array.from(head)
                .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
                .join('');
            const hex = Array.from(head)
                .map((b) => b.toString(16).padStart(2, '0'))
                .join(' ');
            return { ok: true, octets: buf.byteLength, magieAscii: ascii, magieHex: hex };
        })
        .catch((e) => ({ ok: false, erreur: String(e && e.message ? e.message : e) }));
}

async function main() {
    let browser;
    try {
        browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });
    } catch (err) {
        console.error(c.red(`\nImpossible de joindre le navigateur sur ${CDP_URL}.`));
        console.error(c.dim('  Lancez WaCopilote et connectez une instance WhatsApp, puis réessayez.'));
        console.error(c.dim(`  Détail : ${err.message}`));
        process.exit(1);
    }

    // WhatsApp tourne dans un <webview> Electron : `browser.pages()` ne renvoie
    // que les cibles de type `page` et les ignore. On passe par `targets()`,
    // comme orderListener.attachObserver (orderListener.js ~l.122).
    const targets = await browser.targets();
    const candidates = [];
    for (const target of targets) {
        if (target.type() !== 'webview') continue;
        if (!/whatsapp/i.test(target.url())) continue;
        let p = null;
        try { p = await target.page(); } catch { /* cible non attachable */ }
        if (!p) continue;
        let instanceId = null;
        try { instanceId = await p.evaluate(() => window.__whatsapp_instance_id || null); } catch { /* frame détachée */ }
        candidates.push({ page: p, instanceId });
    }

    if (candidates.length === 0) {
        console.error(c.red('\nAucune page web.whatsapp.com trouvée dans le navigateur piloté.'));
        console.error(c.dim('  Ouvrez une instance WhatsApp dans WaCopilote, puis réessayez.'));
        browser.disconnect();
        process.exit(1);
    }

    const rapport = { cdp: CDP_URL, date: new Date().toISOString(), instances: [] };

    for (const { page, instanceId } of candidates) {
        let inspection;
        try {
            inspection = await page.evaluate(inspectRows, ROWS);
        } catch (err) {
            rapport.instances.push({ instanceId, erreur: err.message });
            continue;
        }

        const vocaux = inspection.rows.filter(
            (r) => r.audio.length > 0 || r.indices.boutonLecture || r.indices.iconePtt
        );

        if (DEEP && vocaux.length > 0) {
            for (const v of vocaux) {
                const ancre = v.testids.find((t) => t.startsWith('conv-msg-')) || v.testids[0];
                if (!ancre) continue;
                try {
                    v.profond = await page.evaluate(deepInspect, ancre);
                } catch (err) {
                    v.profond = { trouve: false, erreur: err.message };
                }
            }
        }

        if (FETCH_BLOB && vocaux.length > 0) {
            const avecSrc = vocaux.find((r) => r.audio.some((a) => a.src));
            if (avecSrc) {
                const src = avecSrc.audio.find((a) => a.src).src;
                try {
                    avecSrc.blob = await page.evaluate(probeBlob, src);
                } catch (err) {
                    avecSrc.blob = { ok: false, erreur: err.message };
                }
            }
        }

        rapport.instances.push({ instanceId, ...inspection, nbVocauxDetectes: vocaux.length, vocaux });
    }

    browser.disconnect();

    if (AS_JSON) {
        console.log(JSON.stringify(rapport, null, 2));
        return;
    }

    console.log(`\n${c.bold('Sonde A1 — visibilité des notes vocales')}  ${c.dim(rapport.date)}`);

    for (const inst of rapport.instances) {
        console.log(`\n${c.cyan('Instance')} ${inst.instanceId || c.dim('(sans identifiant)')}`);

        if (inst.erreur) {
            console.log(`  ${c.red('Erreur :')} ${inst.erreur}`);
            continue;
        }

        console.log(`  Lignes de message dans le DOM   : ${inst.totalRows} ${c.dim(`(${ROWS} dernières inspectées)`)}`);
        console.log(`  Vues par l'observateur actuel   : ${inst.vusParLObservateur}  ${c.dim(inst.observerSelector)}`);
        console.log(`  Vocaux repérés par la sonde     : ${inst.nbVocauxDetectes}`);

        if (inst.nbVocauxDetectes === 0) {
            console.log(`\n  ${c.yellow('Aucun vocal dans les lignes inspectées.')}`);
            console.log(c.dim('  Envoyez-vous une note vocale, ouvrez la conversation, relancez.'));
            console.log(c.dim(`  Au besoin, élargissez la fenêtre : --rows ${ROWS * 2}`));
            continue;
        }

        console.log(`\n  ${c.bold('Réponse à la question A1')}`);
        const vusQuandMeme = inst.vocaux.filter((v) => v.vuParLObservateur);
        if (vusQuandMeme.length === 0) {
            console.log(`  ${c.green('CONFIRMÉ')} — aucun des ${inst.nbVocauxDetectes} vocaux ne porte ${inst.observerSelector}.`);
            console.log(c.dim("  L'observateur de commandes est structurellement aveugle aux vocaux."));
        } else {
            console.log(`  ${c.red('INFIRMÉ')} — ${vusQuandMeme.length}/${inst.nbVocauxDetectes} vocaux portent déjà le sélecteur.`);
            console.log(c.dim("  Le chantier A change de forme : la piste n'est pas l'invisibilité."));
        }

        for (const v of inst.vocaux) {
            console.log(`\n  ${c.dim('—')} ligne #${v.index} ${c.dim(`(${v.direction || 'direction inconnue'})`)}`);
            console.log(`    vu par l'observateur : ${v.vuParLObservateur ? c.red('oui') : c.green('non')}`);
            console.log(`    longueur de texte    : ${v.textLength} ${c.dim('(caractères, contenu non remonté)')}`);
            if (v.audio.length > 0) {
                for (const a of v.audio) {
                    console.log(`    <audio> src          : ${a.schemeSrc}: ${c.dim(a.src ? `(${a.src.length} car.)` : '(vide)')}`);
                    if (a.duration !== null) console.log(`    durée                : ${a.duration}s`);
                }
            } else {
                console.log(`    ${c.yellow('aucune balise <audio> montée')} ${c.dim('— repéré par icône/bouton')}`);
            }
            const ind = Object.entries(v.indices).filter(([, on]) => on).map(([k]) => k);
            console.log(`    indices              : ${ind.length ? ind.join(', ') : c.dim('aucun')}`);
            if (v.testids.length) console.log(`    data-testid          : ${v.testids.join(', ')}`);
            if (v.profond && v.profond.trouve) {
                const d = v.profond;
                console.log(`    ${c.bold('structure interne')}`);
                console.log(`      balises            : ${d.balises}`);
                console.log(`      URL exploitables   : ${d.schemasUrl.length ? d.schemasUrl.join(', ') : c.yellow('aucune')}`);
                console.log(`      boutons            : ${d.boutons.map((b) => b.dataIcon || b.testid || b.ariaLabel || '?').join(', ') || c.dim('aucun')}`);
                console.log(`      globales WhatsApp  : ${d.globalesInteressantes.length ? d.globalesInteressantes.join(', ') : c.yellow('aucune')}`);
                console.log(`      clés internes      : ${d.clesInternes.length ? d.clesInternes.join(', ') : c.dim('aucune')}`);
            }

            if (v.blob) {
                console.log(`\n    ${c.bold('Question 3 — octets récupérables ?')}`);
                if (v.blob.ok) {
                    console.log(`    ${c.green('OUI')} — ${v.blob.octets} octets, entête « ${v.blob.magieAscii} » ${c.dim(`[${v.blob.magieHex}]`)}`);
                } else {
                    console.log(`    ${c.red('NON')} — ${v.blob.erreur}`);
                }
            }
        }

        if (!FETCH_BLOB) {
            console.log(`\n  ${c.dim('Question 3 non testée. Relancez avec --fetch-blob pour tenter la récupération des octets.')}`);
        }
    }

    console.log(`\n${c.dim('Aucun contenu de message, nom ou numéro ne figure dans ce rapport.')}\n`);
}

main().catch((err) => {
    console.error(c.red(`\nÉchec de la sonde : ${err.message}`));
    process.exit(1);
});
