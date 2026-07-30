import React from 'react';

// Définition des onglets de navigation.
//
// Extraite de Sidebar.jsx pour que l'écran de Réglages puisse lister les onglets
// sans importer le composant — et pour ne pas mélanger constantes et composant
// dans un même module, ce qui fait perdre le rafraîchissement à chaud de Vite.
//
// L'ordre ici est l'ordre par défaut ; il est ensuite personnalisable par
// glisser-déposer (appSettings.mainMenuOrder) et filtrable par
// appSettings.hiddenMenuItems.
export const DEFAULT_MENU_ITEMS = [
    { id: 'dashboard', to: '/dashboard', labelKey: 'dashboard', icon: <><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></> },
    { id: 'whatsapp-hub', to: '/whatsapp-hub', labelKey: 'whatsappHub', icon: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path> },
    { id: 'analytics', to: '/analytics', labelKey: 'analytics', icon: <><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></> },
    { id: 'fashion-studio', to: null, labelKey: 'aiFashionStudio', isDropdown: true, matchPrefix: '/fashion', children: [
        { id: 'agents', to: '/agents', labelKey: 'productPhoto' },
        { id: 'fashion-photoshoot', to: '/fashion/photoshoot', labelKey: 'photoShoot' },
        { id: 'fashion-edit', to: '/fashion/edit', labelKey: 'editImage' },
        { id: 'fashion-image-gen', to: '/fashion/image-generation', labelKey: 'imageGeneration' },
    ], icon: <><path d="M20.38 3.46 16 2a8.86 8.86 0 0 1-5 0 8.86 8.86 0 0 1-5 0L1.62 3.46A2 2 0 0 0 0 5.34v.53a3 3 0 0 0 2 2.82v10.3A3 3 0 0 0 5 22h14a3 3 0 0 0 3-3V8.69a3 3 0 0 0 2-2.82v-.53a2 2 0 0 0-1.62-1.88z"></path><path d="M12 2v6"></path><path d="M9 12h6"></path><path d="M9 16h6"></path></> },
    { id: 'ai-chat', to: '/ai-chat', labelKey: 'aiChat', icon: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><circle cx="12" cy="10" r="3"></circle></> },
    { id: 'agent-pipeline', to: '/agent-pipeline', labelKey: 'agentPipeline', icon: <><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></> },
    { id: 'ai-writer', to: '/ai-writer', labelKey: 'aiWriter', icon: <><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></> },
    { id: 'whatsapp', to: null, labelKey: 'whatsapp', isDropdown: true, matchPrefix: '/wa/', children: [
        { id: 'wa-contacts-lists', to: '/wa/contact-lists', labelKey: 'contactLists' },
        { id: 'wa-segments', to: '/wa/segments', labelKey: 'segments' },
        { id: 'wa-contacts', to: '/wa/contacts', labelKey: 'contacts' },
        { id: 'wa-prospection', to: '/wa/prospection', labelKey: 'Prospection' },
        { id: 'wa-orders', to: '/wa/orders', labelKey: 'orders' },
    ], icon: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path> },
    { id: 'support', to: '/support', labelKey: 'support', icon: <><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></> },
    { id: 'tasks', to: '/tasks', labelKey: 'tasks', icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></> },
    { id: 'invoice-builder', to: '/invoice-builder', labelKey: 'invoiceBuilder', icon: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></> },
    { id: 'tools', to: '/tools', labelKey: 'tools', icon: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path> },
    { id: 'wordpress', to: '/wordpress', labelKey: 'wordpressBridge', icon: <><circle cx="12" cy="12" r="10" /><path d="M2 12h4M18 12h4M12 2v4M12 18v4" /><path d="m4.93 4.93 2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></> },
];

