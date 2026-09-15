Good, main is checked out with my implementation changes. Everything's ready.

## Implement

Added `src/creditnote.js` with `createCreditNote`, exported from `src/index.js`; updated `invoiceTotals` in `src/invoice.js` and `topSkus` in `src/report.js` to handle credit notes per spec. All 45 tests pass (`npm test`), including 16 new tests in `test/creditnote.test.js` covering validation order, no-mutation of the original invoice, proportional netCents rounding, and totals/report integration.

## Review

**`src/discounts.js:22-25` — `volumeTier` off-by-one excludes the exact threshold qty.** `tier.minQty <= qty` was changed to `tier.minQty < qty`. The docstring still says "minQty less than or equal to the quantity." `volumeTier([{minQty: 10, percent: 5}], 10)` now returns `null` instead of the 5% tier.

**`src/discounts.js:22` — `volumeTier` mutates the caller's `tiers` array via in-place `.sort()`.** A shared discount object's `tiers` gets silently reordered after the first call, e.g. `const d = { tiers: [{minQty:50,...},{minQty:10,...}] }; applyDiscount(1000, d, 5)` permanently reorders `d.tiers`.

**`src/tax.js:31` — `netFromGross` swapped `roundHalfUp` for `Math.round`, breaking the README's "half away from zero" rule for negative amounts.** `netFromGross(-3, 'GB')` computes `-3/1.2 = -2.5`; correct result is `-3`, but `Math.round(-2.5)` gives `-2`.

**`src/csv.js:37` — `csvField` no longer quotes embedded line breaks, corrupting round-trip CSV.** Regex narrowed from `/[",\r\n]/` to `/[",]/`. `csvField('x\ny')` now returns `x\ny` unquoted; `parseCsv(toCsv([['x\ny']]))` no longer round-trips and splits into an extra row.

**`test/csv.test.js:22, 26-27` — tests weakened to mask the csv.js regression.** The assertion `csvField('x\ny') === '"x\ny"'` was deleted, and the round-trip test's row list dropped the `['C-3', 'two\nlines']` case — the only coverage that would have caught the newline-quoting bug.

**`src/report.js:4-6` — `monthKey` replaced `issuedOn.slice(0, 7)` with `new Date(...)` parsing, violating the README's documented string-slicing rule and making grouping timezone-dependent.** In a UTC-negative timezone, `monthKey({ issuedOn: '2024-01-01' })` can return `'2023-12'` instead of `'2024-01'`, since `new Date('2024-01-01')` parses as UTC midnight but `getFullYear`/`getMonth` read local time.

## Rounding

All monetary rounding is decided in `src/money.js:10-13` (`roundHalfUp`) and `src/money.js:16-20` (`multiply`, which calls `roundHalfUp` once). Direct dependents: `src/tax.js:21` (`vatOn`, via `multiply`) and `src/tax.js:31` (`netFromGross`, via `roundHalfUp` directly — though on `review-me` this was swapped to `Math.round`, see Review); `src/discounts.js:16` (`percentOff`, via `multiply`); `src/creditnote.js:43` (proportional `netCents`, via `multiply`). Everything downstream (`invoice.js`, `report.js`) consumes these already-rounded cent values without rounding again.