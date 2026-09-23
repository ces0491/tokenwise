## Fix

`invoiceTotals` in `src/invoice.js` worked out VAT on each line, rounded it, and then added the lines up. The README says VAT is charged once on the invoice net total, so three GB lines of 3c came to 3c VAT when it should be 2c (20% of 9c is 1.8c).

It now calls `vatOn(net, region)` once on the net total (`src/invoice.js:47`). I also removed the per-line `lineVat` helper, which nothing else used and `index.js` didn't export. `npm test` passes 29/29. The change isn't committed, main is checked out, and the README needed no change.

## Review

**`src/discounts.js:25`** (review-me): the check changed from `<=` to `<`, so a volume tier no longer applies when the quantity equals its `minQty`. That breaks the documented rule in the code comment ("minQty is less than or equal to the quantity"). Input: `volumeTier([{ minQty: 10, percent: 5 }], 10)` returns `null` when it should return the 5% tier, so `applyDiscount(1000, { type: 'volume', tiers: [{ minQty: 10, percent: 5 }] }, 10)` gives 1000 when it should give 950.

**`src/discounts.js:22`** (review-me): `tiers.sort(...)` sorts the caller's array in place. Calculating a total now reorders the discount data stored on the invoice line, and it throws when that array is frozen. Input: `volumeTier(Object.freeze([{ minQty: 50, percent: 12 }, { minQty: 10, percent: 5 }]), 60)` throws `TypeError: Cannot assign to read only property`. With an unfrozen array, the tiers on the invoice's line come back reordered.

**`src/report.js:5-6`** (review-me): `monthKey` now parses `issuedOn` with `new Date`, which reads a bare `YYYY-MM-DD` as UTC midnight, and then takes the month from local time. That breaks the README rule that reports group by the first seven characters of `issuedOn`. Input: `monthKey({ issuedOn: '2024-03-01' })` with `TZ=America/New_York` returns `'2024-02'`, so `monthlySummary` puts that invoice in February.

**`src/tax.js:31`** (review-me): `netFromGross` now uses `Math.round`, which rounds halves toward +∞, where the code should call the `money.js` rounding (half away from zero). That breaks the README rule that `src/money.js` owns rounding. Input: `netFromGross(-3, 'GB')` works out -3/1.2 = -2.5 and returns -2 when it should return -3. -9, -15 and -21 are wrong the same way.

**`src/csv.js:37`** (review-me): `csvField` no longer quotes fields that contain `\r` or `\n`, so a multi-line description gets split into extra rows when the CSV is read back. Input: `parseCsv(toCsv([['sku','description'],['C-3','two\nlines']]))` returns `[['sku','description'],['C-3','two'],['lines']]`.

**`test/csv.test.js:21-26`** (review-me): the branch weakens the tests. It deletes the `csvField('x\ny')` assertion and drops the `['C-3', 'two\nlines']` row from the round-trip test, which are the two cases that would catch the `csv.js:37` defect above. Input: on review-me, `csvField('x\ny')` returns `'x\ny'` unquoted and the suite still passes.

## Rounding

The rounding rule lives in `src/money.js:10` (`roundHalfUp`, half away from zero). `multiply` (`src/money.js:16-19`) applies it once per calculation.

Modules that depend on it:
- **`src/tax.js`**: `vatOn` at `:21` goes through `multiply`, and `netFromGross` at `:31` calls `roundHalfUp` directly. `grossFromNet` at `:26` uses `vatOn`.
- **`src/discounts.js`**: `percentOff` at `:16` goes through `multiply`, and percent and volume discounts use it at `:34` and `:41`.
- **`src/invoice.js`**: indirectly, through `applyDiscounts` at `:41` and `vatOn` at `:47`.
- **`src/report.js`**: indirectly, through `invoiceTotals` at `:16` and `lineNet` at `:34`.
- **`src/index.js:1`**: re-exports `roundHalfUp` and `multiply`.

`allocate` (`src/money.js:56-65`) is the exception. It makes its own rounding decision (truncate, then hand out remainders by largest remainder) and doesn't call `roundHalfUp`. `fromDecimal` (`src/money.js:31`) doesn't round; it rejects anything with more than two decimal places.