No existing test files were touched, and no lint script exists in this project (only `test`). Everything is implemented and verified.

## Summary

Implemented the credit notes feature per `docs/spec.md`:

- **`src/creditnote.js`** (new) — `createCreditNote({ id, invoice, issuedOn, lines, reason })`, validating in the spec's order (id → reason → invoice via `validateInvoice` → issuedOn → lines), returning a frozen credit note. Line `netCents` uses `multiply()` from `money.js` (proportional scale of the original `lineNet`, rounded once — discounts not recomputed).
- **`src/invoice.js`** — `invoiceTotals` now branches on `doc.kind === 'credit'`, returning negative `net`/`vat`/`gross` with VAT computed once on the summed credited amount. Invoice behavior unchanged.
- **`src/report.js`** — `topSkus` now subtracts credited qty/netCents for credit-note lines. `monthlySummary` needed no code change — it already delegates to `invoiceTotals` and groups by `issuedOn`, so it picked up credit-note support for free.
- **`src/index.js`** — exports `createCreditNote`.
- **`README.md`** — added the new module and credit-note rule to the modules table and rules list.
- **`test/creditnote.test.js`** (new, 19 tests) — covers all validation rules and their precedence order, default (whole-invoice) vs. partial credit, discount-not-recomputed rounding, immutability of the original invoice, frozen output, `invoiceTotals` sign/VAT behavior, and both report functions.

No existing files under `test/` were modified. `npm test` passes: 47/47.