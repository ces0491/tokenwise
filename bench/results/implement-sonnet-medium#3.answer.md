All 45 tests pass, including the 16 new credit note tests, without touching any existing test files.

Summary of changes:
- **`src/creditnote.js`** (new): `createCreditNote` — validates `id` (`CN-` prefix), `reason`, the original invoice (via `validateInvoice`, without mutating it), `issuedOn`, and optional `lines` (non-empty, valid skus, no duplicates, qty in range), then returns a frozen credit note with `netCents` per line computed via `roundHalfUp`.
- **`src/invoice.js`**: `invoiceTotals` now branches on `doc.kind === 'credit'` to return negative `net`/`vat`/`gross` computed from the credit note's `netCents`.
- **`src/report.js`**: `topSkus` subtracts credited `qty`/`netCents` for credit-note lines instead of adding `lineNet`. `monthlySummary` needed no change — it already delegates to `invoiceTotals` and groups by `issuedOn`.
- **`src/index.js`**: exports `createCreditNote`.
- **`test/creditnote.test.js`** (new): covers validation order/errors, whole- and partial-invoice credits, rounding, non-mutation of the original invoice, and the credit note's effect on `invoiceTotals`, `monthlySummary`, and `topSkus`.