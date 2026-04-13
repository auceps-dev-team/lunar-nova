const fs = require('fs');
const path = require('path');

function walkSync(currentDirPath, callback) {
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
        var stat = fs.statSync(filePath);
        if (stat.isFile()) {
            callback(filePath, stat);
        } else if (stat.isDirectory()) {
            walkSync(filePath, callback);
        }
    });
}

walkSync('./src', function (filePath) {
    if (filePath.endsWith('.jsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        // also replace text-blue-, bg-blue-, border-blue-, ring-blue-
        if (content.includes('-blue-') || content.includes(':blue-') || content.match(/\bblue-\d{2,3}\b/)) {
            let newContent = content
                .replace(/-blue-/g, '-emerald-')
                .replace(/text-blue-/g, 'text-emerald-')
                .replace(/bg-blue-/g, 'bg-emerald-')
                .replace(/border-blue-/g, 'border-emerald-')
                .replace(/ring-blue-/g, 'ring-emerald-');
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Updated ' + filePath);
        }
    }
});
