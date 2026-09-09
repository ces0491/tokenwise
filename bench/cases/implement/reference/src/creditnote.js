import { cents, roundHalfUp, sum } from './money.js';
import { vatOn } from './tax.js';
import { validateInvoice, lineNet } from './invoice.js';

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Build a frozen credit note against an issued invoice. See docs/spec.md. */
export function createCreditNote({ id, invoice, issuedOn, lines, reason }) {
  if (typeof id !== 'string' || !id.startsWith('CN-')) throw new TypeError('credit note: id must start with "CN-"');
  if (typeof reason !== 'string' || !reason.trim()) throw new TypeError('credit note: reason is required');
  validateInvoice(invoice);
  if (typeof issuedOn !== 'string' || !DATE.test(issuedOn)) throw new RangeError(`credit note ${id}: issuedOn must be YYYY-MM-DD`);
  const requested = lines ?? invoice.lines.map((l) => ({ sku: l.sku, qty: l.qty }));
  if (!Array.isArray(requested) || requested.length === 0) throw new RangeError(`credit note ${id}: at least one line is required`);
  const seen = new Set();
  const credited = requested.map((req) => {
    const original = invoice.lines.find((l) => l.sku === req.sku);
    if (!original) throw new RangeError(`credit note ${id}: sku ${req.sku} is not on invoice ${invoice.id}`);
    if (seen.has(req.sku)) throw new RangeError(`credit note ${id}: sku ${req.sku} listed twice`);
    seen.add(req.sku);
    if (!Number.isInteger(req.qty) || req.qty < 1 || req.qty > original.qty) {
      throw new RangeError(`credit note ${id}: qty for ${req.sku} must be between 1 and ${original.qty}`);
    }
    const netCents = roundHalfUp((lineNet(original) * req.qty) / original.qty);
    return Object.freeze({ sku: original.sku, description: original.description, qty: req.qty, netCents });
  });
  return Object.freeze({
    id, kind: 'credit', invoiceId: invoice.id, region: invoice.region, issuedOn, reason, lines: Object.freeze(credited),
  });
}

/** Negative net, VAT and gross for a credit note. VAT is calculated once on the credited net. */
export function creditTotals(note) {
  const credited = sum(note.lines.map((l) => cents(l.netCents)));
  const vat = vatOn(credited, note.region);
  return { net: -credited, vat: -vat, gross: -(credited + vat) };
}
