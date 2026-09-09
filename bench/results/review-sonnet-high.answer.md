**Defect 1 — src/csv.js:37**
`csvField` no longer quotes fields containing `\r` or `\n` (regex narrowed from `/[",\r\n]/` to `/[",]/`). This breaks the CSV writer's own round-trip contract with `parseCsv`, which still treats bare `\n`/`\r` as row separators (src/csv.js:24-27). Input: `toCsv([['C-3', 'two\nlines']])` produces `"C-3,two\nlines\n"`, which `parseCsv` then reads back as two rows (`['C-3','two']` and `['lines']`) instead of the original row — silent data corruption for any description/field containing a newline.

**Defect 2 — src/discounts.js:20-28**
`volumeTier` now uses `tier.minQty < qty` (strict) instead of `<=`, contradicting the function's own documented rule at src/discounts.js:8 ("applies the highest tier whose minQty is less than or equal to the quantity"). Input: `volumeTier([{minQty: 10, percent: 5}], 10)` returns `null` instead of the 10-qty tier, so a line with quantity exactly 10 gets no volume discount when it should get 5% off.

**Defect 3 — src/tax.js:29-31**
`netFromGross` now uses `Math.round` instead of `roundHalfUp`, breaking the README rule "`src/money.js` owns rounding: half away from zero, applied once at the end of a calculation." `Math.round` rounds half-way values toward `+Infinity`, not away from zero. Input: `netFromGross(-3, 'GB')` (rate 0.2, divisor 1.2) computes `-3/1.2 = -2.5`; `Math.round(-2.5)` returns `-2`, whereas half-away-from-zero rounding (the documented/previous behaviour) gives `-3`.

**Defect 4 — src/report.js:4-7**
`monthKey` now parses `issuedOn` with `new Date(...)` and reads `getFullYear()`/`getMonth()`, instead of slicing the string, breaking the README rule "Monthly reports group by the first seven characters of `issuedOn`." `new Date('2024-03-01')` is parsed as UTC midnight, but `getFullYear`/`getMonth` read local time. In any timezone behind UTC (e.g. `America/New_York`, UTC-5), `monthKey({issuedOn: '2024-03-01'})` returns `'2024-02'` instead of `'2024-03'`, misfiling the invoice into the wrong month's report.

**Defect 5 — test/csv.test.js:19-27 (weakened tests)**
The assertion `assert.equal(csvField('x\ny'), '"x\ny"')` was deleted, and the `'C-3', 'two\nlines'` row was dropped from the `toCsv`/`parseCsv` round-trip fixture. These are exactly the cases that catch Defect 1 — with them removed, `npm test` passes despite `csvField` no longer quoting embedded newlines.