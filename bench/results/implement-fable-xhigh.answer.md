The credit notes feature is implemented and the full suite passes. Nothing is committed, per your rules.

**Test result**

| Metric | Value |
|---|---|
| Tests | 45 |
| Pass | 45 |
| Fail | 0 |

**What changed**

- `src/creditnote.js` (new) exports `createCreditNote`. Validation runs in the spec's precedence order: id prefix and reason throw TypeError, then the invoice goes through `validateInvoice`, then issuedOn and the optional lines throw RangeError. Each credited line takes the original line net times credited over original quantity, rounded once with `roundHalfUp`, so discounts are never recomputed. The note, its lines array and each line are frozen.
- `src/invoice.js` now branches in `invoiceTotals` on a document with kind `credit`. It sums the credited net, applies `vatOn` once for the note's region, and returns the negated figures. The date regex is exported as `DATE` so the credit note validates issuedOn with the same rule as an invoice.
- `src/report.js` handles credit notes in `topSkus` by subtracting the credited quantity and net. The monthly summary needed no code change since it already goes through `invoiceTotals` and the note's own `issuedOn`. Doc comments updated.
- `src/index.js` re-exports `createCreditNote`.
- `test/creditnote.test.js` (new, 16 tests) covers every validation rule and the precedence order, whole and partial credits, discount non-recomputation, half-up rounding, freezing and non-mutation, negative totals with VAT rounded once on the sum, and both reports. Existing test files are untouched.
- `README.md` gained a rule describing credit notes and the module table lists the new file.

**Two judgement calls worth knowing about**

- Negation uses subtraction from zero so a credit note whose lines net to zero returns plain zero rather than negative zero. Strict deep equality treats those as different values, and there is a test pinning this.
- If an invoice lists the same SKU on two lines, an explicit credit line matches the first one. The spec does not cover that case.

Line-ending warnings from git are the usual autocrlf conversion on commit and need no action.