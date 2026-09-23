All 38 tests pass, including the 9 new credit note tests, and existing tests are untouched.

Implemented per spec:
- `src/creditnote.js` — `createCreditNote` with validation order (id → reason → invoice → issuedOn → lines) and proration via `roundHalfUp`.
- `src/index.js` — exports `createCreditNote`.
- `src/invoice.js` — `invoiceTotals` now handles `doc.kind === 'credit'`, returning negative totals; invoice behavior unchanged.
- `src/report.js` — `topSkus` subtracts credited qty/netCents; `monthlySummary` works unchanged since it already delegates to `invoiceTotals`/`monthKey`.
- `test/creditnote.test.js` — new tests covering validation precedence, whole/partial credits, rounding, immutability of the original invoice, and report integration.