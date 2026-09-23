Credit notes are in and `npm test` passes: 45 tests, 0 failures. I didn't change any existing tests.

**Changes**
- **`src/creditnote.js`** (new): `createCreditNote` checks its inputs in the order the spec gives and returns a frozen credit note. Each credited line's `netCents` is the original `lineNet × qty / originalQty`, rounded once with `roundHalfUp`. Discounts aren't recalculated at the credited quantity. The invoice passed in isn't changed.
- **`src/invoice.js`**: `invoiceTotals` now handles `kind === 'credit'` and returns negative totals, with VAT calculated once on the credited sum. It uses `0 - x` rather than `-x` so that a zero-value credit returns `0` instead of `-0`, which strict `deepEqual` treats as different. Invoice totals work as before.
- **`src/report.js`**: `topSkus` subtracts credited `qty` and `netCents`. `monthlySummary` needed no code change because it already goes through `invoiceTotals`; I only updated its doc comment.
- **`src/index.js`**: exports `createCreditNote`.
- **`test/creditnote.test.js`** (new): 16 tests. They cover the result's shape, freezing, the invoice being left unchanged, prorating and half-up rounding, a volume-tier line keeping its discount, each error type, the order checks run in, VAT calculated once on the credited sum, and both reports.
- **`README.md`**: added a rule for credit notes and updated the modules table.

**Decisions the spec doesn't cover**
- **Date check export:** to check `issuedOn` "like an invoice date" without copying the regex, I exported a small `isDate` helper from `src/invoice.js`. It isn't re-exported from `src/index.js`, so the public API only gains `createCreditNote`.
- **Same SKU twice on an invoice:** if the original invoice has two lines with the same SKU, a requested credit line matches the first one. The spec says SKUs are unique on the credit note but says nothing about duplicates on the invoice. Tell me if you want a different rule, such as rejecting that case.
- **Order of credited lines:** credited lines keep the order they were requested in. A full credit follows the invoice's line order.
- **Credit note on its own:** a credit note with no matching invoice in the report input leaves that SKU with negative totals in `topSkus`. That follows from the spec, and I've added a test for it.

Nothing is committed yet. Say when you want me to commit.