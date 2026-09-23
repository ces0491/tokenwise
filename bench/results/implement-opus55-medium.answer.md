I've built credit notes as `docs/spec.md` describes. `npm test` passes all 43 tests: the existing ones, unchanged, plus 14 new ones in `test/creditnote.test.js`. Nothing is committed yet.

**What changed**
- **`src/creditnote.js`**: new file with `createCreditNote`, also exported from `src/index.js`.
  - It checks inputs in the spec's order (id, reason, invoice, `issuedOn`, lines) and throws the error types the spec names.
  - Each credited line's `netCents` is the original line's discounted net scaled by the credited share of its quantity, rounded once with `roundHalfUp`.
  - The credit note, its `lines` array and each line are frozen, and the original invoice is left untouched.
- **`src/invoice.js`**: `invoiceTotals` now returns negative totals for a credit note, with VAT worked out once on the summed net for the note's region. I also added a small exported helper, `isIssueDate`, so credit notes check dates with the same pattern invoices use. It isn't exported from `src/index.js`.
- **`src/report.js`**: `monthlySummary` counts credit notes in their own `issuedOn` month. `topSkus` subtracts credited quantity and net.
- **`README.md`**: added a rule for credit notes, a row for the new module, and updated the descriptions of the invoice and report modules.

**Rounding cases the tests cover**
- A line with a net of 1002 over 4 units, credited for 1, gives 250.5, which rounds to 251.
- A volume-discounted line keeps its discount when only part of it is credited: 2 of 12 units credits 190, not the undiscounted 200.
- VAT on a credit note is rounded once on the total: three 3-cent lines in GB give −2 VAT, where rounding per line would give −3.

**Decision for you:** the spec doesn't say what to do when a partial credit names a SKU that appears on more than one line of the invoice. My code credits the first matching line. If you'd rather reject that case, it's a one-line change.