**`src/discounts.js:23` — `tier.minQty < qty` excludes the exact boundary**
A tier that starts at `minQty` no longer applies when the quantity equals it. With `tiers = [{minQty: 10, ...}, {minQty: 50, ...}]`, `volumeTier(tiers, 10)` returns `null` (previously the 10-tier). The existing test only probes 9, 12, 20 and 100, so it passes.

**`src/discounts.js:22` — `tiers.sort(...)` mutates the caller's array**
`volumeTier` reorders the array passed in. `applyDiscount` (line 42) forwards `discount.tiers` directly, so calling `applyDiscount` on a discount object permanently reorders that object's `tiers` array. A caller reusing one discount config across invoices sees its input silently rewritten; with a frozen tiers array it throws `TypeError: Cannot assign to read only property`.

**`src/report.js:5-6` — `monthKey` uses `Date` instead of the first seven characters**
README: "Monthly reports group by the first seven characters of `issuedOn`." `new Date('2024-03-01')` parses as UTC midnight, and `getFullYear`/`getMonth` are local. In any UTC-negative zone (e.g. `TZ=America/New_York`), `monthKey({issuedOn: '2024-03-01'})` returns `"2024-02"`, putting the invoice in the wrong month and breaking the sorted month grouping.

**`src/tax.js:31` — `Math.round` is not half-away-from-zero**
README: `src/money.js` owns rounding, half away from zero. `Math.round` rounds halves toward `+Infinity`. `netFromGross(-9, 'GB')` = `Math.round(-7.5)` = `-7`; the documented rule gives `-8`. It also drops the `roundHalfUp` non-finite guard, so a `NaN` gross now returns `NaN` instead of throwing.

**`src/csv.js:34-37` — `csvField` no longer quotes line breaks**
A field containing `\n` or `\r` is emitted raw, so it splits into extra records on parse. `toCsv([['a', 'two\nlines']])` produces `a,two\nlines\n`, which `parseCsv` reads back as two rows `[['a','two'],['lines']]`. Round-tripping is broken for any field with an embedded newline.

**`test/csv.test.js:22` and `test/csv.test.js:27` — tests weakened to hide the above**
The `csvField('x\ny')` assertion was deleted and the `'C-3', 'two\nlines'` row was removed from the round-trip fixture. These were the only two assertions covering embedded newlines; without them the `csv.js` change passes the suite.