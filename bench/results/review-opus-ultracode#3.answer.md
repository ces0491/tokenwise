**src/csv.js:37 — line breaks no longer get quoted**
`csvField` only quotes fields containing `,` or `"` now. A field with `\n` or `\r` goes out unquoted, and `parseCsv` reads the break as a new row, so `toCsv`/`parseCsv` stops round-tripping and `linesFromCsv` rejects the file.
Input: `parseCsv(toCsv([['C-3', 'two\nlines']]))` gives `[['C-3','two'],['lines']]`; HEAD gives `[['C-3','two\nlines']]`. A lone `\r` does the same: `parseCsv(toCsv([['a','x\ry']]))` gives `[['a','x'],['y']]`. And `linesFromCsv(toCsv([['sku','description','qty','unit'],['A','two\nlines','1','1.00']]))` throws `RangeError: csv row 1: qty must be a positive integer`.

**test/csv.test.js:21 and :26 — tests weakened to hide the csv.js defect**
The diff deletes `assert.equal(csvField('x\ny'), '"x\ny"')` from "csvField quotes only when needed". It also removes the `['C-3', 'two\nlines']` row from "toCsv round-trips through parseCsv". Those were the only checks on line-break quoting, and `npm test` still passes 29/29.
Input: the HEAD version of test/csv.test.js run against the current src/csv.js fails 2 of 5 tests: `'x\ny' !== '"x\ny"'`, and the round-trip returns the extra row `['lines']`.

**src/discounts.js:25 — a quantity exactly at a tier's minQty misses that tier**
The check changed from `tier.minQty <= qty` to `tier.minQty < qty`. The doc comment at line 8 says the tier applies when minQty is "less than or equal to the quantity".
Input: with `tiers = [{minQty:10,percent:5},{minQty:50,percent:12}]`, `volumeTier(tiers, 10)` returns `null` (HEAD: the 5% tier) and `volumeTier(tiers, 50)` returns the 5% tier (HEAD: 12%). `applyDiscount(1000, {type:'volume', tiers}, 10)` returns 1000 (HEAD 950), and `applyDiscount(1000, {type:'volume', tiers}, 50)` returns 950 (HEAD 880).

**src/discounts.js:22 — `tiers.sort` sorts the caller's array in place and throws on frozen arrays**
`volumeTier` now reorders the caller's `discount.tiers`. `createInvoice` only shallow-copies lines, so `lineNet`, `invoiceTotals`, `monthlySummary` and `topSkus` all change the caller's discount data. A frozen tiers array throws, even when it's already in ascending order.
Input: `const t = [{minQty:50,percent:12},{minQty:10,percent:5}]; lineNet({sku:'A', qty:60, unitCents:100, discounts:[{type:'volume', tiers:t}]})` leaves `t` ordered `[10, 50]` (HEAD leaves it as `[50, 10]`). `volumeTier(Object.freeze([{minQty:50,percent:12},{minQty:10,percent:5}]), 60)` throws `TypeError: Cannot assign to read only property '0'`; HEAD returns the 12% tier.

**src/report.js:5-6 — month key depends on the host timezone**
`new Date('YYYY-MM-DD')` parses as UTC midnight, but `getFullYear`/`getMonth` read local time. West of UTC, an invoice dated the 1st lands in the previous month, and 1 January lands in the previous year. This breaks the README rule "Monthly reports group by the first seven characters of `issuedOn`". The existing tests still pass under New York time because no report fixture is dated the 1st.
Input: with `process.env.TZ = 'America/New_York'`, `monthKey({issuedOn:'2026-03-01'})` returns `'2026-02'` and `monthKey({issuedOn:'2026-01-01'})` returns `'2025-12'` (HEAD: `'2026-03'`, `'2026-01'`). `monthlySummary` of two ZA invoices dated 2026-01-01 and 2026-01-15 returns separate `2025-12` and `2026-01` entries instead of one `2026-01` entry with count 2.

**src/report.js:5-6 — dates that pass validation get re-read as a different month**
`validateInvoice` accepts any day 01–31 in any month. `Date` rolls impossible dates forward into the next month, and `getFullYear` isn't zero-padded, so the key stops matching the first seven characters of `issuedOn` (README rule). This happens in every timezone.
Input: `monthKey({issuedOn:'2026-02-29'})` returns `'2026-03'` (HEAD `'2026-02'`), `'2026-04-31'` returns `'2026-05'` (HEAD `'2026-04'`), and `'0099-05-15'` returns `'99-05'` (HEAD `'0099-05'`). All three pass `validateInvoice`.

**src/tax.js:31 — `netFromGross` rounds with `Math.round` instead of money.js `roundHalfUp`**
This breaks the README rule "`src/money.js` owns rounding: half away from zero". `Math.round` rounds exact halves toward +∞, so a negative gross that lands exactly on .5 rounds toward zero. Only GB hit an exact half in a sweep of gross −200000 to 200000 (every negative odd multiple of 3), and all four regions matched HEAD for positive grosses.
Input: `netFromGross(-3, 'GB')` (raw −2.5) returns −2; HEAD returns −3. Likewise `netFromGross(-9, 'GB')` returns −7 (HEAD −8) and `netFromGross(-15, 'GB')` returns −12 (HEAD −13).