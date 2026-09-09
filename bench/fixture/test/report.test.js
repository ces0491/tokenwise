import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthKey, monthlySummary, topSkus } from '../src/report.js';

const invoices = [
  { id: 'A', region: 'ZA', issuedOn: '2026-03-05', lines: [{ sku: 'A', qty: 2, unitCents: 500 }] },
  { id: 'B', region: 'ZA', issuedOn: '2026-03-20', lines: [{ sku: 'B', qty: 1, unitCents: 300 }, { sku: 'A', qty: 1, unitCents: 500 }] },
  { id: 'C', region: 'GB', issuedOn: '2026-01-10', lines: [{ sku: 'C', qty: 4, unitCents: 100 }] },
];

test('monthKey is the YYYY-MM prefix', () => {
  assert.equal(monthKey({ issuedOn: '2026-03-15' }), '2026-03');
});

test('monthlySummary groups and orders by month', () => {
  const summary = monthlySummary(invoices);
  assert.deepEqual(Object.keys(summary), ['2026-01', '2026-03']);
  assert.deepEqual(summary['2026-01'], { count: 1, net: 400, vat: 80, gross: 480 });
  assert.deepEqual(summary['2026-03'], { count: 2, net: 1800, vat: 270, gross: 2070 });
  assert.deepEqual(monthlySummary([]), {});
});

test('topSkus ranks by net with sku tie-break', () => {
  assert.deepEqual(topSkus(invoices), [
    { sku: 'A', qty: 3, net: 1500 },
    { sku: 'C', qty: 4, net: 400 },
    { sku: 'B', qty: 1, net: 300 },
  ]);
  assert.deepEqual(topSkus(invoices, 2).map((r) => r.sku), ['A', 'C']);
  const tied = [{ id: 'T', region: 'US', issuedOn: '2026-02-01', lines: [{ sku: 'Z', qty: 1, unitCents: 100 }, { sku: 'Y', qty: 1, unitCents: 100 }] }];
  assert.deepEqual(topSkus(tied).map((r) => r.sku), ['Y', 'Z']);
});
