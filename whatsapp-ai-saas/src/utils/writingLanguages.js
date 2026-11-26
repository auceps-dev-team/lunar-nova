/**
 * Langues de rédaction proposées par l'outil d'écriture.
 *
 * Jusqu'au 26/11/2026, la langue par défaut était « English (USA) » quelle
 * que soit la langue de l'interface — un utilisateur francophone obtenait de
 * l'anglais tant qu'il ne changeait pas la liste — et l'arabe, pourtant langue
 * de l'interface, n'était pas proposé.
 *
 * `value` est le libellé inséré dans la consigne envoyée à l'agent.
 */
export const WRITING_LANGUAGES = [
    { value: 'Français (France)', label: 'Français', locale: 'fr' },
    { value: 'English (USA)', label: 'English', locale: 'en' },
    { value: 'Español', label: 'Español', locale: 'es' },
    { value: 'العربية (Arabic)', label: 'العربية', locale: 'ar' },
];

/**
 * Langue de rédaction correspondant à la langue de l'interface (« fr »,
 * « en-US »…). Repli : le français, langue par défaut de l'application
 * (src/i18n.js).
 */
export function defaultWritingLanguage(locale) {
    const base = String(locale || '').toLowerCase().split(/[-_]/)[0];
    return (WRITING_LANGUAGES.find((l) => l.locale === base) || WRITING_LANGUAGES[0]).value;
}
