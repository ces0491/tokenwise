import { fromDecimal } from './money.js';

/**
 * Parse CSV text into an array of rows (arrays of strings).
 * Handles quoted fields, doubled quotes inside quoted fields, commas and newlines inside quotes,
 * and both LF and CRLF line endings. A trailing newline does not produce an empty row.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text);
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/** Quote a field when it contains a comma or a quote. */
export function csvField(value) {
  const text = String(value ?? '');
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialise rows to CSV text with LF line endings and a trailing newline. */
export function toCsv(rows) {
  return rows.map((row) => row.map(csvField).join(',')).join('\n') + '\n';
}

/**
 * Build invoice lines from CSV with a header row: sku,description,qty,unit
 * where unit is a decimal amount such as 12.50.
 */
export function linesFromCsv(text) {
  const [header, ...body] = parseCsv(text);
  if (!header) throw new SyntaxError('csv: missing header row');
  const col = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new SyntaxError(`csv: missing column ${name}`);
    return i;
  };
  const iSku = col('sku');
  const iDesc = col('description');
  const iQty = col('qty');
  const iUnit = col('unit');
  return body.map((row, n) => {
    const qty = Number(row[iQty]);
    if (!Number.isInteger(qty) || qty <= 0) throw new RangeError(`csv row ${n + 1}: qty must be a positive integer`);
    return { sku: row[iSku], description: row[iDesc], qty, unitCents: fromDecimal(row[iUnit]) };
  });
}
