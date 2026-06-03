import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

const defaultLanguage = 'fr'; // default fallback

i18n
    .use(initReactI18next)
    .use(resourcesToBackend((language, namespace) => import(`./locales/${language}.json`)))
    .init({
        lng: defaultLanguage,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
