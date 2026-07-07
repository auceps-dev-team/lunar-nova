import React from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '../ui/SkeletonLoader';

// ─── Design tokens (aligned with tailwind.config.js) ─────────────────────────
// primary/primaryDark mirror the app's Tailwind "primary"/"primary-dark" colors
// exactly, so components below stay visually consistent whether they use these
// tokens directly (dynamic per-instance colors) or the Tailwind classes.
export const C = {
    primary:     '#10B981', // Tailwind "primary"
    primary2:    '#10B981',
    primaryDark: '#059669', // Tailwind "primary-dark"
    accent:      '#3b82f6',
    blue:        '#3b82f6',
    purple:      '#8b5cf6',
    amber:       '#f59e0b',
    red:         '#ef4444',
    text:        'var(--text-primary, #0f172a)',
    textSub:     'var(--text-secondary, #64748b)',
    panel:       'var(--panel-bg, #ffffff)',
    border:      'var(--border-color, #e2e8f0)',
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────
export const Ico = {
    wp:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h4M18 12h4M12 2v4M12 18v4"/><path d="m4.93 4.93 2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>,
    link:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
    check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    bag:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    file:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    chart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
    globe: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    plug:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
    eye:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 4 5v6c0 5.25 3.4 10.16 8 11.5 4.6-1.34 8-6.25 8-11.5V5z"/></svg>,
};

// ─── KPI Card (matched to Dashboard.jsx pattern) ─────────────────────────────
// `color` is a per-instance runtime hex, so it stays inline (Tailwind can't
// generate classes for arbitrary runtime values); everything structural is Tailwind.
export function KPICard({ icon, label, value, sub, color }) {
    return (
        <div className="relative flex flex-col gap-2.5 overflow-hidden rounded-lg border border-gray-200 bg-surface p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg" style={{ background: color }} />
            <div className="flex h-9 w-9 items-center justify-center rounded-md" style={{ background: color + '18', color }}>
                {icon}
            </div>
            <div>
                <div className="text-2xl font-extrabold leading-tight tracking-tight text-text-main dark:text-zinc-100">{value ?? '—'}</div>
                <div className="mt-1 text-xs font-semibold text-text-muted dark:text-zinc-400">{label}</div>
                {sub && <div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">{sub}</div>}
            </div>
        </div>
    );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_CLASSES = {
    publish:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    completed:  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    draft:      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    pending:    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    processing: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-300',
    cancelled:  'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};
const STATUS_KEYS = {
    publish: 'wpStatusPublish', draft: 'wpStatusDraft', completed: 'wpStatusCompleted',
    processing: 'wpStatusProcessing', pending: 'wpStatusPending', cancelled: 'wpStatusCancelled',
};
export function StatusBadge({ status }) {
    const { t } = useTranslation();
    const cls = STATUS_CLASSES[status] || 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300';
    const label = STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status;
    return (
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
            {label}
        </span>
    );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
export function TabBtn({ active, icon, label, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 rounded-md border px-4 py-2 text-[13px] transition-colors ${
                active
                    ? 'border-primary/30 bg-primary/10 font-bold text-primary'
                    : 'border-transparent font-medium text-text-muted hover:text-text-main dark:hover:text-zinc-200'
            }`}
        >
            {icon}{label}
        </button>
    );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
export function Card({ children, style = {} }) {
    return (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-surface dark:border-zinc-800 dark:bg-zinc-900" style={style}>
            {children}
        </div>
    );
}

export function CardHeader({ title, sub }) {
    return (
        <div className="border-b border-gray-200 px-5 py-4 dark:border-zinc-800">
            <div className="text-sm font-bold text-text-main dark:text-zinc-100">{title}</div>
            {sub && <div className="mt-0.5 text-xs text-text-muted dark:text-zinc-400">{sub}</div>}
        </div>
    );
}

// ─── Field Input ─────────────────────────────────────────────────────────────
export function Field({ label, children, hint }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-muted dark:text-zinc-400">{label}</label>
            {children}
            {hint && <span className="text-[11px] text-gray-400 dark:text-zinc-500">{hint}</span>}
        </div>
    );
}

export function Input({ mono, className = '', ...props }) {
    return (
        <input
            {...props}
            className={`box-border w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-text-main outline-none transition-colors focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 ${mono ? 'font-mono' : ''} ${className}`}
        />
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, sub }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                {icon}
            </div>
            <div className="text-sm font-semibold text-text-main dark:text-zinc-100">{title}</div>
            {sub && <div className="max-w-[240px] text-center text-xs text-text-muted dark:text-zinc-400">{sub}</div>}
        </div>
    );
}

export { Skeleton };

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spin() {
    return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}
