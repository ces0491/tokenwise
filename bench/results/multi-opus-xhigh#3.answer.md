## Fix

`invoiceTotals` worked out VAT on each line separately and added the rounded amounts, which breaks the README rule that VAT is charged once on the invoice net total. Three GB lines of 3c each gave 1c VAT per line, so 3c in total, when VAT on the 9c net should be 2c. `src/invoice.js:47` now calls `vatOn(net, region)`, and I removed the unused `lineVat` helper. All 29 tests pass. The change isn't committed, the README needs no update, and main is checked out.

## Review

**`src/csv.js:37`**: `csvField` no longer quotes values containing `\r` or `\n`, so `toCsv` output no longer parses back to the same rows. With `toCsv([['sku','description'],['C-3','two\nlines']])`, `parseCsv` returns `[["sku","description"],["C-3","two"],["lines"]]`, splitting one row into two.

**`test/csv.test.js:22` and `test/csv.test.js:26`**: the tests were weakened to hide that bug. The branch deletes the `csvField('x\ny')` assertion and the `['C-3','two\nlines']` round-trip row. On main both catch the change.

**`src/discounts.js:25`**: `tier.minQty < qty` leaves out a quantity that exactly equals `minQty`. The doc comment at line 8 says "less than or equal". `applyDiscount(1000, {type:'volume', tiers:[{minQty:10, percent:5}]}, 10)` returns 1000 when it should return 950, and `volumeTier([{minQty:10,percent:5}], 10)` returns `null`.

**`src/discounts.js:22`**: `tiers.sort(...)` sorts the caller's array in place. After `volumeTier([{minQty:50,percent:12},{minQty:10,percent:5}], 60)` the caller's array is reordered. If the tiers array is frozen, as in `volumeTier(Object.freeze([{minQty:50,percent:12},{minQty:10,percent:5}]), 60)`, it throws `TypeError: Cannot assign to read only property '0'`.

**`src/report.js:5-6`**: `monthKey` parses the date with `new Date` and reads the month in local time. The README says to group by the first seven characters of `issuedOn`.
- In a timezone behind UTC, e.g. `TZ=America/New_York`, `'2026-03-01'` becomes `'2026-02'`.
- `createInvoice` accepts `'2026-02-30'` (`src/invoice.js:5`), and `monthKey` then returns `'2026-03'` where main returns `'2026-02'`.

**`src/tax.js:31`**: `netFromGross` uses `Math.round`, which rounds negative halves toward zero. The README says `src/money.js` owns rounding and rounds half away from zero. `netFromGross(-3, 'GB')` works out -2.5 and returns -2; `roundHalfUp` gives -3.

## Rounding

The rounding rule is set in `src/money.js:10-13` (`roundHalfUp`, half away from zero). `multiply` (`src/money.js:16-20`) is the usual way other code reaches it.

Modules that depend on it:
- **Directly:**
  - `src/tax.js:21`: `vatOn` calls `multiply`.
  - `src/tax.js:31`: `netFromGross` calls `roundHalfUp`.
  - `src/discounts.js:16`: `percentOff` calls `multiply`, and the percent and volume discounts use it.
- **Indirectly:**
  - `src/invoice.js:41`: `lineNet` calls `applyDiscounts`.
  - `src/invoice.js:47`: `invoiceTotals` calls `vatOn`.
  - `src/report.js:16` (`invoiceTotals`) and `src/report.js:34` (`lineNet`) build on those.
- **Re-export:** `src/index.js:1` makes `roundHalfUp` and `multiply` public.

Some money code doesn't use this rule. `allocate` (`src/money.js:56-65`) truncates and hands out the remainder by largest share. `fromDecimal` rejects more than two decimal places rather than rounding, so `src/csv.js` does no rounding.