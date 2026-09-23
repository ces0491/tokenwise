All 41 tests pass, including 12 new credit note tests, and no existing tests were modified.

Implemented per spec:
- `src/creditnote.js` — `createCreditNote`, exported from `src/index.js`
- `src/invoice.js` — `invoiceTotals` now handles `doc.kind === 'credit'` (negative net/vat/gross)
- `src/report.js` — `topSkus` subtracts credited qty/netCents for credit notes; `monthlySummary` needed no change since it already delegates to `invoiceTotals`/`monthKey` generically