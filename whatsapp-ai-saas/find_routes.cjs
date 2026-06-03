const fs = require('fs');
const content = fs.readFileSync('backend/server.js', 'utf-8');

const regex = /app\.(get|post|put|delete)\(['"]([^'"]+)['"]/g;
let match;
const routes = [];
while ((match = regex.exec(content)) !== null) {
    routes.push(`${match[1].toUpperCase()} ${match[2]}`);
}

console.log(routes.join('\n'));
