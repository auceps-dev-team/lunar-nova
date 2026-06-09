import React from 'react';

// ─── Design tokens (aligned with WaCopilote branding) ────────────────────────
export const C = {
    primary:     '#059669', // emerald-600
    primary2:    '#10b981', // emerald-500
    primaryDark: '#047857', // emerald-700
    accent:      '#3b82f6', // blue-500
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
};

// ─── KPI Card (matched to Dashboard.jsx pattern) ─────────────────────────────
export function KPICard({ icon, label, value, sub, color }) {
    return (
        <div style={{
            background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: '20px 22px', display: 'flex', flexDirection: 'column',
            gap: 10, position: 'relative', overflow: 'hidden',
        }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '16px 16px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '18', color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                </div>
            </div>
            <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: '-0.5px', lineHeight: 1.2 }}>{value ?? '—'}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textSub, marginTop: 4 }}>{label}</div>
                {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
            </div>
        </div>
    );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
    const map = {
        publish:    { label: 'Publié',     bg: '#d1fae5', color: '#065f46' },
        draft:      { label: 'Brouillon',  bg: '#fef9c3', color: '#78350f' },
        completed:  { label: 'Complétée', bg: '#d1fae5', color: '#065f46' },
        processing: { label: 'En cours',   bg: '#dbeafe', color: '#1e3a8a' },
        pending:    { label: 'En attente', bg: '#fef9c3', color: '#78350f' },
        cancelled:  { label: 'Annulée',   bg: '#fee2e2', color: '#7f1d1d' },
    };
    const s = map[status] || { label: status, bg: '#f1f5f9', color: '#334155' };
    return (
        <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999 }}>
            {s.label}
        </span>
    );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
export function TabBtn({ active, icon, label, onClick }) {
    return (
        <button onClick={onClick} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 10,
            border: active ? `1px solid ${C.primary}30` : '1px solid transparent',
            background: active ? C.primary + '18' : 'transparent',
            color: active ? C.primary : C.textSub,
            fontSize: 13, fontWeight: active ? 700 : 500,
            cursor: 'pointer', transition: 'all 0.18s',
        }}>
            {icon}{label}
        </button>
    );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
export function Card({ children, style = {} }) {
    return (
        <div style={{
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 16, overflow: 'hidden', ...style,
        }}>
            {children}
        </div>
    );
}

export function CardHeader({ title, sub }) {
    return (
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
            {sub && <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{sub}</div>}
        </div>
    );
}

// ─── Field Input ─────────────────────────────────────────────────────────────
export function Field({ label, children, hint }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>{label}</label>
            {children}
            {hint && <span style={{ fontSize: 11, color: '#94a3b8' }}>{hint}</span>}
        </div>
    );
}

export function Input({ mono, ...props }) {
    return (
        <input {...props} style={{
            width: '100%', padding: '9px 12px',
            border: `1px solid ${C.border}`, borderRadius: 10,
            background: 'var(--input-bg, #f8fafc)',
            color: C.text, fontSize: 13,
            fontFamily: mono ? 'monospace' : 'inherit',
            outline: 'none', transition: 'border-color 0.18s',
            boxSizing: 'border-box',
        }}
            onFocus={e => e.target.style.borderColor = C.primary}
            onBlur={e => e.target.style.borderColor = C.border}
        />
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, sub }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: C.primary + '18', color: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</div>
            {sub && <div style={{ fontSize: 12, color: C.textSub, textAlign: 'center', maxWidth: 240 }}>{sub}</div>}
        </div>
    );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
export function Skeleton({ h = 16, w = '100%', r = 8 }) {
    return <div style={{ height: h, width: w, borderRadius: r, background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spin() {
    return <span style={{ display: 'inline-block', width: 14, height: 14, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />;
}
