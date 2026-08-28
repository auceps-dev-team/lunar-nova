// Extension .js explicite requise par le résolveur ESM natif de Node (utilisé
// par backend/services/invoiceService.js pour le rendu PDF serveur) — Vite
// tolère les deux formes, donc ce changement n'affecte pas le build frontend.
import { calc, fmt } from './helpers.js';

export function buildInvoiceHTML(draft, t) {
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
    <title>${t('invoiceTemplatePurple')}</title>
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
            <h1 class="invoice-title">${t('invoice')}</h1>
            <div class="logo">
                ${logoHTML}
            </div>
        </div>

        <hr class="divider">

        <div class="billing-info">
            <div class="invoice-to">
                <h2>${t('billedToColon')}</h2>
                <p><strong>${draft.clientName || t('clientCompany')}</strong></p>
                <p>${draft.clientAddress}</p>
            </div>
            <div class="invoice-meta">
                <p>${t('noColon')} ${draft.invoiceNumber}<br>
                ${t('issuedColon')} ${draft.issueDate}<br>
                ${t('dueDateColon')} ${draft.dueDate}</p>
            </div>
        </div>

        <div class="table-container">
            <div class="table-header">
                <div>${t('descriptionCaps')}</div>
                <div class="col-center">${t('qtyCaps')}</div>
                <div class="col-center">${t('priceCaps')}</div>
                <div class="col-right">${t('totalCaps')}</div>
            </div>
            ${rows}
        </div>

        <div class="bottom-section">
            <div class="bottom-left">
                ${draft.notes ? `<h3 class="section-title">${t('notesColon')}</h3><p class="detail-text">${draft.notes}</p><hr class="divider-short">` : ''}
                <h3 class="section-title">${t('contactDetailsColon')}</h3>
                <p class="detail-text">${draft.companyName || t('yourCompany')}<br>${draft.companyTagline || ''}<br>${draft.senderInfo || '—'}</p>
            </div>

            <div class="bottom-right">
                <div class="totals-row">
                    <span>${t('subtotalColon')}</span>
                    <span>${fmt(sub, draft.currency)}</span>
                </div>
                
                <hr class="totals-divider">
                
                <div class="totals-row">
                    <span>${t('vat')} (${draft.taxRate}%) :</span>
                    <span>${fmt(tax, draft.currency)}</span>
                </div>

                <div class="total-box">
                    <span>${t('totalColon')}</span>
                    <span>${fmt(total, draft.currency)}</span>
                </div>

                <div class="signature-box">
                    <span class="signature-text">${t('brandWacopiloteAutomation')}</span>
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
    <title>${t('invoiceTemplate')}</title>
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
                    <div class="company-name">${draft.companyName || t('yourCompany')}</div>
                    <div class="company-sub">${draft.companyTagline || ''}</div>
                </div>
            </div>
            <div class="invoice-title">${draft.invoiceNumber}</div>
        </div>

        <div class="info-section">
            <div class="info-left">
                <h3>${t('fromCaps')}</h3>
                <p style="white-space:pre-line">${draft.senderInfo || '—'}</p>
                
                <h3>${t('billedToCaps')}</h3>
                <p><strong>${draft.clientName || t('clientCompany')}</strong></p>
                <p style="white-space:pre-line">${draft.clientAddress}</p>
            </div>
            <div class="info-right">
                <p>${t('number')}: ${draft.invoiceNumber}</p>
                <p>${t('date')}: ${draft.issueDate}</p>
                <p>${t('dueDate')}: ${draft.dueDate}</p>
            </div>
        </div>

        <div class="table-header">
            <div>${t('descriptionCaps')}</div>
            <div class="col-center">${t('qtyCaps')}</div>
            <div class="col-center">${t('priceCaps')}</div>
            <div class="col-right">${t('totalCaps')}</div>
        </div>

        <div class="table-body">
            ${rows}
        </div>

        <div class="summary-section">
            <div class="notes">
                ${draft.notes ? `<h4>${t('notesCaps')}</h4><p style="white-space: pre-line">${draft.notes}</p>` : ''}
            </div>
            <div class="totals">
                <div class="total-row"><span>${t('subtotalCaps')}</span><span>${fmt(sub, draft.currency)}</span></div>
                <div class="total-row"><span>${t('vat')} (${draft.taxRate}%)</span><span>${fmt(tax, draft.currency)}</span></div>
                <div class="total-row grand-total"><span>${t('totalCaps')}</span><span>${fmt(total, draft.currency)}</span></div>
            </div>
        </div>

        <div class="footer-banner">
            <span>${t('generatedByWacopilote')}</span>
            <span>${t('thankYouForBusiness')}</span>
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
                    <div style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.3px">${draft.companyName || t('yourCompany')}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:2px">${draft.companyTagline || ''}</div>
                </div>
            </div>
            <div style="text-align:right">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">${t('invoice')}</div>
                <div style="font-size:22px;font-weight:800;color:#0f172a">${draft.invoiceNumber}</div>
                <div style="display:flex;gap:24px;justify-content:flex-end;margin-top:10px">
                    <div><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">${t('date')}</div><div style="font-size:13px;color:#334155;margin-top:2px">${draft.issueDate}</div></div>
                    <div><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">${t('dueDate')}</div><div style="font-size:13px;color:#334155;margin-top:2px">${draft.dueDate}</div></div>
                </div>
            </div>
        </div>

        <!-- Addresses -->
        <div style="display:flex;gap:40px;margin-bottom:36px">
            <div style="flex:1;background:#f8fafc;border-radius:12px;padding:18px">
                <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px">${t('from')}</div>
                <div style="font-size:13px;color:#334155;white-space:pre-line;line-height:1.7">${draft.senderInfo || '—'}</div>
            </div>
            <div style="flex:1;padding:18px">
                <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px">${t('billedTo')}</div>
                ${clientLogoHTML}
                <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px">${draft.clientName || '—'}</div>
                <div style="font-size:13px;color:#64748b;white-space:pre-line;line-height:1.7">${draft.clientAddress || ''}</div>
            </div>
        </div>

        <!-- Items table -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
            <thead><tr>
                <th style="padding:10px 8px;text-align:left;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #e2e8f0">${t('description')}</th>
                <th style="padding:10px 8px;text-align:center;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #e2e8f0;width:60px">${t('qty')}</th>
                <th style="padding:10px 8px;text-align:right;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #e2e8f0;width:100px">${t('price')}</th>
                <th style="padding:10px 8px;text-align:right;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #e2e8f0;width:100px">${t('total')}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>

        <!-- Totals -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:36px">
            <div style="width:260px">
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#64748b"><span>${t('subtotal')}</span><span>${fmt(sub, draft.currency)}</span></div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#64748b"><span>${t('vat')} (${draft.taxRate}%)</span><span>${fmt(tax, draft.currency)}</span></div>
                <div style="display:flex;justify-content:space-between;padding:10px 0;margin-top:8px;border-top:2px solid #e2e8f0;font-size:18px;font-weight:800"><span style="color:#0f172a">${t('total')}</span><span class="accent">${fmt(total, draft.currency)}</span></div>
            </div>
        </div>

        ${draft.notes ? `<div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:24px"><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">${t('notes')}</div><div style="font-size:12px;color:#64748b;line-height:1.6">${draft.notes}</div></div>` : ''}

        <div style="text-align:center;padding-top:24px;border-top:1px solid #f1f5f9;font-size:10px;color:#cbd5e1">${t('autoGeneratedInvoice')} · ${draft.companyName || t('yourCompany')}</div>
    </div>
    </body></html>`;
}
