No existing test files were touched. `npm test`: 40 tests, all passing.

What changed:

- **`src/creditnote.js`** (new) — `createCreditNote({ id, invoice, issuedOn, lines, reason })`. Validates in spec order: `id` prefix and `reason` (`TypeError`), then `validateInvoice`, then the date, then the credited lines (`RangeError` for empty, unknown sku, duplicate sku, or out-of-range/non-integer qty). Omitting `lines` credits every line at full quantity. Per-line `netCents` is `roundHalfUp(lineNet(original) * qty / original.qty)` — one rounding, discounts taken from the original line rather than recomputed. Result is frozen; the original invoice is read-only throughout (lines are rebuilt, not referenced).
- **`src/invoice.js`** — `invoiceTotals` branches on `doc.kind === 'credit'`: net is minus the sum of `netCents`, VAT is one `vatOn` call over that sum, gross is `net + vat`. Invoice behaviour is unchanged.
- **`src/report.js`** — `monthlySummary` works as-is now that totals handle credit notes (counted by their own `issuedOn`); `topSkus` subtracts `qty` and `netCents` for credit-note lines.
- **`src/index.js`** — exports `createCreditNote`.
- **`README.md`** — added the rule line and the `src/creditnote.js` row, and updated the `invoice.js`/`report.js` descriptions.

One implementation detail worth knowing: negations are written `0 - x` rather than `-x`, because `-0` in a zero-VAT region (`US`) fails `deepStrictEqual` against `0`.