## Fix
`invoiceTotals` in `src/invoice.js` worked out VAT for each line separately, through a `lineVat` helper, and added up those rounded amounts. README says VAT is calculated once on the invoice net total, so the separate roundings added up to the wrong total; it now calls `vatOn` once on the net total, and all 29 tests pass.

## Review
**src/csv.js:37**
- **What goes wrong:** `csvField` no longer quotes fields that contain `\r` or `\n`. A multi-line field then splits into extra rows, so `toCsv` → `parseCsv` no longer round-trips.
- **Input 1:** `csvField('x\ny')` → review-me `x\ny` (unquoted); main `"x\ny"`.
- **Input 2:** `parseCsv(toCsv([['a','two\nlines']]))` → review-me `[["a","two"],["lines"]]`; main `[["a","two\nlines"]]`.

**test/csv.test.js:22 and :26**
- **What goes wrong:** the tests were weakened. The `csvField('x\ny')` assertion and the `['C-3','two\nlines']` round-trip row were deleted, so the csv.js regression above passes the suite.
- **Input:** run the main versions of these two tests against review-me's `src/csv.js` → both fail, for the reasons shown in the csv.js block.

**src/discounts.js:25**
- **What goes wrong:** `tier.minQty < qty` should be `<=`. A quantity exactly at a tier's minimum doesn't get that tier.
- **Input:** `volumeTier([{minQty:10,p:2},{minQty:1,p:1}], 10)` → review-me `{minQty:1,p:1}`; main `{minQty:10,p:2}`.

**src/discounts.js:22**
- **What goes wrong:** `tiers.sort(...)` sorts the caller's array in place, so calling `volumeTier` changes the input.
- **Input:** `t=[{minQty:10},{minQty:1}]; volumeTier(t,10)` → review-me leaves `t` as `[{minQty:1},{minQty:10}]`; main leaves `t` unchanged.

**src/report.js:5-6**
- **What goes wrong:** `monthKey` parses `issuedOn` with `new Date` and reads the local month. That breaks the README rule to group by the first seven characters of `issuedOn`. Date-only strings are parsed as UTC, so anywhere west of UTC the first of a month falls into the previous month.
- **Input:** with `TZ=America/New_York`, `monthKey({issuedOn:'2026-03-01'})` → review-me `2026-02`; main `2026-03`.

**src/tax.js:31**
- **What goes wrong:** `netFromGross` uses `Math.round` in place of `roundHalfUp`. That breaks the README rule that `money.js` owns rounding, half away from zero: negative halves now round toward zero.
- **Input:** `netFromGross(-3, 'GB')` (-3/1.2 = -2.5) → review-me `-2`; main `-3`.

## Rounding
The rule is decided in `roundHalfUp` at `src/money.js:10-12`, which rounds half away from zero; README.md:11 makes `money.js` the owner. `multiply` (`src/money.js:16-19`) is its only internal caller.

Dependents:
- `src/tax.js:1`: `vatOn` goes through `multiply` (tax.js:21), `grossFromNet` through `vatOn` (tax.js:26), and `netFromGross` calls `roundHalfUp` directly (tax.js:31).
- `src/discounts.js:1`: `percentOff` goes through `multiply` (discounts.js:16) and is used at discounts.js:34 and :41.
- `src/invoice.js:2-3`: `vatOn` (invoice.js:47) and the imported `applyDiscounts`.
- `src/report.js:1,16`: indirectly, through `invoiceTotals`.
- `src/index.js:1` re-exports `roundHalfUp` and `multiply`.

`allocate` (money.js:56-59) floors and hands out remainders separately. `csv.js:64` uses `fromDecimal`, which rejects more than two decimals rather than rounding.

---
- **Fix:** Sonnet worker at medium effort, not escalated. Check passed: `npm test` gives 29 pass, 0 fail, and only `src/invoice.js` changed. The removed `lineVat` wasn't referenced anywhere else, including `index.js`.
- **Review:** Opus worker at low effort, not escalated. Check passed: all six findings have a file:line and an input the worker ran. The branch was left unchanged.
- **Rounding:** a Haiku worker failed the check: most of its line numbers were wrong and it missed dependents. I rewrote the answer here from my final check instead of escalating, since the searches I'd already run covered it; the check now passes.
- main is checked out, and `src/invoice.js` is modified but not committed.