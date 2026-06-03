const fs = require('fs');
const html = fs.readFileSync('annuaireci_dump.html', 'utf8');

// Regex fallback parsing
const articles = html.split('<article ');
console.log('Total articles:', articles.length - 1);

if (articles.length > 1) {
    const art = '<article ' + articles[1];
    
    // name
    const titleMatch = art.match(/<h[23][^>]*>(.*?)<\/h[23]>/) || art.match(/class="[^"]*title[^"]*"[^>]*>(.*?)</);
    console.log('Title Match:', titleMatch ? titleMatch[1].trim() : 'null');
    
    // phone
    const phoneMatch = art.match(/href="tel:([^"]+)"/);
    console.log('Phone Match:', phoneMatch ? phoneMatch[1] : 'null');
    
    // dump part of it
    console.log('Snippet:', art.substring(0, 1500));
}
