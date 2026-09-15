## Implement
I added `src/creditnote.js` with `createCreditNote`, exported it from `src/index.js`, and exported the invoice date regex `DATE` from `src/invoice.js` so both documents validate dates the same way. `invoiceTotals`, `monthlySummary` and `topSkus` now handle credit notes, and new tests in `test/creditnote.test.js` bring `npm test` to 44 of 44 passing. I updated the README rules and module table and the `package.json` description. The spec doesn't cover one case, so I made a call: a partial credit that names a SKU appearing on more than one invoice line throws `RangeError`, because it's unclear which line is meant. Nothing is committed yet; it's all on `main` waiting for your go-ahead.

## Review
**`src/report.js:5-6`**: `monthKey` now builds the month from `new Date(issuedOn)`. That parses the date as UTC midnight, but `getFullYear`/`getMonth` read local time. Anywhere west of UTC, the 1st of a month lands in the month before. That breaks the README rule to group by the first seven characters. Input: with `TZ=America/New_York`, `monthKey({ issuedOn: '2026-03-01' })` returns `'2026-02'`, and `monthlySummary` puts that invoice under `'2026-02'`.

**`src/discounts.js:25`**: `tier.minQty < qty` should be `<=`, so an order exactly at a tier's minimum gets no discount. Input: `applyDiscount(10000, { type: 'volume', tiers: [{ minQty: 10, percent: 5 }] }, 10)` returns `10000` instead of `9500`.

**`src/discounts.js:22`**: `tiers.sort(...)` sorts the caller's array in place. Calling `lineNet` on an invoice reorders that invoice's discount tiers, and a frozen tiers array makes it throw. Input: `volumeTier(Object.freeze([{ minQty: 50, percent: 12 }, { minQty: 10, percent: 5 }]), 60)` throws `TypeError: Cannot assign to read only property '0'`. Without the freeze, the caller's array comes back reordered.

**`src/tax.js:31`**: `Math.round` replaced `roundHalfUp`. That breaks the README rule that `money.js` owns rounding, half away from zero, because `Math.round` rounds negative halves up toward zero. Input: `netFromGross(-3, 'GB')` (-3 / 1.2 = -2.5) returns `-2` instead of `-3`.

**`src/csv.js:37`**: `csvField` no longer quotes fields that contain `\r` or `\n`, so `toCsv` output doesn't round-trip through `parseCsv`. Input: `parseCsv(toCsv([['sku', 'description'], ['C-3', 'two\nlines']]))` returns `[['sku','description'], ['C-3','two'], ['lines']]`.

**`test/csv.test.js:21-22, 26`**: The tests were weakened to match the `csvField` change. The `csvField('x\ny')` assertion was deleted after line 21, and the `['C-3', 'two\nlines']` row was dropped from the round-trip rows on line 26. Those were the two checks that catch the defect above, and without them all 29 tests pass on `review-me`.

## Rounding
`roundHalfUp` at `src/money.js:10-13` makes the decision: round half away from zero. `multiply` (`src/money.js:16-20`) wraps it. `allocate` (`src/money.js:56`) doesn't use it; it floors each share and hands out the leftover cents by largest remainder.

Dependents:
- `src/tax.js:21`: `vatOn` via `multiply`. `src/tax.js:31`: `netFromGross` calls `roundHalfUp` directly. `grossFromNet` (`tax.js:26`) goes through `vatOn`.
- `src/discounts.js:16`: `percentOff` via `multiply`, used by `applyDiscount` and `applyDiscounts` (lines 34, 41, 51).
- `src/invoice.js:41` (`lineNet`) and `:53`, `:57` (`invoiceTotals`), through discounts and `vatOn`.
- `src/creditnote.js:44`: prorated `netCents`.
- `src/report.js:17`, `:39`, through `invoiceTotals` and `lineNet`.
- `src/index.js:1` re-exports `roundHalfUp` and `multiply`.

`src/csv.js` doesn't depend on it, because `fromDecimal` rejects amounts with more than two decimal places.