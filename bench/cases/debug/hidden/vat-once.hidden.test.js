import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceTotals, lineNet, vatOn } from '../src/index.js';

const inv = (region, lines) => ({ id: 'X', region, issuedOn: '2026-01-01', lines });

test('VAT once on the net: ZA, three 10-cent lines', () => {
  assert.deepEqual(invoiceTotals(inv('ZA', [
    { sku: 'A', qty: 1, unitCents: 10 }, { sku: 'B', qty: 1, unitCents: 10 }, { sku: 'C', qty: 1, unitCents: 10 },
  ])), { net: 30, vat: 5, gross: 35 });
});

test('VAT once on the net: DE, three 1-cent lines', () => {
  assert.deepEqual(invoiceTotals(inv('DE', [
    { sku: 'A', qty: 1, unitCents: 1 }, { sku: 'B', qty: 1, unitCents: 1 }, { sku: 'C', qty: 1, unitCents: 1 },
  ])), { net: 3, vat: 1, gross: 4 });
});

test('VAT once on the net: GB, twenty 7-cent lines', () => {
  const lines = Array.from({ length: 20 }, (_, i) => ({ sku: `S${i}`, qty: 1, unitCents: 7 }));
  assert.deepEqual(invoiceTotals(inv('GB', lines)), { net: 140, vat: 28, gross: 168 });
});

test('single-line totals unchanged', () => {
  assert.deepEqual(invoiceTotals(inv('ZA', [{ sku: 'A', qty: 2, unitCents: 500 }])), { net: 1000, vat: 150, gross: 1150 });
});

test('helpers unchanged', () => {
  assert.equal(vatOn(30, 'ZA'), 5);
  assert.equal(lineNet({ sku: 'A', qty: 3, unitCents: 250 }), 750);
});
