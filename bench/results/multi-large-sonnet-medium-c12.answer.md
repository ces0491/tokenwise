Good, main is checked out with the implementation changes in place, untouched review-me branch.

## Implement

Added `src/creditnote.js` with `createCreditNote`, exported it from `src/index.js`, and updated `invoiceTotals` (src/invoice.js) and `topSkus` (src/report.js) to handle credit notes per the spec's rounding and validation-precedence rules. All 45 tests pass (16 new in `test/creditnote.test.js`), existing tests untouched.

## Review

**src/csv.js:34-38** — `csvField` now only quotes on comma or quote, dropping the `\r\n` check. A field containing a newline is written unquoted, so `toCsv` produces a raw newline inside a value, which `parseCsv` reads back as a row break. Input: `toCsv([['a', 'two\nlines']])` → `"a,two\nlines\n"`; `parseCsv` of that returns `[['a','two'],['lines']]`, not the original row — round-trip is broken.

**test/csv.test.js:21,26** — The `csvField('x\ny')` assertion and the `'two\nlines'` case in the round-trip test were deleted, which is exactly the coverage that would have caught the csv.js regression above.

**src/discounts.js:20-28** (`volumeTier`) — Two defects:
1. Line 25 changed `tier.minQty <= qty` to `tier.minQty < qty`, contradicting the unchanged doc comment on line 8 ("less than or equal to") and the module's own JSDoc on line 19. Input: `volumeTier([{ minQty: 10, percent: 5 }], 10)` now returns `null` instead of the tier — a customer buying exactly the threshold quantity loses the discount.
2. Line 22 calls `tiers.sort(...)` in place, mutating the caller's array. Since `applyDiscounts`/`lineNet` are handed `line.discounts` directly (only the line object is shallow-copied in `createInvoice`, not its `discounts` array), this reorders the original discount config as a side effect of computing a total.

**src/report.js:4-7** (`monthKey`) — Rewritten to `new Date(invoice.issuedOn)` then `d.getFullYear()`/`d.getMonth()`. `new Date('YYYY-MM-DD')` parses as UTC midnight, but `getFullYear`/`getMonth` read it back in the local timezone, so this breaks README.md's documented rule ("Monthly reports group by the first seven characters of `issuedOn`"). Input: `monthKey({ issuedOn: '2026-01-01' })` run in a timezone west of UTC (e.g. UTC-5) returns `'2025-12'` instead of `'2026-01'`.

**src/tax.js:29-31** (`netFromGross`) — `roundHalfUp` replaced with `Math.round`, which rounds half-cent negatives toward positive infinity instead of away from zero, breaking README.md's rounding rule ("half away from zero, applied once at the end of a calculation"). Input: `netFromGross(-3, 'GB')` (rate 0.2, so `-3/1.2 = -2.5`) now returns `-2`; with `roundHalfUp` it was `-3`.

## Rounding

`src/money.js:10-13` (`roundHalfUp`) is the single source of truth: half away from zero, called once per calculation as README.md:11 requires. `multiply` (`src/money.js:16-20`) wraps it for scaling by a factor. Direct dependents: `src/tax.js:21` (`vatOn`, via `multiply`) and `:31` (`netFromGross`, via `roundHalfUp` directly); `src/discounts.js:16` (`percentOff`, via `multiply`); `src/creditnote.js:8` (credited `netCents`, via `multiply`). Transitively, `src/invoice.js` (`lineNet`, `invoiceTotals`) and `src/report.js` (`monthlySummary`, `topSkus`) depend on the decision through those modules.