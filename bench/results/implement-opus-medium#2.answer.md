Done — `npm test` passes, 42 tests, no existing tests changed.

**`src/creditnote.js`** — `createCreditNote` validates in the spec's precedence order (id → reason → invoice via `validateInvoice` → issuedOn → lines), then returns a frozen note. Line `netCents` is `roundHalfUp(lineNet(original) * qty / original.qty)`, so discounts are taken from the original line rather than recomputed at the credited quantity. Lines are copied out of the original invoice, which isn't touched.

**`src/invoice.js`** — `invoiceTotals` branches on `doc.kind === 'credit'`: sums `netCents`, calls `vatOn` once on that positive sum for the note's region, then negates both. The invoice path is unchanged.

**`src/report.js`** — `monthlySummary` needed no branching (it goes through `invoiceTotals` and `issuedOn`); `topSkus` subtracts `qty` and `netCents` for credit documents.

**`src/index.js`** exports `createCreditNote`. README updated: new rules bullet and module-table row, plus the `invoice.js`/`report.js` descriptions which now cover credit notes.

Test coverage in `test/creditnote.test.js` includes the whole-invoice default, partial credits, the rounding case (a qty-3 line netting 1000c credits 333c at qty 1 and 667c at qty 2, where recomputing the fixed discount would have given 0), non-mutation, each validation error with its type and the precedence between them, negative totals, single-`vatOn` rounding (1405c → 211c VAT), monthly grouping by the note's own month, and `topSkus` subtraction including going negative.