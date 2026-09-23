## Implement
I added `src/creditnote.js`, which exports `createCreditNote` (also exported from `src/index.js`). It validates in the spec's order and returns a frozen note, with each line's `netCents` prorated from the original discounted `lineNet` and rounded once with `roundHalfUp`. `invoiceTotals` now gives negative totals for credit notes, with VAT worked out once on the credited net; `monthlySummary` and `topSkus` handle credit notes; and the README lists the new module and rule. `test/creditnote.test.js` adds 11 tests, `npm test` passes 40/40, and nothing is committed.

## Review
**`src/csv.js:37`**: `csvField` no longer quotes line breaks, so `toCsv` output with a newline in a field doesn't parse back the same. `parseCsv(toCsv([['A','x\ny']]))` returns `[["A","x"],["y"]]`.

**`test/csv.test.js:18-26`**: This weakens the tests to hide the defect above. The `csvField('x\ny')` assertion and the `['C-3','two\nlines']` round-trip row were deleted.

**`src/discounts.js:25`**: `tier.minQty < qty` should be `<=`, so a quantity exactly at a tier's threshold gets no discount. `applyDiscount(1000, {type:'volume', tiers:[{minQty:10, percent:5}]}, 10)` returns `1000` where it should return `950`.

**`src/discounts.js:22`**: `tiers.sort(...)` sorts the caller's array in place. After `volumeTier(tiers, 10)` with `tiers = [{minQty:50,…},{minQty:10,…}]`, the caller's array is reordered. With a frozen array, `volumeTier(Object.freeze([{minQty:50,percent:12},{minQty:10,percent:5}]), 60)` throws `TypeError: Cannot assign to read only property '0'`.

**`src/report.js:5-6`**: `monthKey` now parses the date as UTC midnight and reads it back in local time, which breaks the README rule that reports group by the first seven characters. With `TZ=America/New_York`, `monthKey({issuedOn:'2024-03-01'})` returns `'2024-02'`, and `monthlySummary` puts that invoice under `'2024-02'`. In any timezone, `'2024-02-30'` (which the invoice date regex accepts) returns `'2024-03'` where it should return `'2024-02'`.

**`src/tax.js:31`**: `netFromGross` uses `Math.round` instead of `roundHalfUp`. That breaks the README rule that `money.js` owns rounding, half away from zero: negative halves round toward zero. `netFromGross(-3, 'GB')` works out to −2.5 and returns `-2` where it should return `-3`.

## Rounding
The rounding rule is set in `src/money.js:10-13` (`roundHalfUp`, half away from zero). `multiply` (`src/money.js:16-20`) rounds its result through it once.

Modules that depend on it:
- **`src/tax.js`**: `vatOn` goes through `multiply` (`:21`). `grossFromNet` (`:26`) uses `vatOn`, and `netFromGross` calls `roundHalfUp` directly (`:31`).
- **`src/discounts.js`**: `percentOff` goes through `multiply` (`:16`) and is used by the percent and volume discounts (`:34`, `:41`).
- **`src/invoice.js`**: `lineNet` (`:39`) rounds through the discounts, and `invoiceTotals` rounds through `vatOn` (`:52`, `:56`).
- **`src/creditnote.js:42`**: prorates each line with `roundHalfUp`.
- **`src/report.js`**: depends on it indirectly through `invoiceTotals` and `lineNet` (`:42`).

`allocate` (`src/money.js:50-66`) has its own floor plus largest-remainder rounding and doesn't use `roundHalfUp`. `fromDecimal` doesn't round; it rejects more than two decimal places.