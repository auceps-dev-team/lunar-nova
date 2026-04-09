import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { translations } from './locales';

// Convert locales format to i18next format
// i18next expects resources in format: { en: { translation: { key: "value" } } }
const resources = Object.keys(translations).reduce((acc, lang) => {
    acc[lang] = {
        translation: translations[lang]
    };
    return acc;
}, {});

// Try to get saved language from localStorage (Zustand persists there usually, but here it's IndexedDB)
// Since IndexedDB is async, we start with a default and let the store sync it later
const defaultLanguage = 'fr'; // default fallback

i18n
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
        resources,
        lng: defaultLanguage, // language to use, more will be handled by store sync
        fallbackLng: 'en', // use en if translation in specific language is not available

        interpolation: {
            escapeValue: false // react already safes from xss
        }
    });

export { translations };
export const getTranslation = (lang, key) => {
    return translations[lang]?.[key] || translations['en'][key] || key;
};

export default i18n;
