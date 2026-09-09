import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/index.js';

const { createCreditNote, invoiceTotals, monthlySummary, topSkus, createInvoice } = api;

const original = () => createInvoice({
  id: 'INV-9',
  region: 'ZA',
  issuedOn: '2026-03-10',
  lines: [
    { sku: 'A', description: 'Widget', qty: 2, unitCents: 500 },
    { sku: 'B', description: 'Gadget', qty: 3, unitCents: 333, discounts: [{ type: 'percent', value: 10 }] },
  ],
});

test('createCreditNote is exported from src/index.js', () => {
  assert.equal(typeof createCreditNote, 'function');
});

test('full credit note negates the invoice totals', () => {
  const note = createCreditNote({ id: 'CN-1', invoice: original(), issuedOn: '2026-04-02', reason: 'returned' });
  assert.deepEqual(invoiceTotals(original()), { net: 1899, vat: 285, gross: 2184 });
  assert.deepEqual(invoiceTotals(note), { net: -1899, vat: -285, gross: -2184 });
  assert.deepEqual(note.lines.map((l) => [l.sku, l.qty, l.netCents]), [['A', 2, 1000], ['B', 3, 899]]);
});

test('partial credit is proportional to the original line net', () => {
  const note = createCreditNote({
    id: 'CN-2', invoice: original(), issuedOn: '2026-04-02', reason: 'short delivery',
    lines: [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 1 }],
  });
  assert.deepEqual(note.lines.map((l) => [l.sku, l.qty, l.netCents]), [['A', 1, 500], ['B', 1, 300]]);
  assert.deepEqual(invoiceTotals(note), { net: -800, vat: -120, gross: -920 });
});

test('volume discounts are not recomputed at the credited quantity', () => {
  const invoice = createInvoice({
    id: 'INV-10', region: 'GB', issuedOn: '2026-05-01',
    lines: [{ sku: 'C', description: 'Bulk', qty: 12, unitCents: 100, discounts: [{ type: 'volume', tiers: [{ minQty: 10, percent: 5 }] }] }],
  });
  const note = createCreditNote({ id: 'CN-3', invoice, issuedOn: '2026-05-09', reason: 'damaged', lines: [{ sku: 'C', qty: 4 }] });
  assert.equal(note.lines[0].netCents, 380);
  assert.deepEqual(invoiceTotals(note), { net: -380, vat: -76, gross: -456 });
});

test('shape, freezing and no mutation of the original', () => {
  const invoice = original();
  const before = JSON.stringify(invoice);
  const note = createCreditNote({ id: 'CN-4', invoice, issuedOn: '2026-04-02', reason: 'goodwill' });
  assert.ok(Object.isFrozen(note));
  assert.equal(note.kind, 'credit');
  assert.equal(note.invoiceId, 'INV-9');
  assert.equal(note.region, 'ZA');
  assert.equal(note.issuedOn, '2026-04-02');
  assert.equal(note.reason, 'goodwill');
  assert.equal(note.lines[1].description, 'Gadget');
  assert.equal(JSON.stringify(invoice), before);
});

test('validation errors', () => {
  const invoice = original();
  const ok = { id: 'CN-5', invoice, issuedOn: '2026-04-02', reason: 'r' };
  assert.throws(() => createCreditNote({ ...ok, id: 'INV-5' }), TypeError);
  assert.throws(() => createCreditNote({ ...ok, id: undefined }), TypeError);
  assert.throws(() => createCreditNote({ ...ok, reason: '' }), TypeError);
  assert.throws(() => createCreditNote({ ...ok, reason: undefined }), TypeError);
  assert.throws(() => createCreditNote({ ...ok, issuedOn: '2026-4-2' }), RangeError);
  assert.throws(() => createCreditNote({ ...ok, invoice: { ...invoice, lines: [] } }), RangeError);
  assert.throws(() => createCreditNote({ ...ok, lines: [] }), RangeError);
  assert.throws(() => createCreditNote({ ...ok, lines: [{ sku: 'Z', qty: 1 }] }), RangeError);
  assert.throws(() => createCreditNote({ ...ok, lines: [{ sku: 'A', qty: 3 }] }), RangeError);
  assert.throws(() => createCreditNote({ ...ok, lines: [{ sku: 'A', qty: 0 }] }), RangeError);
  assert.throws(() => createCreditNote({ ...ok, lines: [{ sku: 'A', qty: 1.5 }] }), RangeError);
  assert.throws(() => createCreditNote({ ...ok, lines: [{ sku: 'A', qty: 1 }, { sku: 'A', qty: 1 }] }), RangeError);
});

test('monthlySummary includes credit notes in their own month', () => {
  const invoice = original();
  const note = createCreditNote({ id: 'CN-6', invoice, issuedOn: '2026-04-02', reason: 'r', lines: [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 1 }] });
  const summary = monthlySummary([invoice, note]);
  assert.deepEqual(Object.keys(summary), ['2026-03', '2026-04']);
  assert.deepEqual(summary['2026-03'], { count: 1, net: 1899, vat: 285, gross: 2184 });
  assert.deepEqual(summary['2026-04'], { count: 1, net: -800, vat: -120, gross: -920 });
});

test('topSkus subtracts credited quantity and net', () => {
  const invoice = original();
  const note = createCreditNote({ id: 'CN-7', invoice, issuedOn: '2026-04-02', reason: 'r', lines: [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 1 }] });
  assert.deepEqual(topSkus([invoice, note]), [
    { sku: 'B', qty: 2, net: 599 },
    { sku: 'A', qty: 1, net: 500 },
  ]);
});
