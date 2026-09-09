import { invoiceTotals, lineNet } from './invoice.js';

/** The YYYY-MM month key of an invoice. */
export function monthKey(invoice) {
  return invoice.issuedOn.slice(0, 7);
}

/**
 * Totals per month across invoices: { 'YYYY-MM': { count, net, vat, gross } }.
 * Months are returned in ascending order.
 */
export function monthlySummary(invoices) {
  const byMonth = new Map();
  for (const invoice of invoices) {
    const key = monthKey(invoice);
    const totals = invoiceTotals(invoice);
    const acc = byMonth.get(key) ?? { count: 0, net: 0, vat: 0, gross: 0 };
    acc.count += 1;
    acc.net += totals.net;
    acc.vat += totals.vat;
    acc.gross += totals.gross;
    byMonth.set(key, acc);
  }
  return Object.fromEntries([...byMonth.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** The n SKUs with the highest net revenue: [{ sku, qty, net }], highest first, ties by sku. */
export function topSkus(invoices, n = 5) {
  const bySku = new Map();
  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      const acc = bySku.get(line.sku) ?? { sku: line.sku, qty: 0, net: 0 };
      acc.qty += line.qty;
      acc.net += lineNet(line);
      bySku.set(line.sku, acc);
    }
  }
  return [...bySku.values()]
    .sort((a, b) => b.net - a.net || (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0))
    .slice(0, n);
}
