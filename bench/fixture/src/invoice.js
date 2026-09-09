import { cents, sum } from './money.js';
import { vatOn, vatRate } from './tax.js';
import { applyDiscounts } from './discounts.js';

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * An invoice line: { sku, description, qty, unitCents, discounts? }
 * An invoice: { id, region, issuedOn: 'YYYY-MM-DD', lines, notes? }
 */

/** Validate an invoice line. Throws on a bad shape. */
export function validateLine(line, index = 0) {
  const where = `line ${index}`;
  if (!line || typeof line !== 'object') throw new TypeError(`${where}: not an object`);
  if (typeof line.sku !== 'string' || !line.sku) throw new TypeError(`${where}: sku is required`);
  if (!Number.isInteger(line.qty) || line.qty <= 0) throw new RangeError(`${where}: qty must be a positive integer`);
  if (!Number.isInteger(line.unitCents) || line.unitCents < 0) throw new RangeError(`${where}: unitCents must be a non-negative integer`);
  if (line.discounts !== undefined && !Array.isArray(line.discounts)) throw new TypeError(`${where}: discounts must be an array`);
  return line;
}

/** Validate a whole invoice. Throws on a bad shape. Returns the invoice. */
export function validateInvoice(invoice) {
  if (!invoice || typeof invoice !== 'object') throw new TypeError('invoice: not an object');
  if (typeof invoice.id !== 'string' || !invoice.id) throw new TypeError('invoice: id is required');
  vatRate(invoice.region);
  if (typeof invoice.issuedOn !== 'string' || !DATE.test(invoice.issuedOn)) {
    throw new RangeError(`invoice ${invoice.id}: issuedOn must be YYYY-MM-DD`);
  }
  if (!Array.isArray(invoice.lines) || invoice.lines.length === 0) {
    throw new RangeError(`invoice ${invoice.id}: at least one line is required`);
  }
  invoice.lines.forEach(validateLine);
  return invoice;
}

/** Net amount of one line after its discounts. */
export function lineNet(line) {
  const gross = cents(line.qty * line.unitCents);
  return applyDiscounts(gross, line.discounts ?? [], line.qty);
}

/** Net, VAT and gross totals for an invoice. VAT is calculated once on the invoice net. */
export function invoiceTotals(invoice) {
  const net = sum(invoice.lines.map(lineNet));
  const vat = vatOn(net, invoice.region);
  return { net, vat, gross: net + vat };
}

/** Build a validated, frozen invoice. */
export function createInvoice({ id, region, issuedOn, lines, notes }) {
  const invoice = { id, region, issuedOn, lines: lines.map((l) => ({ ...l })), ...(notes ? { notes } : {}) };
  validateInvoice(invoice);
  return Object.freeze(invoice);
}
