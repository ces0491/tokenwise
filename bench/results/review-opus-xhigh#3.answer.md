**src/csv.js:37**
`csvField` no longer quotes fields that contain `\n` or `\r`. `toCsv` writes the line break unquoted, so `parseCsv` reads it as the end of a row and the round-trip breaks. The comment on `parseCsv` says it handles newlines inside quoted fields, but the writer no longer produces them.
Input: `parseCsv(toCsv([['C-3', 'two\nlines']]))` returns `[["C-3","two"],["lines"]]` instead of `[["C-3","two\nlines"]]`.

**test/csv.test.js:21–22 and :26**
The test was weakened. The assertion `csvField('x\ny') === '"x\ny"'` was deleted, and the `['C-3', 'two\nlines']` row was removed from the round-trip test. Those were the only checks on line breaks inside fields, so the regression above now passes (`npm test`: 29 pass, 0 fail).
Input: put either removed line back and the suite fails against the current `src/csv.js`.

**src/discounts.js:91**
`tier.minQty < qty` should be `<=`. A quantity exactly equal to a tier's `minQty` no longer gets that tier. This contradicts the module's own rule at line 8: "the highest tier whose minQty is less than or equal to the quantity". The existing tests use qty 9, 12, 20 and 100, so none of them hit the boundary.
Input: with `tiers = [{minQty:10, percent:5}, {minQty:50, percent:12}]`, `volumeTier(tiers, 10)` returns `null`, so `applyDiscount(1000, {type:'volume', tiers}, 10)` returns `1000` instead of `950`. `volumeTier(tiers, 50)` returns the 5% tier instead of the 12% tier.

**src/discounts.js:88**
`tiers.sort(...)` sorts the caller's array in place. That changes the order of the discount config the caller passed in: `createInvoice` copies lines shallowly, so the `discounts` and `tiers` arrays are still shared with the caller. It also throws on a frozen tiers array.
Input: `volumeTier(Object.freeze([{minQty:50, percent:12}, {minQty:10, percent:5}]), 20)` throws `TypeError: Cannot assign to read only property '0'`. With an unfrozen `[{minQty:50,…}, {minQty:10,…}]`, the caller's array comes back reordered to `[{minQty:10,…}, {minQty:50,…}]`.

**src/tax.js:30**
`netFromGross` now calls `Math.round` instead of `roundHalfUp`. That breaks the README rule that `src/money.js` owns rounding, half away from zero. `Math.round` rounds negative halves toward zero, so credit or refund amounts round the wrong way (`cents()` accepts negative values).
Input: `netFromGross(-3, 'GB')`, where -3 / 1.2 = -2.5, returns `-2`. The rule gives `-3`, which is what `roundHalfUp` returned before the change.

**src/report.js:5–6**
`monthKey` now parses `issuedOn` with `new Date(...)` and reads local-time fields. This breaks the README rule "Monthly reports group by the first seven characters of `issuedOn`". A date-only `YYYY-MM-DD` string is parsed as UTC midnight, so in any timezone west of UTC, invoices dated the 1st land in the previous month in `monthlySummary`. Years below 100 also lose their zero padding.
Input: under `TZ=America/New_York`, `monthKey({ issuedOn: '2026-03-01' })` returns `'2026-02'` (confirmed by running it). In any timezone, `monthKey({ issuedOn: '0099-03-01' })` returns `'99-03'`.