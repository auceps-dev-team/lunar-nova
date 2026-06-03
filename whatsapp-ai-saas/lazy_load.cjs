const fs = require('fs');

let content = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add Suspense to react import
if (!content.includes('{ Suspense }') && !content.includes(', Suspense')) {
    content = content.replace(/import React, { useState } from 'react';/, "import React, { useState, Suspense } from 'react';");
}

// 2. Replace component imports with React.lazy
const importsToLazy = [
    'Dashboard', 'AdvancedAnalytics', 'AgentsHub', 'TasksMap', 'InvoiceBuilder', 'Profile', 'ToolsBox', 'Settings', 'PhotoShoot', 'AgentManager', 'Support', 'AiChat', 'AiWriter', 'MyDocuments', 'ImageGeneration', 'ContactLists', 'Prospection', 'Segments', 'Contacts', 'ContactAdd', 'ContactImport', 'WordPressBridge'
];

importsToLazy.forEach(comp => {
    // Look for `import ComponentName from './path';`
    const regex = new RegExp(`import ${comp} from '([^']+)';`, 'g');
    content = content.replace(regex, `const ${comp} = React.lazy(() => import('$1'));`);
});

// ImageWorkspace has named import: `import { ImageWorkspace } from './components/image-editor/ImageWorkspace';`
// React.lazy requires default exports. If ImageWorkspace is not a default export, we can do:
// const ImageWorkspace = React.lazy(() => import('./components/image-editor/ImageWorkspace').then(m => ({ default: m.ImageWorkspace })));
content = content.replace(/import { ImageWorkspace } from '([^']+)';/, `const ImageWorkspace = React.lazy(() => import('$1').then(m => ({ default: m.ImageWorkspace })));`);

// 3. Wrap <Routes> with <Suspense fallback={<div className="p-8 flex items-center justify-center text-gray-500">Chargement...</div>}>
content = content.replace(/<Routes>/, `<Suspense fallback={<div className="h-full w-full flex items-center justify-center text-primary/60"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>}>\n                  <Routes>`);
content = content.replace(/<\/Routes>/, `</Routes>\n                </Suspense>`);

fs.writeFileSync('src/App.jsx', content, 'utf8');
console.log('App.jsx updated with lazy loading');
