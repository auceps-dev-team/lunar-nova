const fs = require('fs');
const path = require('path');

const licenseText = `CONDITIONS GENERALES D'UTILISATION (CGU) - WACOPILOTE

Dernière mise à jour : Avril 2026

Bienvenue sur WaCopilote. En installant et en utilisant ce logiciel, vous acceptez d'être lié par les présentes Conditions Générales d'Utilisation.

1. OBJET
Les présentes CGU ont pour objet de définir les modalités de mise à disposition de l'application WaCopilote, un outil d'automatisation et d'assistance par intelligence artificielle.

2. PROTECTION DES DONNEES ET RGPD
La protection de vos données est notre priorité. Conformément au Règlement Général sur la Protection des Données (RGPD) :
- Aucune donnée personnelle de vos contacts ou conversations WhatsApp n'est collectée, vendue ou transmise à des tiers par WaCopilote.
- La base de données contenant vos informations (contacts, messages, historiques) est stockée **exclusivement et localement** sur votre ordinateur.
- Les requêtes adressées à l'intelligence artificielle (Gemini) sont traitées via des API sécurisées. Vous contrôlez les clés API utilisées (si renseignées localement).

3. LICENCE D'UTILISATION
WaCopilote vous est concédé sous licence, et non vendu. Cette licence vous confère un droit d'utilisation personnel, non exclusif et non transférable. Il est strictement interdit de :
- Décompiler, désassembler ou procéder à l'ingénierie inverse du logiciel.
- Redistribuer ou revendre l'application.

4. RESPONSABILITES
WaCopilote est fourni "en l'état". L'utilisation de cet outil pour automatiser des actions sur WhatsApp doit se faire dans le respect des conditions d'utilisation de WhatsApp Inc. L'équipe de WaCopilote décline toute responsabilité en cas de blocage, de restriction de votre compte WhatsApp ou de tout dommage indirect découlant de l'utilisation du logiciel.

5. MISES A JOUR
L'application se mettra à jour de façon transparente afin de garantir la sécurité et l'amélioration de ses fonctionnalités.

En cliquant sur "J'accepte", vous confirmez avoir lu et compris l'intégralité de ces conditions, notamment vos droits liés à la confidentialité de vos données locales.`;

// Write with UTF-8 BOM
const filePath = path.join(__dirname, 'build', 'license.txt');
fs.writeFileSync(filePath, '\uFEFF' + licenseText, 'utf8');
console.log('License file created with UTF-8 BOM successfully.');