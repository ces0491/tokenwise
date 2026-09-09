All 38 tests pass, including 9 new ones for credit notes, and existing tests are untouched.

Implemented per spec:
- `src/creditnote.js` — `createCreditNote` with validation precedence (id → reason → invoice → issuedOn → lines), no mutation of the original invoice, frozen result.
- `src/index.js` — exports `createCreditNote`.
- `src/invoice.js` — `invoiceTotals` now branches on `doc.kind === 'credit'` to return negative net/vat/gross computed from the credit note's `netCents` lines and its own region's VAT.
- `src/report.js` — `topSkus` subtracts credited qty/netCents for credit note docs; `monthlySummary` needed no change since it already delegates to `invoiceTotals`/`monthKey` generically.
- `test/creditnote.test.js` — new tests covering validation order, non-mutation, whole-invoice vs partial-line crediting with rounding, totals, and report integration.