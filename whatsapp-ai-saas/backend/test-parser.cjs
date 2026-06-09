const {JSDOM} = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('goafrica-tg-annuaire.html', 'utf-8');
const dom = new JSDOM(html);
const doc = dom.window.document;

const links = Array.from(doc.querySelectorAll('a'));
const categories = links
    .filter(a => a.href.startsWith('/tg/annuaire/') && a.href.split('/').length === 4)
    .map(a => a.textContent.trim() + ' -> ' + a.href)
    .filter((v, i, a) => a.indexOf(v) === i && v.trim().length > 0);

console.log(`Found ${categories.length} categories:`);
console.log(categories.slice(0, 10).join('\n'));
