/**
 * Constantes d'InvoiceBuilder — extraites de src/pages/InvoiceBuilder.jsx
 * (refactor de découpage — aucun changement de comportement).
 */
export const CURRENCIES = ['XOF', 'EUR', 'USD', 'GBP', 'CHF'];

export const STATUS_MAP = {
    paid: { labelKey: 'paidState', dot: '#10b981', bg: '#ecfdf5', text: '#047857' },
    pending: { labelKey: 'pendingState', dot: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
    overdue: { labelKey: 'overdueState', dot: '#ef4444', bg: '#fef2f2', text: '#991b1b' },
    draft: { labelKey: 'draftState', dot: '#94a3b8', bg: '#f8fafc', text: '#475569' },
};


// Replis figés au niveau du module : renvoyés par référence, ils gardent les
// dépendances de useMemo/useEffect stables d'un rendu à l'autre.
export const EMPTY_ARRAY = [];
export const EMPTY_OBJECT = {};
