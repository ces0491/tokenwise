**src/csv.js:37**
`csvField` no longer quotes values that contain `\n` or `\r`. `toCsv` then writes the line break raw, so its output doesn't survive `parseCsv`, and `linesFromCsv` would split the line into bad rows.
Input: `toCsv([['sku','description'],['C-3','two\nlines']])` gives `"sku,description\nC-3,two\nlines\n"`. `parseCsv` reads that back as `[['sku','description'],['C-3','two'],['lines']]`. A `\r` fails the same way: `parseCsv(toCsv([['a\rb']]))` gives `[['a'],['b']]`.

---

**test/csv.test.js:22 and :26**
The diff weakens the tests. It deletes `assert.equal(csvField('x\ny'), '"x\ny"')` and drops the `['C-3', 'two\nlines']` row from the round-trip test. Those were the only checks on line breaks, and they fail against the new `csvField`. With them gone, `npm test` passes (29/29) while the CSV defect above ships.
Input: put `assert.equal(csvField('x\ny'), '"x\ny"')` back and it fails, because `csvField` now returns `x\ny` without quotes.

---

**src/discounts.js:25**
`tier.minQty < qty` should be `<=`. A quantity exactly equal to a tier's `minQty` no longer gets that tier. This contradicts the doc comment on line 8 ("minQty is less than or equal to the quantity"). The existing tests only use quantities of 9, 12, 20 and 100, so none of them hits the boundary.
Input: `volumeTier([{minQty:10, percent:5}], 10)` returns `null`. `applyDiscount(10000, {type:'volume', tiers:[{minQty:10, percent:5}]}, 10)` returns `10000` where it should return `9500`.

---

**src/discounts.js:22**
`tiers.sort(...)` sorts the caller's array in place. It reorders the tiers inside discount objects the caller passed in. `createInvoice` only shallow-copies lines, so an invoice's `discounts` arrays are the caller's own arrays and get reordered too. If the tiers array is frozen, the call throws.
Input: with `const t = [{minQty:50,percent:12},{minQty:10,percent:5}]`, calling `volumeTier(t, 60)` leaves `t` as `[{minQty:10,...},{minQty:50,...}]`. `volumeTier(Object.freeze([{minQty:50,percent:12},{minQty:10,percent:5}]), 60)` throws `TypeError: Cannot assign to read only property '0'`.

---

**src/report.js:5-6**
`monthKey` now runs `issuedOn` through `new Date`, which parses it as UTC midnight, then reads the month back in local time. That breaks the README rule that "Monthly reports group by the first seven characters of `issuedOn`". The result depends on the machine's timezone, and impossible dates that `validateInvoice`'s regex accepts roll over into the next month.
Input: with `process.env.TZ = 'America/New_York'`, `monthKey({issuedOn:'2024-03-01'})` returns `'2024-02'`. On a UTC or SAST machine, `monthKey({issuedOn:'2024-02-30'})` returns `'2024-03'` and `monthKey({issuedOn:'2024-04-31'})` returns `'2024-05'`. The old code returned `'2024-02'` and `'2024-04'`.

---

**src/tax.js:31**
`netFromGross` uses `Math.round` where it used `roundHalfUp`. `Math.round` rounds a negative half toward zero, so negative gross amounts such as credit notes round the wrong way. That breaks the README rule that `src/money.js` owns rounding, half away from zero. The `roundHalfUp` import was removed along with it.
Input: `netFromGross(-3, 'GB')` gives `Math.round(-2.5)` = `-2`, where it should be `-3`. `netFromGross(-9, 'GB')` returns `-7` where it should be `-8`.