import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

/* ═══════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════ */
const CURRENCIES = ['XOF', 'EUR', 'USD', 'GBP', 'CHF'];

const STATUS_MAP = {
    paid:    { label: 'Payée',     dot: '#10b981', bg: '#ecfdf5', text: '#047857' },
    pending: { label: 'En attente', dot: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
    overdue: { label: 'En retard', dot: '#ef4444', bg: '#fef2f2', text: '#991b1b' },
    draft:   { label: 'Brouillon', dot: '#94a3b8', bg: '#f8fafc', text: '#475569' },
};

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */
function calc(items, taxRate = 0) {
    const sub = (items || []).reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);
    const tax = sub * (taxRate / 100);
    return { sub, tax, total: sub + tax };
}

function fmt(n, cur = 'XOF') {
    return n.toLocaleString('fr-FR', { style: 'currency', currency: cur, minimumFractionDigits: 2 });
}

function monthlyRevenue(invoices) {
    const m = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    const d = m.map(name => ({ name, rev: 0 }));
    invoices.forEach(inv => {
        if (!inv.createdAt) return;
        d[new Date(inv.createdAt).getMonth()].rev += calc(inv.items, inv.taxRate).total;
    });
    return d;
}

function freshInvoice(userProfile = {}) {
    const today = new Date();
    const due = new Date(today); due.setDate(due.getDate() + 30);
    
    // Assemble the sender information from the profile details
    const senderParts = [
        `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim(),
        userProfile.email,
        userProfile.phone,
        userProfile.address
    ].filter(Boolean).join('\n');

    return {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-${today.getFullYear()}-${String(Math.floor(Math.random()*900)+100)}`,
        companyName: userProfile.companyName || '', 
        companyTagline: '', 
        senderInfo: senderParts,
        companyLogo: userProfile.companyLogo || null, clientLogo: null,
        clientName: '', clientEmail: '', clientAddress: '',
        issueDate: today.toISOString().split('T')[0],
        dueDate: due.toISOString().split('T')[0],
        items: [{ id: `li-${Date.now()}`, description: '', qty: 1, price: 0 }],
        taxRate: 20, notes: '', status: 'draft', template: 'clean', currency: 'XOF',
        createdAt: today.toISOString(),
    };
}

/* ═══════════════════════════════════════════════════════
   LOGO PICKER
   ═══════════════════════════════════════════════════════ */
function LogoPicker({ value, onChange, label, size = 56 }) {
    const ref = useRef(null);
    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => onChange(ev.target.result);
        reader.readAsDataURL(file);
    };
    return (
        <div className="flex flex-col items-center gap-1 group cursor-pointer" onClick={() => ref.current?.click()}>
            <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile}/>
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-emerald-400 transition-all flex items-center justify-center overflow-hidden"
                 style={{ width: size, height: size, background: value ? 'transparent' : '#f9fafb' }}>
                {value ? (
                    <img src={value} alt="logo" className="w-full h-full object-contain"/>
                ) : (
                    <svg width="20" height="20" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                    </svg>
                )}
            </div>
            <span className="text-[10px] font-medium text-gray-400 group-hover:text-emerald-500 transition-colors no-print">{label}</span>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   SORTABLE LINE ITEM
   ═══════════════════════════════════════════════════════ */
function SortableLine({ item, onUpdate, onRemove, currency }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const rowStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .45 : 1 };
    const total = (item.qty || 0) * (item.price || 0);

    return (
        <tr ref={setNodeRef} style={rowStyle} className={`group ${isDragging ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
            <td className="py-3 pr-2 w-6 no-print">
                <span {...attributes} {...listeners} className="cursor-grab text-gray-300 hover:text-gray-500 transition-colors">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/></svg>
                </span>
            </td>
            <td className="py-3">
                <input className="w-full bg-transparent text-sm font-medium text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300"
                    value={item.description} placeholder="Description du service ou produit..."
                    onChange={e => onUpdate(item.id, 'description', e.target.value)}/>
            </td>
            <td className="py-3 w-20">
                <input type="number" min="1" className="w-full text-center text-sm bg-gray-50 dark:bg-gray-800 rounded-lg py-1 outline-none focus:ring-1 ring-emerald-400 text-gray-800 dark:text-gray-200"
                    value={item.qty} onChange={e => onUpdate(item.id, 'qty', parseFloat(e.target.value) || 1)}/>
            </td>
            <td className="py-3 w-28">
                <input type="number" min="0" step="0.01" className="w-full text-right text-sm bg-gray-50 dark:bg-gray-800 rounded-lg py-1 px-2 outline-none focus:ring-1 ring-emerald-400 text-gray-800 dark:text-gray-200"
                    value={item.price} onChange={e => onUpdate(item.id, 'price', parseFloat(e.target.value) || 0)}/>
            </td>
            <td className="py-3 w-28 text-right text-sm font-semibold text-gray-800 dark:text-gray-200">{fmt(total, currency)}</td>
            <td className="py-3 w-8 text-right no-print">
                <button onClick={() => onRemove(item.id)} className="p-1 rounded-lg opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </td>
        </tr>
    );
}

/* ═══════════════════════════════════════════════════════
   HTML INVOICE TEMPLATE (for PDF rendering)
   ═══════════════════════════════════════════════════════ */
function buildInvoiceHTML(draft) {
    const { sub, tax, total } = calc(draft.items, draft.taxRate);
    if (draft.template === 'stripe') {
        const rows = (draft.items || []).map(it => `
            <div class="table-row">
                <div>${it.description || '—'}</div>
                <div class="col-center">${it.qty}</div>
                <div class="col-center">${fmt(it.price, draft.currency)}</div>
                <div class="col-right">${fmt(it.qty * it.price, draft.currency)}</div>
            </div>
        `).join('');

        const defaultLogo = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 85 C30 85, 15 65, 15 45 C15 30, 30 15, 50 10 C70 15, 85 30, 85 45 C85 65, 70 85, 50 85 Z" /><path d="M50 85 C40 65, 35 45, 50 25 C65 45, 60 65, 50 85 Z" /><path d="M15 45 C25 60, 40 70, 50 85" /><path d="M85 45 C75 60, 60 70, 50 85" /></svg>`;
        const logoHTML = draft.companyLogo ? `<img src="${draft.companyLogo}" style="height:80px;object-fit:contain" alt="logo"/>` : defaultLogo;

        return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modèle de Facture - Violet</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root { --bg-color: #f7f7f9; --purple-main: #3b1485; --text-dark: #333333; --text-light: #5a5a75; --white: #ffffff; --gold: #c2a370; --border-color: #d1d1e0; }
        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; color: var(--text-dark); display: flex; justify-content: center; background-color: white; }
        .invoice-container { width: 100%; max-width: 800px; background-color: var(--bg-color); padding: 60px; box-sizing: border-box; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .invoice-title { font-size: 3.5em; font-weight: 800; color: var(--purple-main); letter-spacing: 2px; margin: 0; text-transform: uppercase; }
        .logo svg { width: 80px; height: 80px; fill: none; stroke: var(--gold); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .divider { border: none; border-top: 1px solid var(--border-color); margin: 20px 0 40px 0; }
        .divider-short { border: none; border-top: 1px solid var(--border-color); margin: 30px 0; width: 250px; }
        .billing-info { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .invoice-to h2 { font-size: 1.2em; color: var(--text-dark); margin-top: 0; margin-bottom: 15px; }
        .invoice-to p, .invoice-meta p { margin: 5px 0; font-size: 0.9em; color: var(--text-light); line-height: 1.5; white-space: pre-line; }
        .invoice-meta { text-align: right; margin-top: 40px; }
        .table-container { margin-bottom: 40px; }
        .table-header { background-color: var(--purple-main); color: var(--white); display: grid; grid-template-columns: 4fr 1fr 2fr 2fr; padding: 15px 20px; font-weight: 700; font-size: 0.9em; letter-spacing: 0.5px; }
        .table-row { display: grid; grid-template-columns: 4fr 1fr 2fr 2fr; padding: 20px; font-size: 0.9em; color: var(--text-dark); align-items: center; }
        .table-row:nth-child(odd) { background-color: var(--white); }
        .table-row:nth-child(even) { background-color: transparent; }
        .col-center { text-align: center; }
        .col-right { text-align: right; }
        .bottom-section { display: flex; justify-content: space-between; }
        .bottom-left, .bottom-right { width: 45%; }
        .section-title { font-size: 1.1em; font-weight: 700; color: var(--purple-main); margin-bottom: 15px; margin-top: 0; }
        .detail-text { font-size: 0.9em; color: var(--text-light); line-height: 1.6; margin: 0; white-space: pre-line; }
        .totals-row { display: flex; justify-content: space-between; padding: 10px 20px; font-size: 0.95em; color: var(--text-dark); }
        .totals-divider { border: none; border-top: 1px solid #9ba4b5; margin: 5px 20px; }
        .total-box { background-color: var(--purple-main); color: var(--white); display: flex; justify-content: space-between; padding: 15px 20px; font-size: 1.1em; font-weight: 700; margin-top: 10px; }
        .signature-box { margin-top: 40px; border: 1px solid #d1d1d1; height: 120px; display: flex; justify-content: center; align-items: flex-end; padding-bottom: 20px; background-color: var(--white); }
        .signature-text { color: #a0a0a0; font-style: italic; font-size: 0.9em; }
        @media print { body { padding: 0; } .invoice-container { box-shadow: none; padding: 20px; } }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <h1 class="invoice-title">Facture</h1>
            <div class="logo">
                ${logoHTML}
            </div>
        </div>

        <hr class="divider">

        <div class="billing-info">
            <div class="invoice-to">
                <h2>Facturé à :</h2>
                <p><strong>${draft.clientName || 'Client / Société'}</strong></p>
                <p>${draft.clientAddress}</p>
            </div>
            <div class="invoice-meta">
                <p>No : ${draft.invoiceNumber}<br>
                Émission : ${draft.issueDate}<br>
                Échéance : ${draft.dueDate}</p>
            </div>
        </div>

        <div class="table-container">
            <div class="table-header">
                <div>DESCRIPTION</div>
                <div class="col-center">QTÉ</div>
                <div class="col-center">PRIX</div>
                <div class="col-right">TOTAL</div>
            </div>
            ${rows}
        </div>

        <div class="bottom-section">
            <div class="bottom-left">
                ${draft.notes ? `<h3 class="section-title">Notes :</h3><p class="detail-text">${draft.notes}</p><hr class="divider-short">` : ''}
                <h3 class="section-title">Coordonnées :</h3>
                <p class="detail-text">${draft.companyName || 'Votre Entreprise'}<br>${draft.companyTagline || ''}<br>${draft.senderInfo || '—'}</p>
            </div>

            <div class="bottom-right">
                <div class="totals-row">
                    <span>Sous-Total :</span>
                    <span>${fmt(sub, draft.currency)}</span>
                </div>
                
                <hr class="totals-divider">
                
                <div class="totals-row">
                    <span>TVA (${draft.taxRate}%) :</span>
                    <span>${fmt(tax, draft.currency)}</span>
                </div>

                <div class="total-box">
                    <span>Total :</span>
                    <span>${fmt(total, draft.currency)}</span>
                </div>

                <div class="signature-box">
                    <span class="signature-text">WaCopilote Automation</span>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    if (draft.template === 'bold') {
        const rows = (draft.items || []).map(it => `
            <div class="table-row">
                <div>${it.description || '—'}</div>
                <div class="col-center">${it.qty}</div>
                <div class="col-center">${fmt(it.price, draft.currency)}</div>
                <div class="col-right">${fmt(it.qty * it.price, draft.currency)}</div>
            </div>
        `).join('');

        const logoHTML = draft.companyLogo ? `<img src="${draft.companyLogo}" style="width:40px;height:40px;object-fit:contain" alt="logo"/>` : `<div class="logo-icon">${(draft.companyName || '?')[0]}</div>`;

        return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modèle de Facture</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root { --bg-color: #ede8dc; --text-dark: #0a2533; --teal-gradient: linear-gradient(90deg, #256a7c, #48a69e); --white: #ffffff; --footer-bg: #072535; }
        body { margin: 0; padding: 0; font-family: 'Montserrat', sans-serif; color: var(--text-dark); display: flex; justify-content: center; }
        .invoice-container { width: 100%; max-width: 800px; background-color: var(--bg-color); background-image: radial-gradient(circle at top right, #f6f4ee 0%, var(--bg-color) 40%); padding: 50px; position: relative; overflow: hidden; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 50px; }
        .logo-section { display: flex; align-items: center; gap: 15px; }
        .logo-icon { width: 40px; height: 40px; background: var(--teal-gradient); clip-path: polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%); display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; font-size: 24px; }
        .company-name { font-weight: 700; font-size: 1.1em; text-transform: uppercase; letter-spacing: 1px; }
        .company-sub { font-size: 0.8em; font-weight: 400; }
        .invoice-title { font-size: 2.5em; font-weight: 700; color: var(--text-dark); letter-spacing: 2px; }
        .info-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .info-left h3 { font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; margin-top: 20px; }
        .info-left p { margin: 4px 0; font-size: 0.9em; }
        .info-right { text-align: right; margin-top: 20px; }
        .info-right p { margin: 6px 0; font-size: 0.95em; }
        .table-header { background: var(--teal-gradient); color: var(--white); border-radius: 20px; padding: 15px 30px; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; font-weight: 700; font-size: 0.9em; letter-spacing: 1px; margin-bottom: 15px; }
        .table-body { background: var(--white); border-radius: 20px; padding: 20px 30px; margin-bottom: 20px; }
        .table-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; padding: 12px 0; font-size: 0.95em; }
        .col-center { text-align: center; }
        .col-right { text-align: right; }
        .summary-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
        .notes { width: 45%; }
        .notes h4 { font-size: 0.9em; margin-bottom: 10px; text-transform: uppercase; }
        .notes p { font-size: 0.8em; line-height: 1.5; color: #444; }
        .totals { width: 45%; background: var(--white); border-radius: 20px; padding: 20px 30px; box-sizing: border-box; }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-weight: 600; font-size: 0.95em; }
        .total-row.grand-total { margin-top: 15px; padding-top: 15px; font-size: 1.1em; font-weight: 700; border-top: 2px solid #eee; }
        .footer-banner { background: var(--footer-bg); color: var(--white); border-radius: 30px; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; font-size: 0.85em; }
        .footer-item { display: flex; align-items: center; gap: 8px; }
        .footer-item span.icon { color: #48a69e; font-size: 1.2em; }
        @media print { body { padding: 0; } .invoice-container { box-shadow: none; padding: 20px; } }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div class="logo-section">
                ${logoHTML}
                <div>
                    <div class="company-name">${draft.companyName || 'Vos Informations'}</div>
                    <div class="company-sub">${draft.companyTagline || ''}</div>
                </div>
            </div>
            <div class="invoice-title">${draft.invoiceNumber}</div>
        </div>

        <div class="info-section">
            <div class="info-left">
                <h3>DE</h3>
                <p style="white-space:pre-line">${draft.senderInfo || '—'}</p>
                
                <h3>FACTURÉ À</h3>
                <p><strong>${draft.clientName || 'Client / Société'}</strong></p>
                <p style="white-space:pre-line">${draft.clientAddress}</p>
            </div>
            <div class="info-right">
                <p>Numéro: ${draft.invoiceNumber}</p>
                <p>Date: ${draft.issueDate}</p>
                <p>Échéance: ${draft.dueDate}</p>
            </div>
        </div>

        <div class="table-header">
            <div>DESCRIPTION</div>
            <div class="col-center">QTÉ</div>
            <div class="col-center">PRIX</div>
            <div class="col-right">TOTAL</div>
        </div>

        <div class="table-body">
            ${rows}
        </div>

        <div class="summary-section">
            <div class="notes">
                ${draft.notes ? `<h4>NOTES</h4><p style="white-space: pre-line">${draft.notes}</p>` : ''}
            </div>
            <div class="totals">
                <div class="total-row"><span>SOUS-TOTAL</span><span>${fmt(sub, draft.currency)}</span></div>
                <div class="total-row"><span>TVA (${draft.taxRate}%)</span><span>${fmt(tax, draft.currency)}</span></div>
                <div class="total-row grand-total"><span>TOTAL</span><span>${fmt(total, draft.currency)}</span></div>
            </div>
        </div>

    </div>
</body>
</html>`;
    }
    const rows = (draft.items || []).map(it => `
        <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155">${it.description || '—'}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;text-align:center">${it.qty}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;text-align:right">${fmt(it.price, draft.currency)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;text-align:right;font-weight:600">${fmt(it.qty * it.price, draft.currency)}</td>
        </tr>
    `).join('');

    const logoHTML = draft.companyLogo ? `<img src="${draft.companyLogo}" style="width:52px;height:52px;border-radius:12px;object-fit:contain" alt="logo"/>` : `<div style="width:52px;height:52px;border-radius:12px;background:#ecfdf5;display:flex;align-items:center;justify-content:center;color:#10b981;font-weight:800;font-size:22px">${(draft.companyName || '?')[0]}</div>`;
    const clientLogoHTML = draft.clientLogo ? `<img src="${draft.clientLogo}" style="width:36px;height:36px;border-radius:8px;object-fit:contain;margin-bottom:6px" alt="client"/>` : '';

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        @page { margin: 20mm; size: A4; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', 'Inter', -apple-system, sans-serif; color: #1e293b; background: #fff; }
        .accent { color: #059669; }
        .container { max-width: 680px; margin: 0 auto; }
    </style></head><body>
    <div class="container">
        <!-- Top accent bar -->
        <div style="height:4px;background:linear-gradient(90deg,#059669,#34d399);border-radius:0 0 4px 4px;margin-bottom:36px"></div>

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px">
            <div style="display:flex;align-items:center;gap:14px">
                ${logoHTML}
                <div>
                    <div style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.3px">${draft.companyName || 'Votre Entreprise'}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:2px">${draft.companyTagline || ''}</div>
                </div>
            </div>
            <div style="text-align:right">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">Facture</div>
                <div style="font-size:22px;font-weight:800;color:#0f172a">${draft.invoiceNumber}</div>
                <div style="display:flex;gap:24px;justify-content:flex-end;margin-top:10px">
                    <div><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Date</div><div style="font-size:13px;color:#334155;margin-top:2px">${draft.issueDate}</div></div>
                    <div><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Échéance</div><div style="font-size:13px;color:#334155;margin-top:2px">${draft.dueDate}</div></div>
                </div>
            </div>
        </div>

        <!-- Addresses -->
        <div style="display:flex;gap:40px;margin-bottom:36px">
            <div style="flex:1;background:#f8fafc;border-radius:12px;padding:18px">
                <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px">De</div>
                <div style="font-size:13px;color:#334155;white-space:pre-line;line-height:1.7">${draft.senderInfo || '—'}</div>
            </div>
            <div style="flex:1;padding:18px">
                <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px">Facturé à</div>
                ${clientLogoHTML}
                <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px">${draft.clientName || '—'}</div>
                <div style="font-size:13px;color:#64748b;white-space:pre-line;line-height:1.7">${draft.clientAddress || ''}</div>
            </div>
        </div>

        <!-- Items table -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
            <thead><tr>
                <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #e2e8f0">Description</th>
                <th style="padding:10px 8px;text-align:center;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #e2e8f0;width:60px">Qté</th>
                <th style="padding:10px 8px;text-align:right;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #e2e8f0;width:100px">Prix</th>
                <th style="padding:10px 8px;text-align:right;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #e2e8f0;width:100px">Total</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>

        <!-- Totals -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:36px">
            <div style="width:260px">
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#64748b"><span>Sous-total</span><span>${fmt(sub, draft.currency)}</span></div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#64748b"><span>TVA (${draft.taxRate}%)</span><span>${fmt(tax, draft.currency)}</span></div>
                <div style="display:flex;justify-content:space-between;padding:10px 0;margin-top:8px;border-top:2px solid #e2e8f0;font-size:18px;font-weight:800"><span style="color:#0f172a">Total</span><span class="accent">${fmt(total, draft.currency)}</span></div>
            </div>
        </div>

        ${draft.notes ? `<div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:24px"><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Notes</div><div style="font-size:12px;color:#64748b;line-height:1.6">${draft.notes}</div></div>` : ''}

        <div style="text-align:center;padding-top:24px;border-top:1px solid #f1f5f9;font-size:10px;color:#cbd5e1">Facture générée automatiquement · ${draft.companyName || 'Votre Entreprise'}</div>
    </div>
    </body></html>`;
}

/* ═══════════════════════════════════════════════════════
   KPI CARD
   ═══════════════════════════════════════════════════════ */
function KPI({ label, value, sub, icon, accent }) {
    return (
        <div className="bg-white dark:bg-[#1a1f25] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: accent + '18', color: accent }}>{icon}</div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">{label}</span>
            </div>
            <p className="text-[26px] font-extrabold text-gray-900 dark:text-white leading-none tracking-tight">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   TEMPLATE THUMBNAILS
   ═══════════════════════════════════════════════════════ */
const TPL_PREVIEWS = [
    { id: 'clean', label: 'Modern Clean', colors: ['#059669','#ecfdf5','#fff'] },
    { id: 'bold', label: 'Bold Header', colors: ['#1e293b','#f8fafc','#fff'] },
    { id: 'stripe', label: 'Violet Gold', colors: ['#3b1485','#f7f7f9','#c2a370'] },
];

function TplThumb({ tpl, active, onClick }) {
    return (
        <button onClick={onClick} className={`w-full text-left transition-all duration-200 ${active ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}>
            <div className={`aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all duration-200 ${active ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'}`}>
                <div style={{ background: tpl.colors[0] }} className="h-[28%]"></div>
                <div style={{ background: tpl.colors[2] }} className="flex-1 p-2 space-y-1.5">
                    <div className="h-1.5 w-1/2 rounded-full" style={{ background: tpl.colors[0] + '30' }}></div>
                    <div className="h-1 w-full rounded-full bg-gray-100"></div>
                    <div className="h-1 w-3/4 rounded-full bg-gray-100"></div>
                    <div className="h-6 w-full mt-2 rounded bg-gray-50 border border-gray-100"></div>
                    <div className="h-1 w-full rounded-full bg-gray-100"></div>
                </div>
            </div>
            <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{tpl.label}</span>
                {active && <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><svg width="10" height="10" fill="none" stroke="#fff" strokeWidth="3" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></div>}
            </div>
        </button>
    );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function InvoiceBuilder({ activeId }) {
    const invoices = useAppStore(s => s.invoices) || [];
    const addInvoice = useAppStore(s => s.addInvoice);
    const updateInvoice = useAppStore(s => s.updateInvoice);
    const deleteInvoice = useAppStore(s => s.deleteInvoice);
    const userProfile = useAppStore(s => s.userProfile) || {};
    const invoiceDraft = useAppStore(s => s.invoiceDraft);
    const setInvoiceDraft = useAppStore(s => s.setInvoiceDraft);

    const navigate = useNavigate();
    const [view, setView] = useState('dashboard');
    const [draft, setDraft] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [saved, setSaved] = useState(false);
    const [showSaveToast, setShowSaveToast] = useState(false);

    // Consume cross-app invoiceDraft coming from Orders.jsx
    useEffect(() => {
        if (invoiceDraft) {
            setDraft({
                ...freshInvoice(userProfile),
                clientName: invoiceDraft.clientName || '',
                notes: invoiceDraft.notes || '',
                // Add the WhatsApp message text as a line item optionally (defaulting to 0)
                items: [
                    { id: `li-${Date.now()}`, description: `WhatsApp Request: ${invoiceDraft.rawMessage?.substring(0, 100)}...`, qty: 1, price: 0 }
                ]
            });
            setView('editor');
            setSaved(false);
            setInvoiceDraft(null); // Clear draft once consumed
        }
    }, [invoiceDraft, userProfile, setInvoiceDraft]);

    // Contact search state
    const [showContactSearch, setShowContactSearch] = useState(false);
    const [allContacts, setAllContacts] = useState([]);
    const [contactSearchQuery, setContactSearchQuery] = useState('');
    const [contactFilterSegment, setContactFilterSegment] = useState('all');
    const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

    // Fetch contacts for search
    useEffect(() => {
        fetch('http://localhost:3000/api/wa/contacts')
            .then(r => r.json())
            .then(d => { if (d.status === 'success') setAllContacts(d.data || []); })
            .catch(() => {});
    }, []);

    const contactSegments = useMemo(() => {
        return [...new Set(allContacts.map(c => c.segment_name).filter(Boolean))];
    }, [allContacts]);

    const filteredContacts = useMemo(() => {
        let list = allContacts;
        if (contactFilterSegment !== 'all') list = list.filter(c => c.segment_name === contactFilterSegment);
        if (contactSearchQuery) {
            const q = contactSearchQuery.toLowerCase();
            list = list.filter(c => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q));
        }
        return list.slice(0, 20);
    }, [allContacts, contactFilterSegment, contactSearchQuery]);

    const handleSelectContact = (contact) => {
        setDraft(d => ({
            ...d,
            clientName: contact.name || '',
            clientAddress: [contact.address, contact.email, contact.phone].filter(Boolean).join('\n'),
            clientEmail: contact.email || '',
            clientPhone: contact.phone || '',
        }));
        setShowContactSearch(false);
        setContactSearchQuery('');
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // KPI
    const revByCurrency = useMemo(() => {
        const acc = {};
        invoices.forEach(inv => {
            const { total } = calc(inv.items, inv.taxRate);
            const cur = inv.currency || 'EUR';
            acc[cur] = (acc[cur] || 0) + total;
        });
        return acc;
    }, [invoices]);

    const primaryCurrency = Object.keys(revByCurrency)[0] || 'EUR';
    const totalRevStr = Object.keys(revByCurrency).length === 0 
        ? fmt(0) 
        : Object.entries(revByCurrency).map(([cur, amt]) => fmt(amt, cur)).join(' + ');

    const paidN = invoices.filter(i => i.status === 'paid').length;
    const pendN = invoices.filter(i => i.status === 'pending').length;
    const chartData = useMemo(() => monthlyRevenue(invoices), [invoices]);
    const filtered = filterStatus === 'all' ? invoices : invoices.filter(i => i.status === filterStatus);

    const handleNew = () => { setDraft(freshInvoice(userProfile)); setSaved(false); setView('editor'); };
    const handleEdit = (inv) => { setDraft({ ...inv }); setSaved(true); setView('editor'); };

    const handleSave = () => {
        if (!draft) return;
        invoices.find(i => i.id === draft.id) ? updateInvoice(draft.id, draft) : addInvoice(draft);
        setSaved(true);
        setShowSaveToast(true);
        setTimeout(() => setShowSaveToast(false), 3000);
    };

    const handleExportPDF = async () => {
        if (!draft) return;
        const html = buildInvoiceHTML(draft);
        const fileName = `${(draft.invoiceNumber || 'facture').replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;

        // Use Electron native PDF export if available
        if (window.electronAPI?.printToPDF) {
            try {
                const result = await window.electronAPI.printToPDF(html, fileName);
                if (result?.success) {
                    // Show a brief success indicator
                    setSaved(true);
                } else if (result?.reason !== 'cancelled') {
                    alert('Erreur lors de l\'export PDF : ' + (result?.reason || 'inconnue'));
                }
            } catch (err) {
                console.error('PDF export error:', err);
                alert('Erreur lors de l\'export PDF.');
            }
        } else {
            // Fallback for browser: open in new tab + print
            const win = window.open('', '_blank', 'width=800,height=1100');
            if (!win) return alert('Veuillez autoriser les popups pour exporter en PDF.');
            win.document.write(html);
            win.document.close();
            setTimeout(() => { win.focus(); win.print(); }, 400);
        }
    };

    // Send invoice via WhatsApp
    const handleSendWhatsApp = async () => {
        if (!draft || !draft.clientPhone) {
            alert('Veuillez d\'abord sélectionner un contact avec un numéro de téléphone.');
            return;
        }
        setSendingWhatsApp(true);
        try {
            // First export the PDF
            const html = buildInvoiceHTML(draft);
            const fileName = `${(draft.invoiceNumber || 'facture').replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
            if (window.electronAPI?.printToPDF) {
                const result = await window.electronAPI.printToPDF(html, fileName);
                if (!result?.success && result?.reason !== 'cancelled') {
                    throw new Error(result?.reason || 'PDF export failed');
                }
            }

            // Then open the WhatsApp chat
            if (!activeId) {
                alert('Aucune instance WhatsApp active. Veuillez en démarrer une.');
                return;
            }

            const rawPhone = (draft.clientPhone || '').replace(/[^0-9]/g, '');
            const res = await fetch('http://localhost:3000/api/wa/open-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instance_id: activeId, phone: rawPhone })
            });
            const data = await res.json();
            if (data.status === 'success') {
                await new Promise(r => setTimeout(r, 1200));
                navigate('/whatsapp-hub');
            } else {
                throw new Error(data.error || 'Failed to open chat');
            }
        } catch (err) {
            console.error('WhatsApp send error:', err);
            alert('Erreur: ' + err.message);
        } finally {
            setSendingWhatsApp(false);
        }
    };

    const updateItem = useCallback((id, field, val) => {
        setDraft(d => ({ ...d, items: d.items.map(it => it.id === id ? { ...it, [field]: val } : it) }));
    }, []);
    const removeItem = useCallback(id => { setDraft(d => ({ ...d, items: d.items.filter(it => it.id !== id) })); }, []);
    const addItem = () => { setDraft(d => ({ ...d, items: [...d.items, { id: `li-${Date.now()}`, description: '', qty: 1, price: 0 }] })); };

    const onDragEnd = (ev) => {
        const { active, over } = ev;
        if (!over || active.id === over.id) return;
        setDraft(d => {
            const o = d.items.findIndex(i => i.id === active.id);
            const n = d.items.findIndex(i => i.id === over.id);
            return { ...d, items: arrayMove(d.items, o, n) };
        });
    };

    // ── DASHBOARD ─────────────────────────────────────────
    if (view === 'dashboard') {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Facturation</h1>
                        <p className="text-sm text-gray-400 mt-0.5">Tableau de bord et gestion des factures</p>
                    </div>
                    <button onClick={handleNew}
                        className="h-10 px-5 rounded-xl text-white text-sm font-bold flex items-center gap-2 active:scale-[.97] transition-transform shadow-lg shadow-emerald-600/20"
                        style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nouvelle facture
                    </button>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPI label="Total factures" value={invoices.length} icon="📄" accent="#059669"/>
                    <KPI label="Chiffre d'affaires" value={totalRevStr} icon="💰" accent="#0891b2"/>
                    <KPI label="Payées" value={paidN} sub={`sur ${invoices.length}`} icon="✅" accent="#16a34a"/>
                    <KPI label="En attente" value={pendN} icon="⏳" accent="#d97706"/>
                </div>

                {/* Chart */}
                <div className="bg-white dark:bg-[#1a1f25] rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-bold uppercase tracking-[.15em] text-gray-400 mb-4">Revenus mensuels</p>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} margin={{ left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                            <Tooltip formatter={v => fmt(v, primaryCurrency)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,.08)', fontSize: 12 }}/>
                            <Bar dataKey="rev" fill="url(#barGrad)" radius={[6,6,0,0]}/>
                            <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#059669"/><stop offset="100%" stopColor="#34d399"/></linearGradient></defs>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Invoice list */}
                <div className="bg-white dark:bg-[#1a1f25] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-800">
                        <p className="text-[10px] font-bold uppercase tracking-[.15em] text-gray-400">Factures</p>
                        <div className="flex gap-1.5">
                            {['all','paid','pending','overdue','draft'].map(s => (
                                <button key={s} onClick={() => setFilterStatus(s)}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${filterStatus === s ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                                    {s === 'all' ? 'Toutes' : STATUS_MAP[s]?.label || s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="text-center py-20 text-gray-300">
                            <div className="text-4xl mb-3">📋</div>
                            <p className="text-sm">Aucune facture.</p>
                            <button onClick={handleNew} className="mt-3 text-sm text-emerald-600 font-semibold hover:underline">Créer →</button>
                        </div>
                    ) : filtered.map(inv => {
                        const { total } = calc(inv.items, inv.taxRate);
                        const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
                        return (
                            <div key={inv.id} onClick={() => handleEdit(inv)}
                                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-800/50 last:border-0 group">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold" style={{ background: '#05966915', color: '#059669' }}>
                                        {inv.clientName?.slice(0,2).toUpperCase() || '??'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{inv.clientName || '—'}</p>
                                        <p className="text-[11px] text-gray-400">{inv.invoiceNumber} · {inv.issueDate}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100 w-28 text-right tabular-nums">{fmt(total, inv.currency)}</span>
                                    <button onClick={e => { e.stopPropagation(); window.confirm('Supprimer ?') && deleteInvoice(inv.id); }}
                                        className="p-1 rounded-lg opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all">
                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── EDITOR ──────────────────────────────────────────────
    if (!draft) return null;
    const { sub, tax, total } = calc(draft.items, draft.taxRate);

    return (
        <div style={{ margin: '-24px' }} className="min-h-full flex flex-col relative">
            {/* Toast Notification */}
            {showSaveToast && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 font-medium text-sm">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Facture sauvegardée avec succès !
                </div>
            )}

            {/* Editor toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView('dashboard')} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 5 5 12 12 19"/></svg>
                    </button>
                    <div>
                        <p className="text-sm font-bold text-gray-800 dark:text-white">{draft.invoiceNumber}</p>
                        <p className="text-[10px] text-gray-400">{saved ? '✓ Sauvegardé' : '• Non sauvegardé'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select value={draft.status} onChange={e => setDraft(d => ({...d, status: e.target.value}))}
                        className="text-[10px] font-bold uppercase border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-transparent text-gray-600 dark:text-gray-300 outline-none cursor-pointer">
                        {Object.entries(STATUS_MAP).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <select value={draft.currency} onChange={e => setDraft(d => ({...d, currency: e.target.value}))}
                        className="text-[10px] font-bold border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-transparent text-gray-600 dark:text-gray-300 outline-none cursor-pointer">
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {/* Contact search button */}
                    <button onClick={() => setShowContactSearch(true)}
                        className="h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-1.5"
                        title="Rechercher un contact">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        Contact
                    </button>
                    {/* WhatsApp send button */}
                    <button onClick={handleSendWhatsApp} disabled={sendingWhatsApp || !draft.clientPhone}
                        className="h-8 px-3 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-all disabled:opacity-40 active:scale-[.97]"
                        style={{ background: '#25D366' }}
                        title="Envoyer via WhatsApp">
                        {sendingWhatsApp ? (
                            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.624-1.467A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-2.168 0-4.19-.585-5.931-1.605l-.425-.253-2.742.87.883-2.659-.277-.44A9.778 9.778 0 012.182 12c0-5.414 4.404-9.818 9.818-9.818S21.818 6.586 21.818 12 17.414 21.818 12 21.818z"/></svg>
                        )}
                        WhatsApp
                    </button>
                    <button onClick={handleExportPDF}
                        className="h-8 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-1.5">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        Export PDF
                    </button>
                    <button onClick={handleSave}
                        className="h-8 px-5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 active:scale-[.97] transition-transform"
                        style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                        Sauvegarder
                    </button>
                </div>
            </div>

            {/* Contact Search Modal */}
            {showContactSearch && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm" onClick={() => setShowContactSearch(false)}>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-800 animate-in" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
                            <p className="text-sm font-bold text-gray-800 dark:text-white mb-3">Rechercher un contact</p>
                            <div className="flex gap-2">
                                <input
                                    autoFocus
                                    className="flex-1 h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:ring-2 ring-emerald-400 placeholder:text-gray-400 transition"
                                    placeholder="Nom, email ou téléphone..."
                                    value={contactSearchQuery}
                                    onChange={e => setContactSearchQuery(e.target.value)}
                                />
                                <select value={contactFilterSegment} onChange={e => setContactFilterSegment(e.target.value)}
                                    className="h-9 px-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300 outline-none cursor-pointer">
                                    <option value="all">Tous segments</option>
                                    {contactSegments.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                            {filteredContacts.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm">Aucun contact trouvé</div>
                            ) : filteredContacts.map(c => (
                                <button key={c.id} onClick={() => handleSelectContact(c)}
                                    className="w-full text-left px-5 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ background: '#05966915', color: '#059669' }}>
                                            {(c.name || '?').slice(0,2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{c.name}</p>
                                            <p className="text-[11px] text-gray-400">{c.phone} {c.email ? `· ${c.email}` : ''}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {c.segment_name && <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">{c.segment_name}</span>}
                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-300 group-hover:text-emerald-500 transition-colors"><polyline points="9 18 15 12 9 6"/></svg>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Main body */}
            <div className="flex flex-1 min-h-0">
                {/* Canvas */}
                <div className="flex-1 overflow-y-auto p-8 bg-[#f5f6f8] dark:bg-[#0f1115]">
                    {draft.template === 'stripe' ? (
                        <div className="max-w-3xl mx-auto rounded-none shadow-2xl p-14 bg-[#f7f7f9] text-[#333] font-['Inter',sans-serif]">
                            {/* Header */}
                            <div className="flex justify-between items-center mb-5">
                                <h1 className="text-5xl font-extrabold text-[#3b1485] tracking-widest uppercase m-0">Facture</h1>
                                <LogoPicker value={draft.companyLogo} onChange={v => setDraft(d => ({...d, companyLogo: v}))} label="Logo" size={80}/>
                            </div>
                            
                            <hr className="border-t border-[#d1d1e0] my-8" />
                            
                            {/* Billing Info */}
                            <div className="flex justify-between mb-10">
                                <div className="flex-1 max-w-xs">
                                    <h2 className="text-lg font-bold text-[#333] mt-0 mb-4">Facturé à :</h2>
                                    <input className="w-full text-base font-bold text-[#333] bg-transparent outline-none pb-1 placeholder:text-gray-400 focus:border-[#3b1485] transition-colors"
                                        value={draft.clientName} onChange={e => setDraft(d => ({...d, clientName: e.target.value}))} placeholder="Client / Société"/>
                                    <textarea className="w-full bg-transparent text-sm text-[#5a5a75] outline-none resize-none mt-2 leading-relaxed" rows={2}
                                        value={draft.clientAddress} onChange={e => setDraft(d => ({...d, clientAddress: e.target.value}))} placeholder="Adresse du client"/>
                                </div>
                                <div className="text-right mt-10 text-sm text-[#5a5a75] leading-relaxed">
                                    <div className="flex gap-2 justify-end mb-1"><span className="font-semibold">No :</span><input className="w-32 text-right bg-transparent outline-none text-[#333] font-bold" value={draft.invoiceNumber} onChange={e => setDraft(d => ({...d, invoiceNumber: e.target.value}))} /></div>
                                    <div className="flex gap-2 justify-end mb-1"><span className="font-semibold">Émission :</span><input type="date" className="bg-transparent outline-none" value={draft.issueDate} onChange={e => setDraft(d => ({...d, issueDate: e.target.value}))}/></div>
                                    <div className="flex gap-2 justify-end"><span className="font-semibold">Échéance :</span><input type="date" className="bg-transparent outline-none" value={draft.dueDate} onChange={e => setDraft(d => ({...d, dueDate: e.target.value}))}/></div>
                                </div>
                            </div>
                            
                            {/* Table */}
                            <div className="mb-10">
                                <div className="bg-[#3b1485] text-white px-5 py-3 grid grid-cols-[1fr_4fr_1fr_2fr_2fr_1fr] md:grid-cols-[24px_4fr_1fr_2fr_2fr_24px] gap-2 items-center text-[13px] font-bold tracking-wide">
                                    <div></div>
                                    <div>DESCRIPTION</div>
                                    <div className="text-center">QTÉ</div>
                                    <div className="text-center">PRIX</div>
                                    <div className="text-right">TOTAL</div>
                                    <div></div>
                                </div>
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                                    <div className="bg-white/50">
                                        <SortableContext items={draft.items} strategy={verticalListSortingStrategy}>
                                            {draft.items.map(item => (
                                                <SortableLine key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} currency={draft.currency}/>
                                            ))}
                                        </SortableContext>
                                    </div>
                                </DndContext>
                                <button onClick={addItem}
                                    className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#3b1485] hover:text-[#2a0e63] transition-colors no-print">
                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                    Ajouter une ligne
                                </button>
                            </div>

                            {/* Bottom Section */}
                            <div className="flex justify-between items-start mt-8">
                                <div className="w-[45%]">
                                    <h3 className="text-[1.1em] font-bold text-[#3b1485] mb-3 mt-0">Notes :</h3>
                                    <textarea className="w-full text-sm bg-transparent outline-none resize-none text-[#5a5a75] leading-relaxed border-b border-[#d1d1e0] focus:border-[#3b1485] transition-colors" rows={3}
                                        value={draft.notes} onChange={e => setDraft(d => ({...d, notes: e.target.value}))} placeholder="Notes et instructions de paiement..."/>
                                    
                                    <hr className="border-t border-[#d1d1e0] my-6 w-64" />
                                    
                                    <h3 className="text-[1.1em] font-bold text-[#3b1485] mb-3 mt-0">Coordonnées :</h3>
                                    <input className="w-full text-sm font-bold text-[#5a5a75] bg-transparent outline-none border-b border-[#d1d1e0] pb-1 mb-1 focus:border-[#3b1485]"
                                        value={draft.companyName} onChange={e => setDraft(d => ({...d, companyName: e.target.value}))} placeholder="Votre entreprise"/>
                                    <input className="w-full text-sm text-[#5a5a75] bg-transparent outline-none border-b border-[#d1d1e0] pb-1 mb-2 focus:border-[#3b1485]"
                                        value={draft.companyTagline} onChange={e => setDraft(d => ({...d, companyTagline: e.target.value}))} placeholder="Sous-titre / Slogan"/>
                                    <textarea className="w-full text-sm text-[#5a5a75] bg-transparent outline-none resize-none leading-relaxed border-b border-[#d1d1e0] pb-1 focus:border-[#3b1485]" rows={3}
                                        value={draft.senderInfo} onChange={e => setDraft(d => ({...d, senderInfo: e.target.value}))} placeholder="Adresse et Contact"/>
                                </div>
                                <div className="w-[45%]">
                                    <div className="flex justify-between py-2 text-[0.95em] text-[#333] font-medium"><span>Sous-Total :</span><span>{fmt(sub, draft.currency)}</span></div>
                                    <hr className="border-t border-[#9ba4b5] mx-5 my-1" />
                                    <div className="flex justify-between items-center py-2 text-[0.95em] text-[#333] font-medium">
                                        <span className="flex items-center gap-1.5">TVA
                                            <input type="number" min="0" max="100" step="0.5"
                                                className="w-12 text-center text-xs bg-gray-50 rounded-md py-0.5 outline-none border border-gray-200 no-print"
                                                value={draft.taxRate} onChange={e => setDraft(d => ({...d, taxRate: parseFloat(e.target.value) || 0}))}/>% :
                                        </span>
                                        <span>{fmt(tax, draft.currency)}</span>
                                    </div>
                                    <div className="bg-[#3b1485] text-white flex justify-between p-4 px-5 text-[1.1em] font-bold mt-2.5">
                                        <span>Total :</span>
                                        <span>{fmt(total, draft.currency)}</span>
                                    </div>
                                    
                                    <div className="mt-10 border border-[#d1d1d1] h-[120px] bg-white flex justify-center items-end pb-5">
                                        <span className="text-[#a0a0a0] italic text-[0.9em]">WaCopilote Automation</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : draft.template === 'bold' ? (
                        <div className="max-w-3xl mx-auto rounded-2xl shadow-xl overflow-hidden relative" style={{ backgroundColor: '#ede8dc', backgroundImage: 'radial-gradient(circle at top right, #f6f4ee 0%, #ede8dc 40%)' }}>
                            <div className="p-12 space-y-10 text-[#0a2533] font-['Montserrat',sans-serif]">
                                {/* Header */}
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <LogoPicker value={draft.companyLogo} onChange={v => setDraft(d => ({...d, companyLogo: v}))} label="Logo" size={48}/>
                                        <div>
                                            <input className="text-lg font-bold text-[#0a2533] uppercase tracking-wider bg-transparent outline-none w-full placeholder:text-gray-400"
                                                value={draft.companyName} onChange={e => setDraft(d => ({...d, companyName: e.target.value}))} placeholder="VOTRE ENTREPRISE"/>
                                            <input className="text-sm text-[#0a2533] bg-transparent outline-none w-full placeholder:text-gray-400 mt-0.5"
                                                value={draft.companyTagline} onChange={e => setDraft(d => ({...d, companyTagline: e.target.value}))} placeholder="Sous-titre / Slogan"/>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <input className="text-4xl font-bold text-[#0a2533] bg-transparent outline-none text-right w-48 tracking-widest uppercase"
                                            value={draft.invoiceNumber} onChange={e => setDraft(d => ({...d, invoiceNumber: e.target.value}))}/>
                                    </div>
                                </div>

                                {/* Info Section */}
                                <div className="flex justify-between items-start mt-4">
                                    <div className="flex-1 max-w-sm">
                                        <p className="text-xs font-bold uppercase tracking-wider mb-2">DE</p>
                                        <textarea className="w-full bg-transparent text-sm text-[#0a2533] font-medium outline-none resize-none leading-relaxed" rows={3}
                                            value={draft.senderInfo} onChange={e => setDraft(d => ({...d, senderInfo: e.target.value}))}
                                            placeholder={"Nom de l'entreprise\nAdresse\nEmail"}/>
                                        
                                        <p className="text-xs font-bold uppercase tracking-wider mt-4 mb-2">FACTURÉ À</p>
                                        <div className="flex items-start gap-3">
                                            <LogoPicker value={draft.clientLogo} onChange={v => setDraft(d => ({...d, clientLogo: v}))} label="Client" size={40}/>
                                            <div className="flex-1">
                                                <input className="w-full text-base font-bold text-[#0a2533] bg-transparent outline-none border-b border-[#0a2533]/20 pb-1 placeholder:text-gray-400 focus:border-[#48a69e] transition-colors"
                                                    value={draft.clientName} onChange={e => setDraft(d => ({...d, clientName: e.target.value}))} placeholder="Client / Société"/>
                                                <textarea className="w-full bg-transparent text-sm text-[#0a2533] font-medium outline-none resize-none mt-2 leading-relaxed" rows={2}
                                                    value={draft.clientAddress} onChange={e => setDraft(d => ({...d, clientAddress: e.target.value}))} placeholder="Adresse du client"/>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right space-y-3 mt-8">
                                        <div>
                                            <p className="text-xs font-bold uppercase mb-1">Date</p>
                                            <input type="date" className="text-sm font-medium text-[#0a2533] bg-transparent outline-none" value={draft.issueDate} onChange={e => setDraft(d => ({...d, issueDate: e.target.value}))}/>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold uppercase mb-1">Échéance</p>
                                            <input type="date" className="text-sm font-medium text-[#0a2533] bg-transparent outline-none" value={draft.dueDate} onChange={e => setDraft(d => ({...d, dueDate: e.target.value}))}/>
                                        </div>
                                    </div>
                                </div>

                                {/* Table */}
                                <div>
                                    <div className="text-white rounded-[20px] px-8 py-3.5 mb-4 grid grid-cols-[1fr_4fr_2fr_2fr_3fr_1fr] md:grid-cols-[24px_4fr_2fr_2fr_3fr_24px] gap-2 items-center text-[13px] font-bold tracking-wider" style={{ background: 'linear-gradient(90deg, #256a7c, #48a69e)' }}>
                                        <div></div>
                                        <div className="col-span-1">DESCRIPTION</div>
                                        <div className="text-center">QTÉ</div>
                                        <div className="text-center">PRIX</div>
                                        <div className="text-right">TOTAL</div>
                                        <div></div>
                                    </div>
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                                        <div className="bg-white rounded-[20px] px-8 py-5">
                                            <SortableContext items={draft.items} strategy={verticalListSortingStrategy}>
                                                {draft.items.map(item => (
                                                    <SortableLine key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} currency={draft.currency}/>
                                                ))}
                                            </SortableContext>
                                        </div>
                                    </DndContext>
                                    <button onClick={addItem}
                                        className="mt-3 ml-2 flex items-center gap-1.5 text-xs font-bold text-[#256a7c] hover:text-[#48a69e] transition-colors no-print">
                                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                        Ajouter une ligne
                                    </button>
                                </div>

                                {/* Summary */}
                                <div className="flex gap-8 items-start mt-8">
                                    <div className="flex-1">
                                        <p className="text-[11px] font-bold uppercase tracking-wider mb-2">NOTES</p>
                                        <textarea className="w-full text-sm bg-transparent outline-none resize-none text-[#0a2533] leading-relaxed border-b border-[#0a2533]/10 focus:border-[#48a69e] transition-colors" rows={4}
                                            value={draft.notes} onChange={e => setDraft(d => ({...d, notes: e.target.value}))} placeholder="Conditions de paiement et notes..."/>
                                    </div>
                                    <div className="w-[300px] bg-white rounded-[20px] p-6 text-sm font-semibold text-[#0a2533]">
                                        <div className="flex justify-between mb-3"><span>SOUS-TOTAL</span><span>{fmt(sub, draft.currency)}</span></div>
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="flex items-center gap-1.5">TVA
                                                <input type="number" min="0" max="100" step="0.5"
                                                    className="w-10 text-center text-xs bg-gray-50 rounded-md py-0.5 outline-none border border-gray-200 no-print"
                                                    value={draft.taxRate} onChange={e => setDraft(d => ({...d, taxRate: parseFloat(e.target.value) || 0}))}/>%
                                            </span>
                                            <span>{fmt(tax, draft.currency)}</span>
                                        </div>
                                        <div className="flex justify-between items-center mt-5 pt-5 border-t-2 border-[#ede8dc] text-lg font-bold">
                                            <span>TOTAL</span>
                                            <span>{fmt(total, draft.currency)}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Footer Banner */}
                                <div className="rounded-full px-8 py-3.5 flex justify-between items-center text-white text-xs font-medium" style={{ background: '#072535' }}>
                                    <span>Généré par WaCopilote</span>
                                    <span>MERCI POUR VOTRE CONFIANCE</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto bg-white dark:bg-[#1a1f25] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                            <div className="h-1.5 bg-gradient-to-r from-emerald-600 to-emerald-400"></div>
                            <div className="p-10 space-y-10">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <LogoPicker value={draft.companyLogo} onChange={v => setDraft(d => ({...d, companyLogo: v}))} label="Logo" size={56}/>
                                        <div>
                                            <input className="text-xl font-extrabold text-gray-900 dark:text-white bg-transparent outline-none w-full placeholder:text-gray-300 tracking-tight"
                                                value={draft.companyName} onChange={e => setDraft(d => ({...d, companyName: e.target.value}))} placeholder="Votre entreprise"/>
                                            <input className="text-sm text-gray-400 bg-transparent outline-none w-full placeholder:text-gray-300 mt-0.5"
                                                value={draft.companyTagline} onChange={e => setDraft(d => ({...d, companyTagline: e.target.value}))} placeholder="Sous-titre"/>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gray-400 mb-1">Facture</p>
                                        <input className="text-xl font-extrabold text-gray-900 dark:text-white bg-transparent outline-none text-right w-48 tracking-tight"
                                            value={draft.invoiceNumber} onChange={e => setDraft(d => ({...d, invoiceNumber: e.target.value}))}/>
                                        <div className="flex gap-6 justify-end mt-3">
                                            <div>
                                                <p className="text-[9px] font-bold uppercase text-gray-400">Date</p>
                                                <input type="date" className="text-sm text-gray-700 dark:text-gray-300 bg-transparent outline-none" value={draft.issueDate} onChange={e => setDraft(d => ({...d, issueDate: e.target.value}))}/>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase text-gray-400">Échéance</p>
                                                <input type="date" className="text-sm text-gray-700 dark:text-gray-300 bg-transparent outline-none" value={draft.dueDate} onChange={e => setDraft(d => ({...d, dueDate: e.target.value}))}/>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-10">
                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5">
                                        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gray-400 mb-3">De</p>
                                        <textarea className="w-full bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none resize-none leading-relaxed" rows={4}
                                            value={draft.senderInfo} onChange={e => setDraft(d => ({...d, senderInfo: e.target.value}))}
                                            placeholder={"Nom de l'entreprise\nAdresse\nEmail"}/>
                                    </div>
                                    <div className="p-5">
                                        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gray-400 mb-3">Facturé à</p>
                                        <div className="flex items-start gap-3">
                                            <LogoPicker value={draft.clientLogo} onChange={v => setDraft(d => ({...d, clientLogo: v}))} label="Client" size={40}/>
                                            <div className="flex-1">
                                                <input className="w-full text-base font-bold text-gray-900 dark:text-white bg-transparent outline-none border-b border-gray-200 dark:border-gray-700 pb-1 placeholder:text-gray-300 focus:border-emerald-500 transition-colors"
                                                    value={draft.clientName} onChange={e => setDraft(d => ({...d, clientName: e.target.value}))} placeholder="Client / Société"/>
                                                <textarea className="w-full bg-transparent text-sm text-gray-500 outline-none resize-none mt-2 leading-relaxed" rows={2}
                                                    value={draft.clientAddress} onChange={e => setDraft(d => ({...d, clientAddress: e.target.value}))} placeholder="Adresse du client"/>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b-2 border-gray-100 dark:border-gray-700">
                                                <th className="w-6"></th>
                                                <th className="text-left text-[9px] font-bold uppercase tracking-[.15em] text-gray-400 pb-3">Description</th>
                                                <th className="text-center text-[9px] font-bold uppercase tracking-[.15em] text-gray-400 pb-3 w-20">Qté</th>
                                                <th className="text-right text-[9px] font-bold uppercase tracking-[.15em] text-gray-400 pb-3 w-28">Prix</th>
                                                <th className="text-right text-[9px] font-bold uppercase tracking-[.15em] text-gray-400 pb-3 w-28">Total</th>
                                                <th className="w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <SortableContext items={draft.items} strategy={verticalListSortingStrategy}>
                                                {draft.items.map(item => (
                                                    <SortableLine key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} currency={draft.currency}/>
                                                ))}
                                            </SortableContext>
                                        </tbody>
                                    </table>
                                    </DndContext>
                                    <button onClick={addItem}
                                        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors no-print">
                                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                        Ajouter une ligne
                                    </button>
                                </div>
                                <div className="flex justify-between gap-8 pt-8 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex-1 max-w-xs">
                                        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gray-400 mb-2">Notes</p>
                                        <textarea className="w-full text-sm bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3.5 outline-none resize-none text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700 focus:border-emerald-400 transition-colors" rows={4}
                                            value={draft.notes} onChange={e => setDraft(d => ({...d, notes: e.target.value}))} placeholder="Note au client..."/>
                                    </div>
                                    <div className="w-64 space-y-2.5">
                                        <div className="flex justify-between text-sm text-gray-500"><span>Sous-total</span><span className="tabular-nums">{fmt(sub, draft.currency)}</span></div>
                                        <div className="flex justify-between text-sm text-gray-500 items-center">
                                            <span className="flex items-center gap-1.5">TVA
                                                <input type="number" min="0" max="100" step="0.5"
                                                    className="w-10 text-center text-xs bg-gray-50 dark:bg-gray-800 rounded-md py-0.5 outline-none border border-gray-200 dark:border-gray-700 no-print"
                                                    value={draft.taxRate} onChange={e => setDraft(d => ({...d, taxRate: parseFloat(e.target.value) || 0}))}/>%
                                            </span>
                                            <span className="tabular-nums">{fmt(tax, draft.currency)}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-700">
                                            <span className="text-sm font-bold text-gray-800 dark:text-white">Total</span>
                                            <span className="text-2xl font-extrabold text-emerald-600 tabular-nums">{fmt(total, draft.currency)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>


                {/* Sidebar: Templates */}
                <aside className="w-64 bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 p-5 flex flex-col gap-6 overflow-y-auto no-print">
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gray-400 mb-4">Modèle</p>
                        <div className="space-y-4">
                            {TPL_PREVIEWS.map(t => (
                                <TplThumb key={t.id} tpl={t} active={draft.template === t.id} onClick={() => setDraft(d => ({...d, template: t.id}))}/>
                            ))}
                        </div>
                    </div>

                    {/* Quick summary */}
                    <div className="mt-auto pt-5 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gray-400 mb-3">Résumé</p>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between text-gray-500"><span>Lignes</span><span className="font-semibold">{draft.items.length}</span></div>
                            <div className="flex justify-between text-gray-500"><span>Sous-total</span><span className="font-semibold">{fmt(sub, draft.currency)}</span></div>
                            <div className="flex justify-between text-gray-500"><span>TVA</span><span className="font-semibold">{fmt(tax, draft.currency)}</span></div>
                            <div className="flex justify-between font-bold text-gray-800 dark:text-white pt-2 border-t border-gray-100 dark:border-gray-800">
                                <span>Total</span><span className="text-emerald-600">{fmt(total, draft.currency)}</span>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
