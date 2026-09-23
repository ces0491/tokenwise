## Fix
`invoiceTotals` in `src/invoice.js` worked out VAT for each line separately and added the rounded results together. That breaks the README rule that VAT is calculated once on the net total: three 3-cent GB lines came to 1+1+1 = 3 cents of VAT when it should be `vatOn(9) = 2`. Line 52 now reads `vat = vatOn(net, invoice.region)`, and `npm test` passes all 29 tests. The change is uncommitted and main is still checked out. `lineVat` is no longer called anywhere in src (it was never exported from `index.js`), so it could be deleted.

## Review
**`src/csv.js:37`**: `csvField` no longer quotes fields that contain `\r` or `\n`, so `toCsv` output no longer parses back to the same rows. Input: `parseCsv(toCsv([['C-3','two\nlines']]))` gives `[["C-3","two"],["lines"]]`. One row turns into two, and `linesFromCsv` would read a bad row from a multi-line description.

**`test/csv.test.js:22` and `:27`**: the tests were weakened to hide the defect above. The `csvField('x\ny')` assertion was deleted, and the `['C-3','two\nlines']` row was removed from the round-trip test.

**`src/discounts.js:25`**: `tier.minQty < qty` should be `<=`, which is what the doc comment at line 8 says. A quantity exactly at a tier's threshold gets no discount. Input: `applyDiscount(1000, {type:'volume', tiers:[{minQty:10, percent:5}]}, 10)` returns `1000` when it should return `950`.

**`src/discounts.js:22`**: `tiers.sort(...)` sorts the caller's array in place. Input: `t = [{minQty:50,percent:12},{minQty:10,percent:5}]; volumeTier(t, 20)` leaves `t` reordered. If the tiers array is frozen, the sort throws `TypeError` and the discount can't be applied at all.

**`src/report.js:5-6`**: `monthKey` now parses `issuedOn` with `new Date` (which reads a date-only string as UTC midnight) and then reads the month in local time. That breaks the README rule that reports group by the first seven characters of `issuedOn`. Input: `monthKey({issuedOn:'2026-03-01'})` with `TZ=America/New_York` returns `'2026-02'`, so the invoice lands in the wrong month of `monthlySummary`.

**`src/tax.js:31`**: `netFromGross` now uses `Math.round`, which rounds halves towards +∞. That breaks the README rule that `money.js` owns rounding, half away from zero. Input: `netFromGross(-3, 'GB')` (−3 / 1.2 = −2.5) returns `-2` when it should return `-3`.

## Rounding
Rounding is decided in `src/money.js:10-13` (`roundHalfUp`, half away from zero). `multiply` at `src/money.js:16-20` is the "multiply, then round once" wrapper around it.

Modules that depend on it directly:
- `src/tax.js:21`: `vatOn` goes through `multiply`.
- `src/tax.js:31`: `netFromGross` calls `roundHalfUp`.
- `src/discounts.js:16`: `percentOff` goes through `multiply`, and `applyDiscount` uses it at lines 34 and 41.

Modules that depend on it indirectly:
- `src/invoice.js:41` (`lineNet` → `applyDiscounts`) and `src/invoice.js:52` (`invoiceTotals` → `vatOn`).
- `src/report.js:16` and `:34`, through `invoiceTotals` and `lineNet`.

`src/index.js:1` re-exports both functions. `allocate` (`src/money.js:56-65`) doesn't use `roundHalfUp`: it truncates and then hands out the remaining cents by largest remainder. `fromDecimal` doesn't round; it rejects input with more than two decimal places.