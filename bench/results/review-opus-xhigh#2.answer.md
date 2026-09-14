**src/csv.js:37 (doc comment at :34)**
`csvField` no longer quotes fields containing `\n` or `\r`. `parseCsv` splits rows on unquoted line breaks, so any multi-line value written by `toCsv` comes back as extra rows. The CSV output is corrupted.
Input: `parseCsv(toCsv([['sku','description'],['C-3','two\nlines']]))` returns `[["sku","description"],["C-3","two"],["lines"]]`. `toCsv([['a','x\ry']])` has the same problem: it parses back as `[["a","x"],["y"]]`.

**test/csv.test.js:21–25**
Tests were weakened to match the bug above. The `csvField('x\ny')` → `'"x\ny"'` assertion was deleted, and the `['C-3', 'two\nlines']` row was removed from the `toCsv` round-trip test. Line breaks inside fields now have no test coverage, which is why `npm test` still passes (29/29).
Input: put back `assert.equal(csvField('x\ny'), '"x\ny"')` and it fails, returning `x\ny` unquoted.

**src/discounts.js:25**
The check changed from `minQty <= qty` to `minQty < qty`, so a quantity exactly at a tier's threshold doesn't get that tier. This breaks the rule in the module's own doc comment ("minQty is less than or equal to the quantity").
Input: with `tiers = [{minQty:10,percent:5},{minQty:50,percent:12}]`, `volumeTier(tiers, 10)` returns `null`, so `applyDiscount(1000, {type:'volume',tiers}, 10)` gives `1000` when it should give `950`. `volumeTier(tiers, 50)` returns the 5% tier when it should return the 12% one.

**src/discounts.js:22**
`tiers.sort(...)` sorts the caller's array in place. Every `lineNet` or `invoiceTotals` call quietly reorders the `discounts[].tiers` arrays on the invoice. If the tiers array is frozen, sort throws even when it's already in order.
Input: `volumeTier(Object.freeze([{minQty:10,percent:5},{minQty:50,percent:12}]), 20)` throws `TypeError: Cannot assign to read only property '0'`. With an unfrozen `u = [{minQty:50,...},{minQty:10,...}]`, calling `volumeTier(u, 20)` leaves `u` reordered to `[{minQty:10,...},{minQty:50,...}]`.

**src/report.js:5–6**
`monthKey` now parses `issuedOn` with `new Date()`, which reads `YYYY-MM-DD` as UTC midnight, then takes the month in local time. That breaks the README rule "Monthly reports group by the first seven characters of `issuedOn`". In any timezone behind UTC, invoices dated on the 1st go into the previous month in `monthlySummary`.
Input: with `TZ=America/New_York`, `monthKey({issuedOn:'2026-03-01'})` returns `'2026-02'` instead of `'2026-03'`. The existing test uses `2026-03-15` and runs at UTC+2 here, so it doesn't catch this.

**src/tax.js:31 (import at :1, comment at :29)**
`netFromGross` now uses `Math.round` in place of `roundHalfUp`. `Math.round` rounds .5 toward +∞, so negative gross amounts (credit notes) with an exact half cent round the wrong way. This breaks the README rule that `src/money.js` owns rounding, half away from zero. Positive amounts give the same result as before, which is why the tests still pass.
Input: `netFromGross(-2997, 'GB')` works out to −2497.5 and returns `-2497`. Half away from zero gives `-2498`.