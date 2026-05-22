/** @jsxImportSource react */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';

import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import '../styles/global.css';

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────
const INSTANCE_ICONS = {
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>,
    briefcase: <path d="M20 7h-4V5l-2-2h-4L8 5v2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-6 0h-4V5h4v2z"></path>,
    user: <g><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></g>,
    star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>,
    message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
};

const INSTANCE_COLORS = [
    { name: 'green', value: '#22c55e', shadow: 'rgba(34,197,94,0.6)' },
    { name: 'blue', value: '#3b82f6', shadow: 'rgba(59,130,246,0.6)' },
    { name: 'purple', value: '#a855f7', shadow: 'rgba(168,85,247,0.6)' },
    { name: 'orange', value: '#f97316', shadow: 'rgba(249,115,22,0.6)' },
    { name: 'pink', value: '#ec4899', shadow: 'rgba(236,72,153,0.6)' }
];

// Default menu item definitions — IDs must be stable
const DEFAULT_MENU_ITEMS = [
    { id: 'dashboard', to: '/dashboard', labelKey: 'dashboard', icon: <><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></> },
    { id: 'whatsapp-hub', to: '/whatsapp-hub', labelKey: 'whatsappHub', icon: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path> },
    { id: 'analytics', to: '/analytics', labelKey: 'analytics', icon: <><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></> },
    { id: 'fashion-studio', to: null, labelKey: 'aiFashionStudio', isDropdown: true, matchPrefix: '/fashion', children: [
        { id: 'agents', to: '/agents', labelKey: 'productPhoto' },
        { id: 'fashion-photoshoot', to: '/fashion/photoshoot', labelKey: 'photoShoot' },
        { id: 'fashion-edit', to: '/fashion/edit', labelKey: 'editImage' },
    ], icon: <><path d="M20.38 3.46 16 2a8.86 8.86 0 0 1-5 0 8.86 8.86 0 0 1-5 0L1.62 3.46A2 2 0 0 0 0 5.34v.53a3 3 0 0 0 2 2.82v10.3A3 3 0 0 0 5 22h14a3 3 0 0 0 3-3V8.69a3 3 0 0 0 2-2.82v-.53a2 2 0 0 0-1.62-1.88z"></path><path d="M12 2v6"></path><path d="M9 12h6"></path><path d="M9 16h6"></path></> },
    { id: 'ai-chat', to: '/ai-chat', labelKey: 'aiChat', icon: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><circle cx="12" cy="10" r="3"></circle></> },
    { id: 'ai-writer', to: '/ai-writer', labelKey: 'aiWriter', icon: <><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></> },
    { id: 'whatsapp', to: null, labelKey: 'whatsapp', isDropdown: true, matchPrefix: '/wa/', children: [
        { id: 'wa-contacts-lists', to: '/wa/contact-lists', labelKey: 'contactLists' },
        { id: 'wa-segments', to: '/wa/segments', labelKey: 'segments' },
        { id: 'wa-contacts', to: '/wa/contacts', labelKey: 'contacts' },
    ], icon: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path> },
    { id: 'support', to: '/support', labelKey: 'support', icon: <><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></> },
    { id: 'tasks', to: '/tasks', labelKey: 'tasks', icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></> },
    { id: 'invoice-builder', to: '/invoice-builder', labelKey: 'invoiceBuilder', icon: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></> },
    { id: 'tools', to: '/tools', labelKey: 'tools', icon: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path> },
    { id: 'wordpress', to: '/wordpress', labelKey: 'wordpressBridge', icon: <><circle cx="12" cy="12" r="10" /><path d="M2 12h4M18 12h4M12 2v4M12 18v4" /><path d="m4.93 4.93 2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></> },
];

// ─────────────────────────────────────────────────────────────
//  Drag Handle Icon
// ─────────────────────────────────────────────────────────────
const DragHandleIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing shrink-0 transition-colors">
        <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
        <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
    </svg>
);

// ─────────────────────────────────────────────────────────────
//  Sortable Nav Item
// ─────────────────────────────────────────────────────────────
const SortableNavItem = ({ item, currentPath, t, waAnalysis, resetWaAnalysis }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const [expanded, setExpanded] = useState(() => {
        if (item.matchPrefix) return currentPath.startsWith(item.matchPrefix);
        return false;
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const isActive = item.to
        ? (currentPath === item.to || (item.to !== '/' && currentPath === item.to))
        : (item.matchPrefix ? currentPath.startsWith(item.matchPrefix) : false);

    const linkClass = `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${isActive
        ? 'bg-primary/20 text-primary border border-primary/20'
        : 'text-gray-300 hover:bg-white/5 hover:text-white'}`;

    if (item.isDropdown) {
        return (
            <div ref={setNodeRef} style={style} className="select-none">
                <div className="flex items-center gap-1 group/menu">
                    <span {...attributes} {...listeners} className="flex items-center pl-1 py-2 opacity-0 group-hover/menu:opacity-100 transition-opacity">
                        <DragHandleIcon />
                    </span>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className={`flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                    >
                        <div className="flex items-center gap-3">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {item.icon}
                            </svg>
                            <span className="text-sm font-medium">{t(item.labelKey)}</span>
                            {/* WhatsApp analysis badge */}
                            {item.id === 'whatsapp' && waAnalysis?.isRunning && (
                                <span className="flex items-center gap-1 ml-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    <svg className="animate-spin h-2.5 w-2.5 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    {waAnalysis.totalProcessed}/{waAnalysis.totalContacts}
                                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); resetWaAnalysis(); }} onKeyDown={(e) => e.key === 'Enter' && resetWaAnalysis()} className="ml-0.5 cursor-pointer hover:text-red-400 transition-colors" title="Arrêter l'analyse">✕</span>
                                </span>
                            )}
                        </div>
                        <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                <div className={`overflow-hidden transition-all duration-300 pl-11 pr-3 space-y-1 ${expanded ? 'max-h-96 py-1' : 'max-h-0 py-0'}`}>
                    {item.children.map(child => (
                        <Link
                            key={child.id}
                            to={child.to}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${currentPath === child.to ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <span className="truncate">{t(child.labelKey)}</span>
                        </Link>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-1 group/menu select-none">
            <span {...attributes} {...listeners} className="flex items-center pl-1 py-2 opacity-0 group-hover/menu:opacity-100 transition-opacity">
                <DragHandleIcon />
            </span>
            <Link to={item.to} className={`flex-1 ${linkClass}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {item.icon}
                </svg>
                <span className="text-sm font-medium">{t(item.labelKey)}</span>
            </Link>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
//  Sortable Instance Item
// ─────────────────────────────────────────────────────────────
const SortableInstanceItem = ({ instance, activeId, onSelect, onRemove, onEditClick, editingId, editForm, setEditForm, handleSaveEdit, setEditingId }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: instance.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const activeColorObj = INSTANCE_COLORS.find(c => c.name === (instance.color || 'green')) || INSTANCE_COLORS[0];
    const IconPath = INSTANCE_ICONS[instance.icon || 'phone'] || INSTANCE_ICONS.phone;
    const isEditing = editingId === instance.id;

    if (isEditing) {
        return (
            <div key={instance.id} className="bg-white/10 p-3 rounded-lg border border-white/20 flex flex-col gap-3">
                <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="bg-sidebar-dark border border-white/20 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary w-full"
                    placeholder="Nom de l'instance"
                />
                <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
                    <div className="flex flex-wrap gap-2">
                        {INSTANCE_COLORS.map(c => (
                            <div
                                key={c.name}
                                onClick={() => setEditForm({ ...editForm, color: c.name })}
                                className={`size-4 rounded-full cursor-pointer transition-transform ${editForm.color === c.name ? 'scale-125 ring-2 ring-white shadow-soft' : 'opacity-50 hover:opacity-100'}`}
                                style={{ backgroundColor: c.value }}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {Object.keys(INSTANCE_ICONS).map(iconName => (
                            <div
                                key={iconName}
                                onClick={() => setEditForm({ ...editForm, icon: iconName })}
                                className={`p-1 rounded cursor-pointer transition-colors ${editForm.icon === iconName ? 'bg-white/20 text-white shadow-soft' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {INSTANCE_ICONS[iconName]}
                                </svg>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="flex-1 py-1 text-xs text-gray-300 hover:bg-white/10 rounded">Annuler</button>
                    <button onClick={(e) => handleSaveEdit(e, instance.id)} className="flex-1 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90">Sauvegarder</button>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${activeId === instance.id
                ? 'bg-white/5 border-white/5 text-white'
                : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
            onClick={() => onSelect(instance.id)}
        >
            {/* Drag Handle */}
            <span {...attributes} {...listeners} onClick={e => e.stopPropagation()} className="mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <DragHandleIcon />
            </span>

            <Link to="/whatsapp-hub" className="flex items-center gap-3 flex-1 min-w-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    {IconPath}
                </svg>
                <span className="text-sm font-medium truncate">{instance.name}</span>
            </Link>

            <div className="flex items-center gap-2">
                {activeId === instance.id && (
                    <span className="size-2 rounded-full" style={{ backgroundColor: activeColorObj.value, boxShadow: `0 0 8px ${activeColorObj.shadow}` }}></span>
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        className="text-gray-500 hover:text-white transition-colors p-[2px]"
                        onClick={(e) => onEditClick(e, instance)}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </button>
                    <button
                        className="text-gray-500 hover:text-red-400 transition-colors p-[2px]"
                        onClick={(e) => { e.stopPropagation(); onRemove(instance.id); }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
//  Sidebar (Main Component)
// ─────────────────────────────────────────────────────────────
const Sidebar = ({ instances, activeId, onSelect, onAdd, onRemove, onUpdate, currentPath }) => {
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', color: '', icon: '' });
    const { t } = useTranslation();
    const userProfile = useAppStore(state => state.userProfile) || {};
    const waAnalysis = useAppStore(state => state.waAnalysis);
    const resetWaAnalysis = useAppStore(state => state.resetWaAnalysis);
    const updateSettings = useAppStore(state => state.updateSettings);
    const savedMenuOrder = useAppStore(state => state.appSettings?.mainMenuOrder) || [];

    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [isResizing, setIsResizing] = useState(false);
    const [activeNavItem, setActiveNavItem] = useState(null);
    const [activeInstanceItem, setActiveInstanceItem] = useState(null);

    // Build ordered menu from saved order or default
    const orderedMenu = useMemo(() => {
        if (!savedMenuOrder || savedMenuOrder.length === 0) return DEFAULT_MENU_ITEMS;
        const itemMap = Object.fromEntries(DEFAULT_MENU_ITEMS.map(i => [i.id, i]));
        const ordered = savedMenuOrder.map(id => itemMap[id]).filter(Boolean);
        // Append any new items that aren't already in saved order
        const remaining = DEFAULT_MENU_ITEMS.filter(i => !savedMenuOrder.includes(i.id));
        return [...ordered, ...remaining];
    }, [savedMenuOrder]);

    const [menuItems, setMenuItems] = useState(orderedMenu);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
    );

    // ─── Sidebar Resize ───
    const startResizing = (mouseDownEvent) => {
        mouseDownEvent.preventDefault();
        setIsResizing(true);
        const startWidth = sidebarWidth;
        const startX = mouseDownEvent.clientX;
        const onMouseMove = (e) => {
            const newWidth = Math.max(180, Math.min(450, startWidth + (e.clientX - startX)));
            setSidebarWidth(newWidth);
        };
        const onMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // ─── Instance Edit ───
    const handleEditClick = (e, instance) => {
        e.stopPropagation();
        setEditingId(instance.id);
        setEditForm({ name: instance.name || '', color: instance.color || 'green', icon: instance.icon || 'phone' });
    };
    const handleSaveEdit = (e, id) => {
        e.stopPropagation();
        onUpdate(id, editForm);
        setEditingId(null);
    };

    // ─── Nav Menu DnD ───
    const handleNavDragStart = (event) => {
        setActiveNavItem(menuItems.find(i => i.id === event.active.id) || null);
    };
    const handleNavDragEnd = (event) => {
        const { active, over } = event;
        setActiveNavItem(null);
        if (active.id !== over?.id) {
            setMenuItems(items => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);
                const reordered = arrayMove(items, oldIndex, newIndex);
                updateSettings({ mainMenuOrder: reordered.map(i => i.id) });
                return reordered;
            });
        }
    };

    // ─── Instances DnD ───
    const instanceIds = useMemo(() => instances.map(i => i.id), [instances]);
    const handleInstancesDragEnd = (event) => {
        const { active, over } = event;
        setActiveInstanceItem(null);
        if (active.id !== over?.id) {
            const oldIndex = instances.findIndex(i => i.id === active.id);
            const newIndex = instances.findIndex(i => i.id === over.id);
            const reordered = arrayMove(instances, oldIndex, newIndex);
            // Propagate up to App (which calls setInstances in store)
            onUpdate('__reorder__', reordered);
        }
    };

    return (
        <div className="flex relative h-full shrink-0 group/sidebar" style={{ width: `${sidebarWidth}px`, transition: 'width 0.1s' }}>
            <aside className="w-full flex-col bg-sidebar-dark rounded-lg shadow-soft overflow-hidden shrink-0 text-white flex h-full">
                {/* Logo */}
                <div className="p-5 flex items-center gap-3 border-b border-white/10">
                    <div className="size-10 flex items-center justify-center shrink-0">
                        <img src="./assets/WaCopilot Logo.svg" alt="WaCopilote" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="font-display font-bold text-xl tracking-tight text-white">WaCopilote</h1>
                </div>

                <nav className="flex-1 overflow-y-auto scrollbar-hide py-4 px-3 space-y-1">
                    <div className="text-xs font-semibold text-gray-400 px-3 mb-2 uppercase tracking-wider">{t('main')}</div>

                    {/* ── Draggable Main Menu ── */}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleNavDragStart}
                        onDragEnd={handleNavDragEnd}
                    >
                        <SortableContext items={menuItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                            {menuItems.map(item => (
                                <SortableNavItem
                                    key={item.id}
                                    item={item}
                                    currentPath={currentPath}
                                    t={t}
                                    waAnalysis={waAnalysis}
                                    resetWaAnalysis={resetWaAnalysis}
                                />
                            ))}
                        </SortableContext>
                        <DragOverlay>
                            {activeNavItem && (
                                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-dark/90 border border-white/10 text-gray-200 shadow-2xl ring-1 ring-emerald-500/30 backdrop-blur-sm opacity-90">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{activeNavItem.icon}</svg>
                                    <span className="text-sm font-medium">{t(activeNavItem.labelKey)}</span>
                                </div>
                            )}
                        </DragOverlay>
                    </DndContext>

                    {/* ── Instances Section ── */}
                    <div className="text-xs font-semibold text-gray-400 px-3 mt-6 mb-2 uppercase tracking-wider flex items-center justify-between">
                        <span>{t('instances')}</span>
                        <button className="text-gray-400 hover:text-white transition-colors" onClick={onAdd} title={t('newInstance')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                    </div>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleInstancesDragEnd}
                    >
                        <SortableContext items={instanceIds} strategy={verticalListSortingStrategy}>
                            {instances.map(instance => (
                                <SortableInstanceItem
                                    key={instance.id}
                                    instance={instance}
                                    activeId={activeId}
                                    onSelect={onSelect}
                                    onRemove={onRemove}
                                    onEditClick={handleEditClick}
                                    editingId={editingId}
                                    editForm={editForm}
                                    setEditForm={setEditForm}
                                    handleSaveEdit={handleSaveEdit}
                                    setEditingId={setEditingId}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </nav>

                {/* User Profile */}
                <div className="p-4 border-t border-white/10 mt-auto">
                    <Link to="/profile" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-white">
                        <div className="size-10 border-2 border-white/10 rounded-full bg-primary/20 flex flex-col items-center justify-center font-bold text-sm text-primary overflow-hidden shrink-0">
                            {userProfile.isAuthenticated ? (
                                userProfile.profilePicture ? (
                                    <img src={userProfile.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    (userProfile.firstName?.[0] || userProfile.companyName?.[0] || 'U').toUpperCase()
                                )
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            {userProfile.isAuthenticated ? (
                                <>
                                    <p className="text-sm font-medium text-white truncate">{userProfile.firstName ? `${userProfile.firstName} ${userProfile.lastName}` : (userProfile.companyName || 'User')}</p>
                                    <p className="text-xs text-gray-400 truncate">{userProfile.email || 'SaaS License'}</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-medium text-white truncate">{t('notSignedIn')}</p>
                                    <p className="text-xs text-gray-400 truncate">{t('signInToAccount')}</p>
                                </>
                            )}
                        </div>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </Link>
                </div>
            </aside>

            {/* Resize Handle */}
            <div
                className={`w-2 cursor-col-resize shrink-0 transition-colors flex items-center justify-center z-20 group -ml-1 absolute right-[-4px] top-0 bottom-0 ${isResizing ? 'bg-white/20' : 'hover:bg-white/10'}`}
                onMouseDown={startResizing}
                title={t('dragToResizeSidebar')}
            >
                <div className={`w-1 h-8 rounded-full transition-colors ${isResizing ? 'bg-white' : 'bg-gray-500 group-hover:bg-white'}`} />
            </div>

            {isResizing && <div className="fixed inset-0 z-50 cursor-col-resize select-none" />}
        </div>
    );
};

export default Sidebar;

