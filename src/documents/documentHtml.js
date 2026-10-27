// Print-optimised HTML renderer for the app's structured PDF layout
// (utils/documentPdfLayout.ts: bordered From/Bill To/Ship To, meta, line-item table, sections,
// signature, footer). Output is opened in a hidden iframe and printed ("Save as PDF").

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const cell = (value) => {
  if (value == null || value === '') return '-';
  return escapeHtml(value);
};

const addressBlock = (block) => {
  if (!block) return '';
  const lines = (block.lines || []).filter(Boolean).map((line) => `<div>${escapeHtml(line)}</div>`);
  return `<div class="doc-box doc-party"><h3>${escapeHtml(block.title)}</h3>${lines.join('')}</div>`;
};

const metaColumn = (fields = []) =>
  `<div class="doc-box doc-meta">${fields
    .map((field) => `<p><b>${escapeHtml(field.label)}: </b>${cell(field.value)}</p>`)
    .join('')}</div>`;

const section = (item) => {
  const lines = (item?.lines || []).map((line) => String(line ?? '').trim()).filter(Boolean);
  if (!lines.length) return '';
  const body = lines
    .map((line) => `<div>${item.bullet ? '- ' : ''}${escapeHtml(line)}</div>`)
    .join('');
  return `<div class="doc-box doc-section"><h3>${escapeHtml(item.title)}</h3>${body}</div>`;
};

export const DOCUMENT_COLUMNS = [
  'S.No',
  'Description of Goods',
  'Qty',
  'Rate',
  'Taxable Value (INR)',
  'IGST (INR)',
  'Total (INR)',
];

const STYLES = `
@page { size: A4; margin: 10mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; line-height: 1.35; }
.doc { width: 100%; }
.doc-heading { margin: 0 0 8px; font-size: 12pt; font-weight: 700; letter-spacing: 0.02em; }
.doc-box { border: 0.8pt solid #000; padding: 6px; }
.doc-box h3 { margin: 0 0 3px; font-size: 10pt; }
.doc-row { display: flex; }
.doc-row > * { flex: 1 1 0; min-width: 0; }
.doc-row > * + * { margin-left: -0.8pt; }
.doc-party { min-height: 72px; overflow-wrap: anywhere; }
.doc-meta { margin-top: -0.8pt; min-height: 56px; overflow-wrap: anywhere; }
.doc-meta p { margin: 0 0 2px; }
.doc-table { width: 100%; margin-top: -0.8pt; border-collapse: collapse; table-layout: fixed; }
.doc-table th, .doc-table td { border: 0.6pt solid #000; padding: 5px 6px; font-size: 8pt; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
.doc-table th { font-weight: 700; }
.doc-table tr { break-inside: avoid; }
.doc-table td.num, .doc-table th.num { text-align: right; }
.doc-table tfoot td { font-weight: 700; }
.doc-section { margin-top: 8px; font-size: 8pt; break-inside: avoid; overflow-wrap: anywhere; }
.doc-section h3 { font-size: 9pt; }
.doc-sign { width: 42%; margin: 8px 0 0 auto; min-height: 56px; display: flex; flex-direction: column; justify-content: space-between; break-inside: avoid; }
.doc-sign b { font-size: 9pt; }
.doc-sign span { font-size: 8pt; }
.doc-footer { margin: 12px 0 0; font-size: 8pt; }
`;

const COLUMN_WIDTHS = [6, 31, 7, 10, 16, 14, 16];

/** @param {import('./documentData').StructuredDocumentInput} input */
export const renderDocumentHtml = (input, title = 'Document') => {
  const hasShip = Boolean(input.shipTo && (input.shipTo.title || (input.shipTo.lines || []).some(Boolean)));
  const items = input.lineItems?.length
    ? input.lineItems
    : [{ sno: 1, description: '-', qty: '-', rate: '-', taxableValue: '-', tax: '-', total: '-' }];
  const totalCells = DOCUMENT_COLUMNS.slice(2).map((_, index) => {
    const value = input.totals?.[index]?.value ?? '-';
    return `<td class="num">${cell(value)}</td>`;
  });
  const declaration = input.hideDeclaration
    ? ''
    : `<div class="doc-box doc-section"><h3>Declaration-</h3>${(
        input.declaration || [
          '1. This is a computer-generated document and does not require a physical signature.',
          '2. For support, contact Ayurmuni customer care through the app or website.',
        ]
      )
        .map((line) => `<div>${escapeHtml(line)}</div>`)
        .join('')}</div>`;
  const signatory = String(input.signatoryFor || '').trim();
  const signature =
    input.showSignature && signatory
      ? `<div class="doc-box doc-sign"><b>For ${escapeHtml(signatory)}</b><span>Authorized Signatory</span></div>`
      : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLES}</style></head><body><main class="doc">
${input.documentHeading ? `<h1 class="doc-heading">${escapeHtml(input.documentHeading)}</h1>` : ''}
<div class="doc-row">${addressBlock(input.from)}${addressBlock(input.billTo)}${hasShip ? addressBlock(input.shipTo) : ''}</div>
<div class="doc-row">${metaColumn(input.leftMeta)}${metaColumn(input.rightMeta)}</div>
<table class="doc-table"><colgroup>${COLUMN_WIDTHS.map((w) => `<col style="width:${w}%">`).join('')}</colgroup>
<thead><tr>${DOCUMENT_COLUMNS.map((head, index) => `<th${index >= 2 ? ' class="num"' : ''}>${escapeHtml(head)}</th>`).join('')}</tr></thead>
<tbody>${items
    .map(
      (item) =>
        `<tr><td>${cell(item.sno)}</td><td>${cell(item.description)}</td><td class="num">${cell(item.qty)}</td><td class="num">${cell(item.rate)}</td><td class="num">${cell(item.taxableValue)}</td><td class="num">${cell(item.tax)}</td><td class="num">${cell(item.total)}</td></tr>`,
    )
    .join('')}</tbody>
<tfoot><tr><td colspan="2">Total</td>${totalCells.join('')}</tr></tfoot></table>
${(input.sections || []).map(section).join('')}
${signature}
${declaration}
<p class="doc-footer">${escapeHtml(input.footerNote || 'This is a computer generated document.')}</p>
</main></body></html>`;
};

/**
 * Prints the HTML through a hidden iframe so the user can pick "Save as PDF". Resolves true once the
 * print dialog was requested, false when the browser blocked it (no iframe window).
 */
export const printDocumentHtml = (html) =>
  new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(false);
      return;
    }
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    const cleanup = () => setTimeout(() => frame.remove(), 1500);
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) {
        cleanup();
        resolve(false);
        return;
      }
      win.addEventListener('afterprint', cleanup, { once: true });
      setTimeout(() => {
        try {
          win.focus();
          win.print();
          resolve(true);
        } catch {
          resolve(false);
        }
        setTimeout(() => frame.remove(), 60000);
      }, 150);
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
