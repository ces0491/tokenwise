All 38 tests pass, including 9 new ones for credit notes; existing tests untouched.

Implemented per `docs/spec.md`:

- **`src/creditnote.js`** — `createCreditNote({ id, invoice, issuedOn, lines, reason })`: validates in the specified precedence (`id` prefix, `reason`, original invoice via `validateInvoice`, `issuedOn` format, then `lines`), computes `netCents` per line as `roundHalfUp(lineNet(original) * qty/originalQty)`, and returns a frozen object without mutating the source invoice.
- **`src/invoice.js`** — `invoiceTotals` now branches on `doc.kind === 'credit'`: sums line `netCents`, negates it for `net`, computes `vat` as `-vatOn(sum, region)`, `gross = net + vat`. Invoice behavior unchanged.
- **`src/report.js`** — `topSkus` now subtracts `qty`/`netCents` for credit note lines instead of adding `lineNet`. `monthlySummary` needed no change: it already delegates to `invoiceTotals` per document's own `issuedOn`, so credit notes fall into their own month with negative totals automatically.
- **`src/index.js`** — exports `createCreditNote`.
- **`test/creditnote.test.js`** — covers full/partial credit, no-mutation of the original invoice, all validation error cases (id/reason/issuedOn/invoice/lines), negative `invoiceTotals`, and the `monthlySummary`/`topSkus` interactions.