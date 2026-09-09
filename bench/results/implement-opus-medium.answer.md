Done. All 52 tests pass (`npm test`), including the 26 pre-existing ones, which I didn't touch.

**`src/creditnote.js`** — `createCreditNote({ id, invoice, issuedOn, lines, reason })` returns a frozen note. Validation runs in spec order: `id` prefix (`TypeError`), `reason` (`TypeError`), `validateInvoice`, `issuedOn` against the same date regex as invoices (`RangeError`), then lines (`RangeError` for empty, unknown sku, duplicate sku, out-of-range qty). Omitting `lines` credits every line at full quantity. `netCents = roundHalfUp(lineNet(original) * qty / original.qty)` — one rounding, no discount recomputation. The original invoice is only read from, never mutated.

**`src/invoice.js`** — `invoiceTotals` branches on `doc.kind === 'credit'`: sums the positive `netCents`, negates, and applies `vatOn` once to the summed credited net before negating. The invoice path is unchanged. I implemented the branch inline rather than importing `creditnote.js` to avoid a circular import (`creditnote.js` needs `lineNet` and `validateInvoice`).

**`src/report.js`** — `monthlySummary` groups by whatever the doc's own `issuedOn` says, so credit notes land in their own month and add negative totals via `invoiceTotals`. `topSkus` subtracts `line.qty` and `line.netCents` for credit-note lines.

**`src/index.js`** — re-exports `createCreditNote`.

**README** — added the credit-note rule to the rules list, added the `src/creditnote.js` row, and updated the `invoice.js` and `report.js` row descriptions. Install steps and the `npm test` command were already accurate.

One judgement call worth flagging: the spec doesn't say whether a fully-credited SKU should drop out of `topSkus` or stay at zero. I kept it in the map, so it appears with `qty: 0, net: 0` and sorts accordingly. Removing zero or negative entries would be a small change if you'd rather they not show.