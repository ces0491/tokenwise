All 41 tests pass. Implemented per spec:

- `src/creditnote.js`: `createCreditNote` with validation order (id → reason → invoice → issuedOn → lines), whole-invoice or partial-line crediting, proration via `roundHalfUp`, frozen result.
- `src/invoice.js`: `invoiceTotals` now branches on `doc.kind === 'credit'` to return negative net/vat/gross; invoice behavior unchanged.
- `src/report.js`: `topSkus` subtracts credited qty/netCents for credit notes; `monthlySummary` needed no change since it already delegates to `invoiceTotals`.
- `src/index.js`: exports `createCreditNote`.
- `test/creditnote.test.js`: new tests covering validation precedence, whole/partial credits, rounding, totals, and report integration. Existing test files untouched.