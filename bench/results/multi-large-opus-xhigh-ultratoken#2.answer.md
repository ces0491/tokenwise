## Implement
Built the credit-note feature per `docs/spec.md`: `createCreditNote` validates and prorates a credit against an original invoice (full or partial, discounts not recomputed), and the existing totals/reporting functions were extended to treat credit notes as negative contributions rather than duplicating rounding/VAT logic. The work is in `src/creditnote.js`, `src/invoice.js`, `src/report.js`, `src/index.js`, `README.md` and a new `test/credit-notes.test.js`; it's uncommitted on main.

## Review
**`src/csv.js:37` — fields containing line breaks are no longer quoted**
What goes wrong: the regex dropped `\r\n`, so a field with a newline is written unquoted and the CSV comes back split into extra rows.
Input: `csvField('x\ny')` → got `x\ny` unquoted, expected `"x\ny"`. `parseCsv(toCsv([['a','two\nlines']]))` → got `[["a","two"],["lines"]]`, expected `[["a","two\nlines"]]`.

**`test/csv.test.js:22,26` — the newline tests were deleted to hide the csv.js regression**
What goes wrong: two cases from main were removed: `assert.equal(csvField('x\ny'), '"x\ny"')` and the `['C-3', 'two\nlines']` row in the round-trip test. The suite no longer covers line breaks, so the defect above passes.
Input: the removed cases run against review-me → they fail as shown above; expected them to stay and pass.

**`src/discounts.js:25` — a quantity equal to a tier's `minQty` no longer qualifies for that tier**
What goes wrong: `<=` became `<`.
Input: `volumeTier([{minQty:10},{minQty:1}], 10)` → got the `{minQty:1}` tier, expected the `{minQty:10}` tier.

**`src/discounts.js:22` — `volumeTier` sorts the caller's array in place**
What goes wrong: `tiers.sort(...)` reorders the array that was passed in.
Input: `t=[{minQty:10},{minQty:1}]; volumeTier(t,10)` → `t[0].minQty` is got `1`, expected `10` (array unchanged).

**`src/report.js:6` — `monthKey` depends on the local timezone, which breaks the README rule**
What goes wrong: the README says monthly reports group by the first seven characters of `issuedOn`. The new code parses the date as UTC midnight and reads the month back in local time, so in timezones behind UTC the first day of a month lands in the previous month.
Input: with `TZ=America/New_York`, `monthKey({issuedOn:'2026-03-01'})` → got `2026-02`, expected `2026-03`.

**`src/tax.js:31` — `netFromGross` rounds negative halves toward zero**
What goes wrong: `Math.round` replaced `roundHalfUp`. That breaks the README rule that rounding is half away from zero and owned by `money.js`.
Input: `netFromGross(-2997, 'GB')` (exact value -2497.5) → got `-2497`, expected `-2498`.

## Rounding
The rule is `roundHalfUp` at `src/money.js:10` (half away from zero), as `README.md:11` documents. `multiply` at `src/money.js:16` wraps it for cents × factor. `allocate` at `src/money.js:50` doesn't call it: it floors each part and hands out the remainder so the parts add up to the total.

Direct dependents:
- `src/tax.js:21` `vatOn` (via `multiply`) and `src/tax.js:31` `netFromGross` (via `roundHalfUp`)
- `src/discounts.js:16` `percentOff` (via `multiply`)
- `src/creditnote.js:11` credited line net (via `roundHalfUp`)

Indirect dependents:
- `src/invoice.js:46` `lineNet` through `applyDiscounts`, and `src/invoice.js:58,62` `invoiceTotals` through `vatOn`
- `src/report.js:16,39` `monthlySummary` and `topSkus` through `invoiceTotals` and `lineNet`

`src/csv.js:64` uses `fromDecimal`, which parses exactly and rejects more than two decimals, so no rounding happens there.

---
- Implement: sonnet worker at medium effort, not escalated. `npm test` gives 46 pass, 0 fail; no existing test file changed; main is checked out.
- Review: opus worker at low effort, not escalated. All 6 findings have a file:line and an input the worker ran.
- Rounding: done in this session, not escalated, and under 150 words.