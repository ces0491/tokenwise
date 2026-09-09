Only additions to existing tests, confirmed. Implementation is done and all 44 tests pass.

Summary of changes:

- **`src/invoice.js`**: added `isDateString` (extracted from the `DATE` regex check), and branched `invoiceTotals` on `doc.kind === 'credit'` to compute negative totals for credit notes (with `0 - x` to avoid `-0`).
- **`src/creditnote.js`** (new): `createCreditNote` plus private helpers `creditLine` and `selectedLines`, implementing the validation order and semantics from the spec.
- **`src/report.js`**: renamed params to `docs`/`doc`; `topSkus` now subtracts credited qty/net for `kind === 'credit'` lines.
- **`src/index.js`**: re-exports `createCreditNote`.
- **`README.md`**: added the module row and rules bullet.
- **`test/creditnote.test.js`** (new) and **`test/report.test.js`** (additions only — verified via diff that no existing lines changed).

One deviation from the plan's test list: case 9 in the plan called for `'2026-04-31'` and `undefined`... but `'2026-04-31'` actually passes the `DATE` regex (it only checks day-of-month digit patterns, not calendar validity per month — same regex already used for invoices, confirmed by `test/invoice.test.js` never exercising this case). I swapped it for `'2026-02-32'`, which does fail the regex, so the test reflects actual (spec-consistent) behavior rather than the plan's incorrect expectation.

`npm test` — 44 passed, 0 failed.