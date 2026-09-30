const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const FONT_SIZE = 11;
const LINE_HEIGHT = 14;
const CHAR_WIDTH = FONT_SIZE * 0.5;

const pdfEscape = (value) =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, (char) => {
      const code = char.charCodeAt(0);
      return code < 256 ? String.fromCharCode(code) : '?';
    });

const wrapParagraph = (paragraph, maxChars) => {
  if (!String(paragraph || '').trim()) return [''];
  const words = String(paragraph).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

export const createPlainTextPdfBytes = (text) => {
  const maxChars = Math.max(24, Math.floor((PAGE_W - MARGIN * 2) / CHAR_WIDTH));
  const lines = String(text || '')
    .split('\n')
    .flatMap((paragraph) => wrapParagraph(paragraph, maxChars));
  const linesPerPage = Math.max(1, Math.floor((PAGE_H - MARGIN * 2) / LINE_HEIGHT));
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (!pages.length) pages.push(['']);

  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };

  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const contentIds = pages.map((pageLines) => {
    let y = PAGE_H - MARGIN;
    const commands = ['BT', '/F1 11 Tf', '14 TL'];
    pageLines.forEach((line, index) => {
      if (index === 0) commands.push(`${MARGIN} ${y} Td`);
      else commands.push('T*');
      commands.push(`(${pdfEscape(line)}) Tj`);
    });
    commands.push('ET');
    const stream = commands.join('\n');
    return add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  const pageIds = contentIds.map((contentId) =>
    add(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    ),
  );
  const pagesId = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  pageIds.forEach((id) => {
    objects[id - 1] = objects[id - 1].replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
  });
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let offset = 0;
  const header = '%PDF-1.4\n';
  offset += header.length;
  const xref = [0];
  const body = objects
    .map((object, index) => {
      const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`;
      xref.push(offset);
      offset += chunk.length;
      return chunk;
    })
    .join('');
  const xrefStart = offset;
  const xrefTable = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...xref.slice(1).map((pos) => `${String(pos).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>`,
    'startxref',
    String(xrefStart),
    '%%EOF',
  ].join('\n');
  return new TextEncoder().encode(header + body + xrefTable);
};
