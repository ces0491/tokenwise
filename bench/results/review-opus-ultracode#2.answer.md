**1. src/csv.js:37: line breaks inside a field are no longer quoted**
- **What goes wrong:** `csvField` now quotes a field only if it has a comma or a quote. A field with `\n` or `\r` is written bare. `parseCsv` reads that bare line break as the end of a row, so `toCsv` output no longer round-trips.
- **Input:** `parseCsv(toCsv([['C-3', 'two\nlines']]))`
- **Result:** `[['C-3','two'],['lines']]` (before the change: `[['C-3','two\nlines']]`).
- **Knock-on:** `linesFromCsv(toCsv([['sku','description','qty','unit'],['C-3','two\nlines','1','2.00']]))` now throws `RangeError: csv row 1: qty must be a positive integer`. Before, it returned the line.

**2. test/csv.test.js:22 and :26: tests weakened to hide defect 1**
- **What goes wrong:** Two things were deleted: the `csvField('x\ny') === '"x\ny"'` assertion, and the `['C-3', 'two\nlines']` row from the round-trip test. Those are exactly the cases the csv.js change breaks, so `npm test` still passes 29/29.
- **Input:** run the HEAD version of `test/csv.test.js` against the new `src/csv.js`.
- **Result:** "csvField quotes only when needed" and "toCsv round-trips through parseCsv" both fail.

**3. src/discounts.js:25: a quantity exactly at a tier's `minQty` no longer gets that tier**
- **What goes wrong:** `<=` became `<`. The module doc at discounts.js:8 says a tier applies when minQty is "less than or equal to the quantity".
- **Input:** `tiers = [{minQty:10,percent:5},{minQty:50,percent:12}]`
- **Result:**
  - `volumeTier(tiers, 10)` returns `null` (was the 5% tier).
  - `applyDiscount(1000, {type:'volume', tiers}, 10)` returns `1000` (was `950`).
  - `applyDiscount(1000, {type:'volume', tiers}, 50)` returns `950` (was `880`).
- **Tests:** the existing tests use quantities 9, 12, 20 and 100, so neither boundary is covered.

**4. src/discounts.js:22: `volumeTier` sorts the caller's tiers array in place**
- **What goes wrong:** Looking up a tier now reorders the caller's discount config. `createInvoice` copies lines shallowly, so the invoice's tier arrays get reordered too. On a frozen tiers array the sort throws.
- **Input 1:** `const t = [{minQty:50,percent:12},{minQty:10,percent:5}]; volumeTier(t, 20);`
  - `t` is now ordered `[10, 50]` (before: left unchanged).
- **Input 2:** `volumeTier(Object.freeze([{minQty:50,percent:12},{minQty:10,percent:5}]), 60)`
  - Throws `TypeError: Cannot assign to read only property '0'` (before: returned the 12% tier).
- **Knock-on:** `invoiceTotals`, `monthlySummary` and `topSkus` throw the same error for any invoice line with frozen tiers.

**5. src/tax.js:31: `netFromGross` uses `Math.round` instead of `roundHalfUp` from money.js**
- **What goes wrong:** This breaks the README rule that `src/money.js` owns rounding, half away from zero. `Math.round` rounds negative .5 ties towards +∞, so credit notes (negative gross) get the wrong net.
- **Input:** `netFromGross(-3, 'GB')`, where -3 / 1.2 = -2.5
- **Result:** `-2` (was `-3`). `netFromGross(-69, 'GB')` returns `-57` (was `-58`).
- **Tests:** they only use positive gross values.

**6. src/report.js:5: `monthKey` goes through `new Date` instead of taking the first seven characters of `issuedOn`**
- **What goes wrong:** This breaks the README rule that monthly reports group by the first seven characters of `issuedOn`. It fails in three ways:
  - **Timezone:** a date-only string is parsed as UTC midnight, then read with local `getMonth`. With `process.env.TZ = 'America/New_York'`, `monthKey({issuedOn: '2026-03-01'})` returns `'2026-02'`, so `monthlySummary` counts March 1st invoices in February.
  - **Impossible dates:** `validateInvoice` accepts days like `2026-02-30`, and `new Date` rolls them into the next month. `monthKey(createInvoice({id:'X', region:'ZA', issuedOn:'2026-02-30', lines:[{sku:'A',qty:1,unitCents:100}]}))` returns `'2026-03'` in any timezone, UTC and Johannesburg included (was `'2026-02'`).
  - **Short years:** years below 1000 lose their padding. `monthKey({issuedOn: '0099-05-01'})` returns `'99-05'` (was `'0099-05'`).
- **Tests:** the only test uses the 15th of the month, so none of these cases is covered.