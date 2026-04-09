import fs from 'fs';

const files = [
    'src/pages/ToolsBox.jsx', 'src/pages/TasksMap.jsx', 'src/pages/Support.jsx',
    'src/pages/Settings.jsx', 'src/pages/PhotoShoot.jsx', 'src/pages/InvoiceBuilder.jsx',
    'src/pages/whatsapp/ContactLists.jsx', 'src/pages/Dashboard.jsx', 'src/pages/AiWriter.jsx',
    'src/pages/AiChat.jsx', 'src/pages/AgentsHub.jsx', 'src/pages/AdvancedAnalytics.jsx',
    'src/pages/whatsapp/Segments.jsx', 'src/components/Topbar.jsx', 'src/pages/whatsapp/Contacts.jsx',
    'src/components/Sidebar.jsx', 'src/components/WorkArea.jsx', 'src/components/image-editor/ImageEditor.jsx'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Replace imports
    // Handle both regular 't' and 't_helper'
    content = content.replace(/import\s+\{\s*getTranslation\s+as\s+(t|t_helper)\s*\}\s+from\s+['"](?:\.\.\/)+locales['"];?\n?/g, "import { useTranslation } from 'react-i18next';\n");
    content = content.replace(/import\s+\{\s*getTranslation\s+as\s+t\s*\}\s+from\s+['"]\.\/locales['"];?\n?/g, "import { useTranslation } from 'react-i18next';\n");

    // 2. Replace the usages of `t(language, 'key')` -> `t('key')`
    content = content.replace(/\b(?:t|t_helper)\s*\(\s*(?:language|uiLanguage)\s*,\s*(['"])(.*?)\1\s*\)/g, "t('$2')");
    content = content.replace(/\b(?:t|t_helper)\s*\(\s*(?:language|uiLanguage)\s*,\s*([a-zA-Z0-9_.]+)\s*\)/g, "t($1)");

    // 3. Add `const { t } = useTranslation();`
    // Find the first major component definition. It usually starts with `const Name = (` or `function Name(`
    // Let's do a simple approach:
    // Look for `useAppStore` call or `useState` call and put it just before that.
    // Or, look for the first `return (` inside a function and put it there if no hooks exist.
    // Let's try to match the first occurrence of `useAppStore` hook inside the component
    if (!content.includes('const { t } = useTranslation();')) {
        const match = content.match(/const\s+[a-zA-Z0-9_]+\s*=\s*useAppStore\(/);
        if (match) {
            content = content.replace(match[0], `const { t } = useTranslation();\n    ${match[0]}`);
        } else {
            // fallback: find `const [`, `useEffect(`, `useRef(`
            const fallbackMatch = content.match(/\s+const\s+\[/);
            if (fallbackMatch) {
                content = content.replace(fallbackMatch[0], `\n    const { t } = useTranslation();${fallbackMatch[0]}`);
            } else {
                console.log('Could not find injection point in ' + file);
            }
        }
    }

    fs.writeFileSync(file, content, 'utf8');
    console.log('Processed ' + file);
});
