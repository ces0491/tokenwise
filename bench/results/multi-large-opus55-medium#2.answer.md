## Implement

I added `src/creditnote.js` with `createCreditNote`, exported it from `src/index.js`, and made `invoiceTotals`, `monthlySummary` and `topSkus` handle credit notes. Credited lines are prorated from the discounted line net and rounded once with `roundHalfUp`, and VAT is worked out once on the credited total. I added `test/creditnote.test.js` and updated the README, `npm test` passes (39 of 39), and the changes are on `main`, not committed.

## Review

**`src/csv.js:37`**: `csvField` no longer quotes fields that contain `\r` or `\n`, so a multi-line field splits into two rows and CSV no longer round-trips. `parseCsv(toCsv([['C-3','two\nlines']]))` returns `[["C-3","two"],["lines"]]`.

**`test/csv.test.js:22,26`** (main's line numbers): the branch weakens the tests. It deletes the `csvField('x\ny')` assertion and the `'two\nlines'` round-trip row, which are exactly the two checks that would catch the defect above.

**`src/discounts.js:25`**: `tier.minQty < qty` should be `<=`. At the tier threshold no discount applies, which contradicts the doc comment at line 8. `lineNet({sku:'A',qty:10,unitCents:100,discounts:[{type:'volume',tiers:[{minQty:10,percent:5}]}]})` returns 1000 when it should be 950.

**`src/discounts.js:22`**: `tiers.sort(...)` sorts the caller's array in place. `createInvoice` only makes shallow copies of lines, so calling `lineNet` reorders the discount data stored on an invoice. With `t=[{minQty:50,percent:12},{minQty:10,percent:5}]`, `volumeTier(t,20)` leaves `t` reordered. If the tiers array is frozen, `volumeTier(Object.freeze([...]),20)` throws `TypeError: Cannot assign to read only property '0'`.

**`src/report.js:5-6`**: `monthKey` now parses the date with `new Date`, which reads it as UTC midnight, and then takes the month in local time. That breaks the README rule that reports group by the first seven characters of `issuedOn`. With TZ `America/New_York`, `monthKey({issuedOn:'2026-03-01'})` gives `'2026-02'` and `'2026-01-01'` gives `'2025-12'`. The tests only pass because this machine is ahead of UTC.

**`src/tax.js:31`**: `netFromGross` now uses `Math.round` instead of `roundHalfUp`, which breaks the README rule that `src/money.js` owns rounding with halves rounded away from zero. `Math.round` rounds negative halves toward zero, so `netFromGross(-3,'GB')` (exactly −2.5) returns −2 when it should be −3.

## Rounding

`src/money.js:10` `roundHalfUp` decides rounding (half away from zero). `src/money.js:16` `multiply` rounds once through it (line 19). `allocate` (`src/money.js:50`) uses its own largest-remainder method and doesn't depend on that function.

Direct dependents:
- `src/tax.js:21` `vatOn` (through `multiply`), which `grossFromNet` (`src/tax.js:26`) also uses
- `src/tax.js:31` `netFromGross`
- `src/discounts.js:16` `percentOff` (through `multiply`), used by the percent and volume discounts
- `src/creditnote.js:34` for credited line nets

Indirect dependents:
- `src/invoice.js:46` `lineNet`, through `applyDiscounts`
- `src/invoice.js:56,60` `invoiceTotals`, through `vatOn`
- `src/report.js:17,42` `monthlySummary` and `topSkus`, through `invoiceTotals` and `lineNet`

`src/csv.js` only uses `fromDecimal`, which does no rounding.