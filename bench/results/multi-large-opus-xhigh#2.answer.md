## Implement
I added `src/creditnote.js` with `createCreditNote`, exported it from `src/index.js`, and changed `invoiceTotals` and `topSkus` to handle credit notes (`monthlySummary` picks them up through `invoiceTotals`); where an invoice repeats a SKU, which the spec doesn't cover, a partial credit uses the first matching line. The new `test/creditnote.test.js` covers validation and its order of precedence, the prorated `roundHalfUp` amounts, that the invoice isn't mutated, negative totals and both reports, and `npm test` passes 41 of 41, with the README updated and nothing committed on `main`.

## Review
**`src/csv.js:37`**: `csvField` no longer quotes fields that contain `\r` or `\n`, so `toCsv` writes CSV that `parseCsv` reads back as the wrong rows.
Input: `parseCsv(toCsv([['sku','description'],['C-3','two\nlines']]))` returns `[['sku','description'],['C-3','two'],['lines']]`.

**`test/csv.test.js:22` and `:26`**: the test was weakened to hide the defect above. The `csvField('x\ny')` assertion was deleted and the `['C-3','two\nlines']` row was taken out of the round-trip test. Both fail against the new code.
Input: `csvField('x\ny')` returns `x\ny` where `"x\ny"` is expected.

**`src/discounts.js:25`**: `tier.minQty < qty` should be `<=`. A quantity exactly at a tier's `minQty` gets the lower tier or none.
Input: `applyDiscount(1000, {type:'volume', tiers:[{minQty:10,percent:5},{minQty:50,percent:12}]}, 10)` returns `1000` instead of `950`. `volumeTier(sameTiers, 50)` returns the 5% tier instead of 12%.

**`src/discounts.js:22`**: `tiers.sort(...)` sorts the caller's array in place, which reorders the discount data stored on invoice lines, and it throws when that array is frozen.
Input: `volumeTier(Object.freeze([{minQty:50,percent:12},{minQty:10,percent:5}]), 60)` throws `TypeError: Cannot assign to read only property '0'`.

**`src/report.js:5-6`**: `monthKey` now parses the date with `new Date` and reads the month in local time. That breaks the README rule to group by the first seven characters of `issuedOn`.
- Anywhere west of UTC, the first of a month lands in the previous month. With `TZ=America/New_York`, `monthKey({issuedOn:'2026-03-01'})` returns `'2026-02'`, and `monthlySummary` files that invoice under February.
- Dates that pass `validateInvoice` roll over. `monthKey({issuedOn:'2026-02-30'})` returns `'2026-03'` in any timezone.

**`src/tax.js:31`**: `netFromGross` uses `Math.round`, which rounds negative halves toward +∞. That breaks the README rule that `src/money.js` owns rounding, half away from zero.
Input: `netFromGross(-3, 'GB')` returns `-2`, but `roundHalfUp(-3/1.2)` is `-3`.

## Rounding
The rule is `roundHalfUp` at `src/money.js:10-13` (half away from zero), and `multiply` at `src/money.js:16-20` applies it once. Rounding in the codebase goes through these two, apart from the separate case at the end of this section.

Modules that use it directly:
- `src/tax.js`: `vatOn` at `:21` and `netFromGross` at `:31`
- `src/discounts.js`: `percentOff` at `:16`, which `applyDiscount` uses at `:34` and `:41`
- `src/creditnote.js:43`: `netCents`

Modules that use it through those:
- `src/invoice.js`: `lineNet` at `:41` and `invoiceTotals` at `:52` and `:56`
- `src/report.js`: `:17` and `:43`
- `src/index.js:1`, which re-exports it

`allocate` (`src/money.js:50-67`) doesn't use `roundHalfUp`: it splits amounts with floor plus largest remainder. `fromDecimal` (`src/money.js:31-32`) rejects more than two decimal places rather than rounding, so `src/csv.js` does no rounding.