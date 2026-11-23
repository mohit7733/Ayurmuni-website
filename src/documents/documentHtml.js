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
  const lines = (block.lines || []).filter(Boolean).map(
    (line, index) => `<div>${index === 0 ? `<b>${escapeHtml(line)}</b>` : escapeHtml(line)}</div>`,
  );
  return `<div class="doc-box doc-party"><h3>${escapeHtml(block.title)}</h3>${lines.join('')}</div>`;
};

const metaColumn = (fields = [], heading = '') =>
  `<div class="doc-box doc-meta">${heading ? `<h3>${escapeHtml(heading)}</h3>` : ''}${fields
    .map((field) => `<p><b>${escapeHtml(field.label)}: </b>${cell(field.value)}</p>`)
    .join('')}</div>`;

const partyBlock = (block, invoice) => {
  if (!block) return '';
  if (!invoice) return addressBlock(block);
  const title = String(block.title || '').trim();
  const next = /^from$/i.test(title) ? 'Sender:' : title.endsWith(':') ? title : `${title}:`;
  return addressBlock({ ...block, title: next });
};

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
.doc-invoice .doc-table th, .doc-invoice .doc-table td { white-space: pre-line; }
.doc-invoice .doc-eoe { margin: 6px 2px 0; text-align: right; font-size: 8pt; line-height: 1.45; }
.doc-invoice .doc-closing { margin-top: 8px; align-items: stretch; }
.doc-invoice .doc-closing .doc-section { margin-top: 0; flex: 1.6 1 0; }
.doc-invoice .doc-closing .doc-sign { width: auto; flex: 1 1 0; margin: 0; min-height: 78px; }
.doc-invoice .doc-footer { margin: 0; padding: 6px; border: 0.8pt solid #000; text-align: center; }
`;

const COLUMN_WIDTHS = [6, 31, 7, 10, 16, 14, 16];

/** @param {import('./documentData').StructuredDocumentInput} input */
export const renderDocumentHtml = (input, title = 'Document') => {
  const invoice = input.variant === 'invoice';
  const hasShip = Boolean(input.shipTo && (input.shipTo.title || (input.shipTo.lines || []).some(Boolean)));
  const items = input.lineItems?.length
    ? input.lineItems
    : [{ sno: 1, description: '-', qty: '-', rate: '-', taxableValue: '-', tax: '-', total: '-' }];
  const customColumns = Array.isArray(input.columns) && input.columns.length ? input.columns : null;
  const columns = customColumns
    ? customColumns.map((column) => column.label)
    : invoice
      ? DOCUMENT_COLUMNS.map((head, index) => (index === DOCUMENT_COLUMNS.length - 1 ? 'Amount (INR)' : head))
      : DOCUMENT_COLUMNS;
  const widths = customColumns
    ? customColumns.map((column) => column.width || Math.floor(100 / customColumns.length))
    : COLUMN_WIDTHS;
  const totalCells = columns.slice(2).map((_, index) => {
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
  const eoe = invoice
    ? `<div class="doc-eoe"><div>E. &amp; OE.</div><div><b>Tax Payable on reverse charge basis:</b> ${escapeHtml(
        input.reverseCharge || 'No',
      )}</div></div>`
    : '';
  const closing = invoice ? `<div class="doc-row doc-closing">${declaration}${signature}</div>` : `${signature}${declaration}`;
  const metaRow = `${metaColumn(input.leftMeta, invoice ? input.leftMetaTitle || 'Invoice Details-' : '')}${metaColumn(
    input.rightMeta,
  )}${hasShip ? '<div class="doc-box doc-meta"></div>' : ''}`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLES}</style></head><body><main class="doc${invoice ? ' doc-invoice' : ''}">
${input.documentHeading && !invoice ? `<h1 class="doc-heading">${escapeHtml(input.documentHeading)}</h1>` : ''}
<div class="doc-row">${partyBlock(input.from, invoice)}${partyBlock(input.billTo, invoice)}${hasShip ? partyBlock(input.shipTo, invoice) : ''}</div>
<div class="doc-row">${metaRow}</div>
<table class="doc-table"><colgroup>${widths.map((w) => `<col style="width:${w}%">`).join('')}</colgroup>
<thead><tr>${columns
    .map((head, index) => {
      const numeric = customColumns ? Boolean(customColumns[index]?.numeric) : index >= 2;
      return `<th${numeric ? ' class="num"' : ''}>${escapeHtml(head)}</th>`;
    })
    .join('')}</tr></thead>
<tbody>${items
    .map((item) => {
      const values = customColumns
        ? customColumns.map((column) => item[column.key])
        : [item.sno, item.description, item.qty, item.rate, item.taxableValue, item.tax, item.total];
      return `<tr>${values
        .map((value, index) => {
          const numeric = customColumns ? Boolean(customColumns[index]?.numeric) : index >= 2;
          return `<td${numeric ? ' class="num"' : ''}>${cell(value)}</td>`;
        })
        .join('')}</tr>`;
    })
    .join('')}</tbody>
${
  input.hideTotals
    ? ''
    : `<tfoot><tr><td colspan="2">${invoice ? 'Total:' : 'Total'}</td>${totalCells.join('')}</tr></tfoot>`
}</table>
${(input.sections || []).map(section).join('')}
${eoe}
${closing}
<p class="doc-footer">${escapeHtml(input.footerNote || (invoice ? 'This is a computer generated Invoice' : 'This is a computer generated document.'))}</p>
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
