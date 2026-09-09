import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLine, validateInvoice, lineNet, invoiceTotals, createInvoice } from '../src/invoice.js';

const base = () => ({
  id: 'INV-1',
  region: 'ZA',
  issuedOn: '2026-03-15',
  lines: [{ sku: 'A', description: 'Widget', qty: 2, unitCents: 500 }],
});

test('validateInvoice rejects bad shapes', () => {
  assert.throws(() => validateInvoice({ ...base(), id: '' }), TypeError);
  assert.throws(() => validateInvoice({ ...base(), region: 'XX' }), RangeError);
  assert.throws(() => validateInvoice({ ...base(), issuedOn: '2026-13-01' }), RangeError);
  assert.throws(() => validateInvoice({ ...base(), issuedOn: '15/03/2026' }), RangeError);
  assert.throws(() => validateInvoice({ ...base(), lines: [] }), RangeError);
  assert.throws(() => validateInvoice({ ...base(), lines: [{ sku: 'A', qty: 0, unitCents: 1 }] }), RangeError);
  assert.throws(() => validateInvoice({ ...base(), lines: [{ sku: 'A', qty: 1, unitCents: -1 }] }), RangeError);
  assert.throws(() => validateInvoice({ ...base(), lines: [{ sku: 'A', qty: 1, unitCents: 1, discounts: 'x' }] }), TypeError);
  assert.equal(validateInvoice(base()).id, 'INV-1');
});

test('validateLine names the line index', () => {
  assert.throws(() => validateLine({ sku: '', qty: 1, unitCents: 1 }, 3), /line 3/);
});

test('lineNet applies discounts to quantity times unit', () => {
  assert.equal(lineNet({ sku: 'A', qty: 3, unitCents: 250 }), 750);
  assert.equal(lineNet({ sku: 'A', qty: 3, unitCents: 250, discounts: [{ type: 'percent', value: 10 }] }), 675);
  assert.equal(lineNet({ sku: 'A', qty: 12, unitCents: 100, discounts: [{ type: 'volume', tiers: [{ minQty: 10, percent: 5 }] }] }), 1140);
});

test('invoiceTotals for a single line', () => {
  assert.deepEqual(invoiceTotals(base()), { net: 1000, vat: 150, gross: 1150 });
});

test('multi-line invoice totals (GB)', () => {
  const invoice = {
    ...base(),
    region: 'GB',
    lines: [
      { sku: 'A', qty: 1, unitCents: 3 },
      { sku: 'B', qty: 1, unitCents: 3 },
      { sku: 'C', qty: 1, unitCents: 3 },
    ],
  };
  assert.deepEqual(invoiceTotals(invoice), { net: 9, vat: 2, gross: 11 });
});

test('createInvoice validates, copies lines and freezes', () => {
  const lines = [{ sku: 'A', description: 'Widget', qty: 1, unitCents: 100 }];
  const invoice = createInvoice({ id: 'INV-2', region: 'GB', issuedOn: '2026-01-31', lines, notes: 'net 30' });
  assert.ok(Object.isFrozen(invoice));
  assert.notEqual(invoice.lines[0], lines[0]);
  assert.equal(invoice.notes, 'net 30');
  assert.equal('notes' in createInvoice({ id: 'INV-3', region: 'GB', issuedOn: '2026-01-31', lines }), false);
  assert.throws(() => createInvoice({ id: 'INV-4', region: 'GB', issuedOn: 'soon', lines }), RangeError);
});
