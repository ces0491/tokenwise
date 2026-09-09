import { invoiceTotals, lineNet } from './invoice.js';

/** The YYYY-MM month key of an invoice or credit note. */
export function monthKey(doc) {
  return doc.issuedOn.slice(0, 7);
}

/**
 * Totals per month across invoices and credit notes: { 'YYYY-MM': { count, net, vat, gross } }.
 * Months are returned in ascending order.
 */
export function monthlySummary(docs) {
  const byMonth = new Map();
  for (const doc of docs) {
    const key = monthKey(doc);
    const totals = invoiceTotals(doc);
    const acc = byMonth.get(key) ?? { count: 0, net: 0, vat: 0, gross: 0 };
    acc.count += 1;
    acc.net += totals.net;
    acc.vat += totals.vat;
    acc.gross += totals.gross;
    byMonth.set(key, acc);
  }
  return Object.fromEntries([...byMonth.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** The n SKUs with the highest net revenue after credits: [{ sku, qty, net }], highest first, ties by sku. */
export function topSkus(docs, n = 5) {
  const bySku = new Map();
  for (const doc of docs) {
    const sign = doc.kind === 'credit' ? -1 : 1;
    for (const line of doc.lines) {
      const acc = bySku.get(line.sku) ?? { sku: line.sku, qty: 0, net: 0 };
      acc.qty += sign * line.qty;
      acc.net += sign * (doc.kind === 'credit' ? line.netCents : lineNet(line));
      bySku.set(line.sku, acc);
    }
  }
  return [...bySku.values()]
    .sort((a, b) => b.net - a.net || (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0))
    .slice(0, n);
}
