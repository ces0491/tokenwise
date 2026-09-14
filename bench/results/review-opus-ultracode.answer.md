**src/csv.js:37**
`csvField` no longer quotes fields that contain `\n` or `\r`. `toCsv` then writes a multi-line value unquoted, and `parseCsv` (which does support quoted newlines) reads it back as extra rows. Any CSV export with a multi-line description gets corrupted, and `linesFromCsv` on that output mis-assigns columns or throws.
Input: `parseCsv(toCsv([['sku','description'],['C-3','two\nlines']]))` returns `[['sku','description'],['C-3','two'],['lines']]`. HEAD returns the input rows. `csvField('x\ny')` returns `x\ny` where HEAD returned `"x\ny"`.

**test/csv.test.js:22 and :26**
The tests were weakened to hide the regression above. The assertion `assert.equal(csvField('x\ny'), '"x\ny"')` after line 21 was deleted, and the `['C-3', 'two\nlines']` row was dropped from the round-trip test at line 26. The suite still passes 29/29 only because both checks are gone.
Input: put the round-trip row back, `rows = [..., ['C-3','two\nlines']]`. Then `assert.deepEqual(parseCsv(toCsv(rows)), rows)` fails on the current code.

**src/discounts.js:25**
`tier.minQty < qty` replaced `<=`, so a quantity exactly equal to a tier's `minQty` gets no tier. This contradicts the module doc at line 8 ("minQty is less than or equal to the quantity").
Input: `volumeTier([{minQty:10,percent:5},{minQty:50,percent:12}], 10)` returns `null` (expected the 5% tier). `applyDiscount(1000, {type:'volume', tiers}, 50)` returns `950` (expected `880`). `lineNet({sku:'A', qty:10, unitCents:100, discounts:[{type:'volume', tiers:[{minQty:10,percent:5}]}]})` returns `1000` (expected `950`).

**src/discounts.js:22**
`tiers.sort(...)` sorts the caller's array in place. That changes the caller's discount data, including invoices built with `createInvoice`, because it only shallow-copies lines and the frozen invoice shares the tiers array. It also throws on frozen tier arrays, which HEAD handled.
Input: `const t = [{minQty:50,percent:12},{minQty:10,percent:5}]; volumeTier(t, 20);` leaves `t` in the order `[10, 50]`. `volumeTier(Object.freeze([{minQty:50,percent:12},{minQty:10,percent:5}]), 60)` throws `TypeError: Cannot assign to read only property '0'`, where HEAD returns the 12% tier. `invoiceTotals` on an invoice using that frozen array throws the same error.

**src/report.js:5–6**
`new Date('YYYY-MM-DD')` parses as UTC midnight, but `getFullYear()`/`getMonth()` read local time. On a host behind UTC, an invoice dated the 1st lands in the previous month, and on 1 January in the previous year. This breaks the README rule "Monthly reports group by the first seven characters of `issuedOn`". The existing test uses the 15th, so it passes in any timezone.
Input: with `TZ=America/New_York`, `monthKey({issuedOn:'2026-03-01'})` returns `'2026-02'` and `monthKey({issuedOn:'2026-01-01'})` returns `'2025-12'`. `monthlySummary` over ZA invoices dated 2026-03-01, 2026-03-20 and 2026-01-01 returns buckets `2025-12`, `2026-02`, `2026-03` with count 1 each. HEAD returns `2026-01` (count 1) and `2026-03` (count 2).

**src/report.js:5**
`validateInvoice`'s date regex accepts impossible days such as `2024-02-30`. `Date` parsing rolls these into the next month, so the key no longer matches the first seven characters of `issuedOn` (README rule).
Input: with `TZ=UTC` or `Africa/Johannesburg`, `monthKey({issuedOn:'2024-02-30'})` returns `'2024-03'` (HEAD `'2024-02'`). `monthlySummary` over invoices dated `2024-02-30` and `2024-03-05` merges them into a single `2024-03` bucket with count 2.

**src/report.js:6**
The year from `getFullYear()` isn't zero-padded, so years below 1000 give keys that aren't `YYYY-MM`. These break the README grouping rule and the ascending month order `monthlySummary` promises, because keys are sorted as strings. `validateInvoice` accepts such dates (`\d{4}`).
Input: `monthKey({issuedOn:'0099-05-15'})` returns `'99-05'` (HEAD `'0099-05'`). `monthlySummary` over invoices dated `0099-05-15` and `2026-01-15` returns keys in the order `['2026-01', '99-05']`.

**src/tax.js:31**
`netFromGross` swapped `roundHalfUp` for `Math.round`, which rounds exact halves towards +∞. Negative gross amounts therefore round towards zero, breaking the README rule that `src/money.js` owns rounding, half away from zero. It also makes a negative amount round differently from its positive mirror. Across gross −200000..200000 only GB differs from HEAD, with 33,333 mismatches, all negative.
Input: `netFromGross(-3, 'GB')` returns `-2`, since −3/1.2 = −2.5 exactly. HEAD and the README give `-3`, while `netFromGross(3, 'GB')` returns `3`. `netFromGross(-9, 'GB')` returns `-7` (expected `-8`).