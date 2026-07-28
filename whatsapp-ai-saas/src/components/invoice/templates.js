// Catalogue des modèles de facture.
//
// Séparé de TplThumb.jsx : un fichier qui exporte à la fois un composant et des
// constantes fait perdre le rafraîchissement à chaud de Vite, qui recharge alors
// le module entier à chaque modification.
export const TPL_PREVIEWS = [
    { id: 'clean', labelKey: 'templateModernClean', colors: ['#059669', '#ecfdf5', '#fff'] },
    { id: 'bold', labelKey: 'templateBoldHeader', colors: ['#1e293b', '#f8fafc', '#fff'] },
    { id: 'stripe', labelKey: 'templateVioletGold', colors: ['#3b1485', '#f7f7f9', '#c2a370'] },
];
