const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const DATA_FILE = path.join(__dirname, '../data/goafricaStructure.json');
const HTML_FILE = path.join(__dirname, '../goafrica-tg-annuaire.html');

const COUNTRIES = [
    { code: 'ci', name: 'Côte d\'Ivoire' },
    { code: 'tg', name: 'Togo' },
    { code: 'bj', name: 'Bénin' },
    { code: 'bf', name: 'Burkina Faso' },
    { code: 'cm', name: 'Cameroun' },
    { code: 'cg', name: 'Congo' },
    { code: 'cd', name: 'RD Congo' },
    { code: 'ga', name: 'Gabon' },
    { code: 'gn', name: 'Guinée' },
    { code: 'ml', name: 'Mali' },
    { code: 'ne', name: 'Niger' },
    { code: 'sn', name: 'Sénégal' }
];

async function generateStructure() {
    console.log('Generating Go Africa Online structure from local HTML...');
    
    const structure = {
        countries: COUNTRIES,
        categories: []
    };

    try {
        if (!fs.existsSync(HTML_FILE)) {
            console.error(`HTML file not found: ${HTML_FILE}`);
            return;
        }

        const html = fs.readFileSync(HTML_FILE, 'utf-8');
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        const categories = [];
        const headings = Array.from(doc.querySelectorAll('h3'));
        
        for (const heading of headings) {
            const categoryLinkEl = heading.querySelector('a');
            if (!categoryLinkEl) continue;

            const categoryName = categoryLinkEl.textContent.trim();
            const categorySlug = categoryLinkEl.href.split('/').pop();

            const subcategories = [];
            
            // The H3 is inside a div, the ul is also inside that same div
            const parentDiv = heading.closest('div');
            if (parentDiv) {
                const subLinks = parentDiv.querySelectorAll('ul li a');
                for (const link of subLinks) {
                    const subcatName = link.textContent.trim();
                    const subcatSlug = link.href.split('/').pop();
                    if (subcatName && subcatSlug) {
                        subcategories.push({ name: subcatName, slug: subcatSlug });
                    }
                }
            }

            categories.push({
                name: categoryName,
                slug: categorySlug,
                subcategories: subcategories
            });
        }

        if (categories.length > 0) {
            structure.categories = categories;
            console.log(`Extracted ${categories.length} categories with subcategories.`);
        } else {
            console.log("No categories found.");
        }

        const dataDir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(structure, null, 2), 'utf-8');
        console.log(`Successfully saved structure to ${DATA_FILE}`);

    } catch (error) {
        console.error('Error generating Go Africa structure:', error);
    }
}

generateStructure();
