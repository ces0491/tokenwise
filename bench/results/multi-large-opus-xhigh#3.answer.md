## Implement
I added `src/creditnote.js` with `createCreditNote`, exported from `src/index.js`. `invoiceTotals` now returns negative totals for credit notes, `topSkus` subtracts credited lines, and `monthlySummary` picks them up through `invoiceTotals`; I also exported the invoice `DATE` pattern so both use the same check, and updated the README. `test/creditnote.test.js` adds 18 tests and `npm test` passes 47 of 47; the spec doesn't cover a partial credit for a SKU that appears on more than one invoice line, so I reject that with `RangeError`, and nothing is committed yet.

## Review
**`src/csv.js:37`**: `csvField` no longer quotes line breaks, so `toCsv` output doesn't parse back to the same rows. Input: `parseCsv(toCsv([['C-3', 'two\nlines']]))` returns `[['C-3','two'],['lines']]`, one row split into two.

**`test/csv.test.js:21-26`**: Tests were weakened to hide the defect above. The `csvField('x\ny')` assertion and the `['C-3', 'two\nlines']` round-trip row were deleted, so the suite still passes 29 of 29 on the branch.

**`src/discounts.js:25`**: `tier.minQty < qty` should be `<=`, so a quantity exactly at a tier's minimum gets no discount. That breaks the documented rule at `discounts.js:8`. Input: `applyDiscount(1000, { type: 'volume', tiers: [{ minQty: 10, percent: 5 }] }, 10)` returns `1000`, expected `950`. Likewise `lineNet` for qty 10 at 100 cents returns `1000`.

**`src/discounts.js:22`**: `tiers.sort(...)` sorts the caller's array in place. A frozen tiers array throws, and an unfrozen one gets reordered inside the invoice (`createInvoice` only shallow-copies lines). Input: `volumeTier(Object.freeze([{ minQty: 50, percent: 12 }, { minQty: 10, percent: 5 }]), 60)` throws `TypeError: Cannot assign to read only property '0'`.

**`src/report.js:5-6`**: `monthKey` parses `issuedOn` with `new Date` (UTC midnight) and reads the month in local time. README says reports group by the first seven characters of `issuedOn`. Inputs: with `TZ=America/New_York`, `monthKey({ issuedOn: '2026-03-01' })` returns `'2026-02'`. In any timezone, `'2026-02-30'` passes `validateInvoice` but rolls over to `'2026-03'`; in Africa/Johannesburg, `'2026-04-31'` gives `'2026-05'`.

**`src/tax.js:31`**: `netFromGross` uses `Math.round` in place of `roundHalfUp`. That rounds negative halves toward zero and breaks the README rule that `src/money.js` owns rounding, half away from zero. Input: `netFromGross(-3, 'GB')` (−2.5) returns `-2`, expected `-3`; `netFromGross(-9, 'GB')` returns `-7`, expected `-8`.

## Rounding
The decision is made in `src/money.js:10-13`: `roundHalfUp` rounds half away from zero, and `multiply` (`money.js:16-19`) wraps it. `allocate` handles its own rounding (`money.js:56-63`): it truncates, then hands out the remainder by largest fraction.

Dependents:
- `src/tax.js:21` `vatOn` via `multiply`; `tax.js:26` `grossFromNet` via `vatOn`; `tax.js:31` `netFromGross` calls `roundHalfUp` directly.
- `src/discounts.js:16` `percentOff` via `multiply`, used by percent and volume discounts at `:34` and `:41`.
- `src/invoice.js:43` `lineNet` (discounts) and `:55`, `:59` `invoiceTotals` (VAT).
- `src/creditnote.js:12` prorated credit via `roundHalfUp` over `lineNet`.
- `src/report.js:17`, `:39` via `invoiceTotals` and `lineNet`.
- `src/index.js:1` re-exports `roundHalfUp` and `multiply` publicly.