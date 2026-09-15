## Implement
I added `src/creditnote.js`, which exports `createCreditNote`. It checks its inputs against the original invoice and returns a frozen credit note for the whole invoice or chosen lines, with each line's net scaled by `qty / originalQty` and rounded once via `multiply`; it's also exported from `src/index.js`, and the new tests are in `test/creditnote.test.js`. `invoiceTotals` now returns negative net, VAT and gross for `kind: 'credit'`, `topSkus` subtracts credited qty and net, `monthlySummary` already counted credit notes without changes, and I added the new module to the README file table (`npm test` passes 41/41, nothing committed).

## Review
**`src/csv.js:37`** — `csvField` has stopped quoting fields that contain a line break, so text with a newline breaks into extra rows when the CSV is parsed back. Input: `parseCsv(toCsv([['a','x\ny']]))` → expected `[["a","x\ny"]]`, got `[["a","x"],["y"]]`.

**`src/discounts.js:25`** — `<` should be `<=`, so a quantity exactly equal to a tier's `minQty` no longer gets that tier. Input: `volumeTier([{minQty:10},{minQty:5}], 10)` → expected `{minQty:10}`, got `{minQty:5}`.

**`src/discounts.js:22`** — `volumeTier` now sorts the caller's `tiers` array in place, which changes the caller's data. Input: `tiers=[{minQty:10},{minQty:5}]; volumeTier(tiers, 10)` → expected `tiers` unchanged, got `[{minQty:5},{minQty:10}]`.

**`src/report.js:6`** — the month key now comes from a local-time `Date`, which breaks the README rule to group by the first seven characters of `issuedOn`. Dates shift in time zones west of UTC. Input: `monthKey({issuedOn:'2026-03-01'})` with TZ=America/New_York → expected `2026-03`, got `2026-02`.

**`src/tax.js:31`** — `Math.round` rounds negative halves toward zero, which breaks the README rule that rounding is half away from zero and owned by money.js. Input: `netFromGross(-3, 'GB')` → expected `-3`, got `-2`.

**`test/csv.test.js:19`** — the test is weaker: the assertion `csvField('x\ny') === '"x\ny"'` was deleted, so the newline-quoting bug above goes undetected. Input: `csvField('x\ny')` → expected `"\"x\ny\""`, got `"x\ny"`.

**`test/csv.test.js:26`** — the test is weaker: the multi-line row `['C-3','two\nlines']` was dropped from the round-trip test, so it no longer covers line breaks. Input: `parseCsv(toCsv([['C-3','two\nlines']]))` → expected `[["C-3","two\nlines"]]`, got `[["C-3","two"],["lines"]]`.

## Rounding
Rounding is decided in `roundHalfUp` at `src/money.js:10` (half away from zero), and `README.md:11` makes `money.js` its owner. `multiply` (`src/money.js:16`) is the single rounding step for products. `allocate` (`src/money.js:50`) splits totals by largest remainder so the parts still add up exactly. `fromDecimal` (`src/money.js:30`) rejects more than two decimal places instead of rounding.

Dependents:
- `src/tax.js:21` `vatOn` via `multiply`; `src/tax.js:31` `netFromGross` via `roundHalfUp`
- `src/discounts.js:16` percentage discounts via `multiply`
- `src/invoice.js:41,47` `lineNet` and `invoiceTotals`, through discounts and `vatOn`
- `src/creditnote.js:48` credited line net via `multiply`
- `src/report.js:1` indirectly, through `invoiceTotals` and `lineNet`
- `src/index.js:1` re-exports

---
- Implement: Sonnet worker at medium effort, no escalation. Tests pass 41/41 and no existing test file changed.
- Review: Opus worker at low effort, no escalation. All 7 findings have a file:line and an input that shows the bug.
- Rounding: answered in this session, no escalation. Every reference was checked against the source.

`main` is checked out.