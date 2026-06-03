const fs = require('fs');

let content = fs.readFileSync('src/pages/whatsapp/Contacts.jsx', 'utf8');

// 1. Update React import
if (!content.includes('useMemo')) {
    content = content.replace(
        "import React, { useState, useEffect, useRef } from 'react';",
        "import React, { useState, useEffect, useRef, useMemo } from 'react';"
    );
}

// 2. Wrap segments/lists mapping in useMemo
content = content.replace(
    /const uniqueSegments = \[\.\.\.new Set\(contacts\.map\(c => c\.segment_name\)\.filter\(Boolean\)\)\];/,
    "const uniqueSegments = useMemo(() => [...new Set(contacts.map(c => c.segment_name).filter(Boolean))], [contacts]);"
);
content = content.replace(
    /const uniqueLists = \[\.\.\.new Set\(contacts\.map\(c => c\.list_name\)\.filter\(Boolean\)\)\];/,
    "const uniqueLists = useMemo(() => [...new Set(contacts.map(c => c.list_name).filter(Boolean))], [contacts]);"
);
content = content.replace(
    /const segments = \[\.\.\.new Map\(contacts\.filter\(c => c\.segment_name && c\.segment_id\)\.map\(item => \[item\.segment_id, \{ id: item\.segment_id, name: item\.segment_name \}\]\)\)\.values\(\)\];/,
    "const segments = useMemo(() => [...new Map(contacts.filter(c => c.segment_name && c.segment_id).map(item => [item.segment_id, { id: item.segment_id, name: item.segment_name }])).values()], [contacts]);"
);
content = content.replace(
    /const listsMap = \[\.\.\.new Map\(contacts\.filter\(c => c\.list_name && c\.list_id\)\.map\(item => \[item\.list_id, \{ id: item\.list_id, name: item\.list_name \}\]\)\)\.values\(\)\];/,
    "const listsMap = useMemo(() => [...new Map(contacts.filter(c => c.list_name && c.list_id).map(item => [item.list_id, { id: item.list_id, name: item.list_name }])).values()], [contacts]);"
);

// 3. Wrap processedContacts filter and sort in useMemo
const processContactsRegex = /\/\/ Apply filtering\s+let processedContacts = contacts\.filter\(c => \{[\s\S]*?\/\/ Apply sorting\s+processedContacts\.sort\(\(a, b\) => \{[\s\S]*?return sortDirection === 'asc' \? comparison : -comparison;\s+\}\);/;

const processContactsReplacement = `// Apply filtering and sorting
    const processedContacts = useMemo(() => {
        let filtered = contacts.filter(c => {
            let matchStatus = true;
            let matchSegment = true;
            let matchList = true;

            // Status filter: unverified, valid, invalid
            if (filterStatus !== 'all') {
                matchStatus = (c.status || 'unverified') === filterStatus;
            }

            // Segment filter
            if (filterSegment !== 'all') {
                matchSegment = c.segment_name === filterSegment;
            }

            // List filter
            if (filterList !== 'all') {
                matchList = c.list_name === filterList;
            }

            return matchStatus && matchSegment && matchList;
        });

        return filtered.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            let comparison = 0;
            if (valA < valB) comparison = -1;
            if (valA > valB) comparison = 1;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [contacts, filterStatus, filterSegment, filterList, sortField, sortDirection]);`;

content = content.replace(processContactsRegex, processContactsReplacement);

fs.writeFileSync('src/pages/whatsapp/Contacts.jsx', content, 'utf8');
console.log('Contacts.jsx updated with useMemo');
