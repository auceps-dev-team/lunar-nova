import React, { useState } from 'react';
import { C, Icons, fmt } from '../../utils/analyticsHelpers';

/**
 * Sous-composants d'AdvancedAnalytics (KPICard, SectionTitle, Panel,
 * CustomTooltip, ZustandInspector). Extraits de src/pages/AdvancedAnalytics.jsx
 * (refactor de découpage — aucun changement de comportement).
 */
export function KPICard({ icon, label, value, sub, color, trend, trendUp }) {
    return (
        <div style={{
            background: C.panelBg,
            border: `1px solid ${C.borderColor}`,
            borderRadius: 16,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Accent bar top */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '16px 16px 0 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: color + '18', color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                }}>{icon}</div>
                {trend && (
                    <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: trendUp ? C.primary2 : C.red,
                        background: (trendUp ? C.primary2 : C.red) + '15',
                        padding: '3px 8px', borderRadius: 20,
                    }}>
                        {trendUp ? '↑' : '↓'} {trend}
                    </span>
                )}
            </div>

            <div style={{ minWidth: 0 }}>
                <div title={value} style={{ fontSize: 24, fontWeight: 800, color: C.textPrimary, letterSpacing: '-0.5px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {value}
                </div>
                <div title={label} style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                {sub && <div title={sub} style={{ fontSize: 11, color: C.gray400, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
            </div>
        </div>
    );
}

export function SectionTitle({ children, sub }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{children}</h2>
            {sub && <p style={{ fontSize: 12, color: C.textSecondary, margin: '3px 0 0' }}>{sub}</p>}
        </div>
    );
}

export function Panel({ children, style = {} }) {
    return (
        <div style={{
            background: C.panelBg,
            border: `1px solid ${C.borderColor}`,
            borderRadius: 16,
            padding: '20px 22px',
            ...style,
        }}>
            {children}
        </div>
    );
}

// ── Custom Tooltip ────────────────────────────────────────────────
export const CustomTooltip = ({ active, payload, label, format }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#1e293b', border: 'none', borderRadius: 10,
            padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,.25)',
            fontSize: 12, color: '#e2e8f0',
        }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: '#fff' }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color || '#10b981' }}>
                    {p.name}: <strong>{format === 'currency' ? fmt(p.value) : p.value}</strong>
                </div>
            ))}
        </div>
    );
};

// ── Zustand Cache Inspector ───────────────────────────────────────
export function ZustandInspector({ storeData }) {
    const [expanded, setExpanded] = useState({});
    const toggle = key => setExpanded(p => ({ ...p, [key]: !p[key] }));

    const entries = Object.entries(storeData).map(([key, value]) => {
        let type = typeof value;
        let preview = '';
        let size = null;
        if (Array.isArray(value)) { type = 'array'; size = value.length; preview = `[${value.length} items]`; }
        else if (value === null) { type = 'null'; preview = 'null'; }
        else if (type === 'object') { size = Object.keys(value).length; preview = `{${size} keys}`; }
        else if (type === 'string') { preview = value.length > 50 ? value.slice(0, 50) + '…' : value; }
        else { preview = String(value); }
        return { key, value, type, preview, size };
    });

    const typeColor = {
        array: C.accent, object: C.blue, string: C.primary2,
        number: C.amber, boolean: C.purple, null: C.gray400,
    };

    return (
        <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {entries.map(({ key, value, type, preview }) => (
                <div key={key} style={{ marginBottom: 4 }}>
                    <div
                        onClick={() => (type === 'array' || type === 'object') && toggle(key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 10px', borderRadius: 8,
                            cursor: (type === 'array' || type === 'object') ? 'pointer' : 'default',
                            background: expanded[key] ? '#f0fdf4' : 'transparent',
                            transition: 'background .15s',
                        }}
                        onMouseEnter={e => { if (!expanded[key]) e.currentTarget.style.background = C.gray100; }}
                        onMouseLeave={e => { if (!expanded[key]) e.currentTarget.style.background = 'transparent'; }}
                    >
                        {(type === 'array' || type === 'object') && (
                            <span style={{ color: C.gray400, fontSize: 10 }}>{expanded[key] ? '▼' : '▶'}</span>
                        )}
                        <span style={{ color: C.gray700, fontWeight: 600, minWidth: 160 }}>{key}</span>
                        <span style={{
                            padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                            background: (typeColor[type] || C.gray400) + '20',
                            color: typeColor[type] || C.gray400,
                        }}>{type}</span>
                        <span style={{ color: C.gray500, fontSize: 11 }}>{preview}</span>
                    </div>

                    {expanded[key] && (
                        <div style={{
                            marginLeft: 24, padding: '8px 12px',
                            background: '#f8fafc', borderRadius: 8,
                            border: `1px solid ${C.gray200}`,
                            maxHeight: 200, overflowY: 'auto',
                            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                            color: C.gray700, fontSize: 11,
                            marginBottom: 4,
                        }}>
                            {JSON.stringify(value, null, 2)}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
