import React from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '../ui/SkeletonLoader';


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
