// P2-3 (a) : tests unitaires des parseurs extraits des page.evaluate() des
// scrapers Annuaire CI et GoAfrica. Ces fichiers s'exécutent dans le dépôt
// sans navigateur : les fonctions étant auto-portantes (elles ne référencent
// que `document` et leurs arguments), on les appelle ici sur le document
// jsdom — exactement le contrat que Playwright sérialise dans la vraie page.
// Aucun réseau, aucun binding natif.
import { describe, it, expect, beforeEach } from 'vitest';
// Environnement jsdom : celui par défaut de la config Vitest du dépôt.

const annuaire = require('../scrapers/parsers/annuaireCi');
const goAfrica = require('../scrapers/parsers/goAfrica');
const googleMaps = require('../scrapers/parsers/googleMaps');

describe('parsers/annuaireCi — resolveQueryLocation (pur)', () => {
    it('sépare la ville de la catégorie et construit l\'URL du répertoire', () => {
        const r = annuaire.resolveQueryLocation('Pharmacies de garde Abidjan');
        expect(r.city).toBe('abidjan');
        expect(r.categorySlug).toBe('pharmacies-de-garde');
        expect(r.baseUrl).toBe('https://annuaireci.com/categorie/pharmacies-de-garde/abidjan/');
    });

    it('normalise l\'accentuation de « soubré » vers le slug publié « soubre »', () => {
        const r = annuaire.resolveQueryLocation('restaurants soubré');
        expect(r.city).toBe('soubre');
        expect(r.baseUrl).toContain('/restaurants/soubre/');
    });

    it('rend une catégorie vide quand la requête n\'est que la ville', () => {
        const r = annuaire.resolveQueryLocation('  ABIDJAN ');
        expect(r.city).toBe('abidjan');
        expect(r.categorySlug).toBe('');
    });

    it('slugify retire accents, ponctuation et espaces multiples', () => {
        expect(annuaire.slugify('Cafés &  Thés — Bio')).toBe('cafes-thes-bio');
    });
});

describe('parsers/annuaireCi — extraction DOM', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('collectCompanyLinks ne retient que les fiches /entreprises/, dédupliquées', () => {
        document.body.innerHTML = `
            <div class="v2-card"><a href="https://annuaireci.com/entreprises/pharma-du-plateau">Fiche 1</a></div>
            <article><a href="https://annuaireci.com/entreprises/pharma-du-plateau">Fiche 1 (doublon)</a></article>
            <div class="v2-card"><a href="https://annuaireci.com/entreprises/pharma-marcory">Fiche 2</a></div>
            <div class="v2-card"><a href="https://annuaireci.com/blog/article">Pas une fiche</a></div>
        `;
        const links = annuaire.collectCompanyLinks();
        expect(links).toHaveLength(2);
        expect(links).toContain('https://annuaireci.com/entreprises/pharma-du-plateau');
        expect(links).toContain('https://annuaireci.com/entreprises/pharma-marcory');
    });

    it('extractCompanyDetails privilégie le JSON-LD LocalBusiness', () => {
        document.body.innerHTML = `
            <script type="application/ld+json">${JSON.stringify({
                '@type': 'LocalBusiness',
                name: 'Pharmacie du Plateau',
                telephone: '+225 27 22 44 55 66',
                email: 'contact@pharmacie-plateau.ci',
                address: { streetAddress: '12 Rue des Jardins', addressLocality: 'Abidjan' }
            })}</script>
            <h1>Autre nom qui ne doit pas gagner</h1>
        `;
        const d = annuaire.extractCompanyDetails();
        expect(d.name).toBe('Pharmacie du Plateau');
        expect(d.phone).toBe('+225 27 22 44 55 66');
        expect(d.email).toBe('contact@pharmacie-plateau.ci');
        expect(d.address).toBe('12 Rue des Jardins, Abidjan');
    });

    it('extractCompanyDetails gère un @graph et un tableau de schémas', () => {
        document.body.innerHTML = `
            <script type="application/ld+json">${JSON.stringify([
                { '@type': 'WebSite', name: 'Annuaire' },
                { '@type': 'Pharmacy', name: 'Pharma Cocody', telephone: '0504030201' }
            ])}</script>
            <script type="application/ld+json">${JSON.stringify({
                '@graph': [{ '@type': 'WebPage' }, { telephone: '0102030405', name: 'Fiche graph' }]
            })}</script>
        `;
        const d = annuaire.extractCompanyDetails();
        // Comportement historique conservé : chaque bloc JSON-LD est traité à
        // la suite, un schéma ultérieur complète/écrase les champs déjà lus.
        expect(d.name).toBe('Fiche graph');
        expect(d.phone).toBe('0102030405');
    });

    it('extractCompanyDetails retombe sur le DOM (tel:, h1, adresse, site, mailto)', () => {
        document.body.innerHTML = `
            <h1> Boulangerie Treichville </h1>
            <a href="tel:+2250141525354">Appeler</a>
            <span class="address">Rue du Commerce, Treichville</span>
            <a href="https://boulangerie-exemple.ci">Site</a>
            <a href="mailto:ventes@boulangerie-exemple.ci">ventes@boulangerie-exemple.ci</a>
        `;
        const d = annuaire.extractCompanyDetails();
        expect(d.name).toBe('Boulangerie Treichville');
        expect(d.phone).toContain('0141525354');
        expect(d.address).toBe('Rue du Commerce, Treichville');
        // href normalisé (chemin racine -> slash final), comme dans un navigateur
        expect(d.website).toBe('https://boulangerie-exemple.ci/');
        expect(d.email).toBe('ventes@boulangerie-exemple.ci');
    });

    it('extractCompanyDetails retrouve un numéro ivoirien dans le texte en dernier recours', () => {
        document.body.innerHTML = `
            <h1>Société sans lien tel</h1>
            <p>Pour nous joindre : 27 22 52 84 96 (bureau)</p>
        `;
        const d = annuaire.extractCompanyDetails();
        expect(d.name).toBe('Société sans lien tel');
        expect(d.phone).toBe('2722528496');
    });
});

describe('parsers/goAfrica — extraction DOM', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    const listing = `
        <article>
            <h2>Ets Kossi Distribution</h2>
            <a href="tel:+228 90 12 34 56">Gsm: +228 90 12 34 56</a>
            <span class="address">12 Avenue de la Liberté, Lomé</span>
            <a href="https://www.goafricaonline.com/tg/societe/ets-kossi-distribution-togo">fiche</a>
        </article>
        <article>
            <h2>Numéro trop court</h2>
            <a href="tel:9012345">90 12 34 5</a>
        </article>
    `;

    it('extractListingLeads nettoie l\'indicatif, déduit le lien fiche et ignore les numéros courts', () => {
        document.body.innerHTML = listing;
        const leads = goAfrica.extractListingLeads({ phoneCode: '228', countryName: 'Togo' });
        expect(leads).toHaveLength(1);
        const lead = leads[0];
        expect(lead.nom).toBe('Ets Kossi Distribution');
        expect(lead.numero).toBe('90123456');
        expect(lead.pays).toBe('Togo');
        expect(lead.source).toBe('Go Africa Online');
        expect(lead.details.adresse).toBe('12 Avenue de la Liberté, Lomé');
        expect(lead.details.companyUrl).toBe('https://www.goafricaonline.com/tg/societe/ets-kossi-distribution-togo');
    });

    it('extractListingLeads retire l\'indicatif ivoirien quand il est présent dans le numéro', () => {
        document.body.innerHTML = `
            <article>
                <h2>Atelier Bassam</h2>
                <a href="tel:+2250541582964">Tel: +225 05 41 58 29 64</a>
            </article>
        `;
        const leads = goAfrica.extractListingLeads({ phoneCode: '225', countryName: "Côte d'Ivoire" });
        expect(leads).toHaveLength(1);
        expect(leads[0].numero).toBe('0541582964');
        expect(leads[0].pays).toBe("Côte d'Ivoire");
    });

    it('extractCompanyExtraDetails lit le JSON-LD Organization puis exclut les réseaux sociaux en repli', () => {
        document.body.innerHTML = `
            <a href="https://www.facebook.com/quelquun">Facebook</a>
            <a href="https://www.goafricaonline.com/tg">Annuaire</a>
            <a href="https://www.ets-kossi.tg">Site officiel</a>
            <a href="mailto:contact@ets-kossi.tg">Mail</a>
        `;
        const d = goAfrica.extractCompanyExtraDetails();
        // jsdom (et les navigateurs) normalisent href : chemin racine -> slash final
        expect(d.website).toBe('https://www.ets-kossi.tg/');
        expect(d.email).toBe('contact@ets-kossi.tg');
    });

    it('extractCompanyExtraDetails préfère le JSON-LD aux liens de la page', () => {
        document.body.innerHTML = `
            <script type="application/ld+json">${JSON.stringify({
                '@type': 'Organization', url: 'https://officiel.tg', email: 'dir@officiel.tg'
            })}</script>
            <a href="https://un-autre-liet.tg">Autre</a>
        `;
        const d = goAfrica.extractCompanyExtraDetails();
        expect(d.website).toBe('https://officiel.tg');
        expect(d.email).toBe('dir@officiel.tg');
    });

    it('COUNTRY_NAMES couvre les pays servis par le scraper', () => {
        expect(goAfrica.COUNTRY_NAMES.ci).toBe("Côte d'Ivoire");
        expect(goAfrica.COUNTRY_NAMES.tg).toBe('Togo');
        expect(Object.keys(goAfrica.COUNTRY_NAMES).length).toBeGreaterThanOrEqual(15);
    });
});

describe('parsers/googleMaps — extraction d\'une fiche (R2)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('lit nom, téléphone, site et adresse, et nettoie téléphone et glyphe d\'icône', () => {
        document.body.innerHTML = `
            <h1> Boutique Wax Cocody </h1>
            <button data-item-id="phone:tel:+2250707070707">+225 07 07 07 07 07</button>
            <a data-item-id="authority" href="https://boutique-wax.ci/">boutique-wax.ci</a>
            <button data-item-id="address">\uE0C8\u200B Rue des Jardins, Abidjan</button>
        `;
        expect(googleMaps.extractPlaceDetails()).toEqual({
            name: 'Boutique Wax Cocody',
            phone: '+2250707070707',
            website: 'https://boutique-wax.ci/',
            address: 'Rue des Jardins, Abidjan'
        });
    });

    it('lit le téléphone dans aria-label quand le bouton n\'a pas de texte', () => {
        document.body.innerHTML = `
            <h1>Pressing Plateau</h1>
            <button aria-label="Téléphone: +225 27 20 21 22 23"></button>
        `;
        expect(googleMaps.extractPlaceDetails().phone).toBe('+2252720212223');
    });

    it('lit l\'adresse dans aria-label, sans le préfixe « Adresse: »', () => {
        document.body.innerHTML = `
            <h1>Pressing Plateau</h1>
            <button aria-label="Adresse: Boulevard de la République, Plateau"></button>
        `;
        expect(googleMaps.extractPlaceDetails().address).toBe('Boulevard de la République, Plateau');
    });

    it('respecte l\'ordre des sélecteurs : data-item-id avant aria-label', () => {
        document.body.innerHTML = `
            <h1>X</h1>
            <button aria-label="Phone: +33 1 00 00 00 00">+33 1 00 00 00 00</button>
            <button data-item-id="phone:tel:+2250101010101">01 01 01 01 01</button>
        `;
        expect(googleMaps.extractPlaceDetails().phone).toBe('0101010101');
    });

    it('prend le site par aria-label « Site Web » à défaut de data-item-id', () => {
        document.body.innerHTML = `<h1>X</h1><a aria-label="Site Web: exemple" href="https://exemple.ci">exemple</a>`;
        expect(googleMaps.extractPlaceDetails().website).toBe('https://exemple.ci');
    });

    it('rend un nom vide hors d\'une fiche, et des champs vides sans données', () => {
        document.body.innerHTML = '<div>Résultats</div>';
        expect(googleMaps.extractPlaceDetails()).toEqual({ name: '', phone: '', website: '', address: '' });
    });

    it('préfère innerText quand le navigateur le fournit — le texte masqué ne remonte pas', () => {
        // jsdom n'implémente pas innerText ; on simule ici ce que rend un vrai
        // navigateur, où le texte d'un élément masqué n'y figure pas.
        document.body.innerHTML = `<h1>Visible<span style="display:none"> masqué</span></h1>`;
        const h1 = document.querySelector('h1');
        expect(h1.textContent).toBe('Visible masqué');
        Object.defineProperty(h1, 'innerText', { get: () => 'Visible' });
        expect(googleMaps.extractPlaceDetails().name).toBe('Visible');
    });
});
