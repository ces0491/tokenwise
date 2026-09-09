All 44 tests pass. Implemented per spec:

- `src/creditnote.js` — `createCreditNote` with validation order (id → reason → invoice → issuedOn → lines), full or partial credit, `roundHalfUp` applied once per line, frozen result, original invoice untouched.
- `src/invoice.js` — `invoiceTotals` now branches on `doc.kind === 'credit'`, returning negative net/vat/gross computed from the credit note's own lines.
- `src/report.js` — `topSkus` subtracts credited qty/netCents for credit-note lines; `monthlySummary` already worked unchanged since it just calls `invoiceTotals` and keys by `issuedOn`.
- `src/index.js` — exports `createCreditNote`.
- `test/creditnote.test.js` — new tests covering validation errors, full/partial credit rounding, non-mutation of the original, and the totals/report behavior. No existing test files were modified.