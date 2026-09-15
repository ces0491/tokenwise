Both jobs complete and checked. `main` is checked out with `src/invoice.js` fixed (uncommitted). All 10 review findings carry file:line and a concrete failing input.

## Fix

`invoiceTotals` in `src/invoice.js` was rounding VAT separately on each invoice line and summing the rounded results, instead of rounding once on the invoice's total net amount as `vatOn` documents ("VAT due on a net amount, rounded once", `tax.js:19`). For a GB invoice with three 3-cent lines, per-line rounding gave `3` cents of VAT (three lots of `round(0.6)=1`) while the correct once-only rounding gives `round(1.8)=2`, which is what the test expected. Fixed by having `invoiceTotals` sum the net first and call `vatOn` once on that total; `npm test` now passes 29/29 with only `src/invoice.js` modified and nothing under `test/` touched.

## Review

**1. `src/discounts.js:25` — tier boundary uses `<` instead of `<=`**
Docstring (`src/discounts.js:8`) requires the tier whose `minQty` is less than or equal to the quantity; the code now uses strict `<`, so a quantity exactly equal to a tier's `minQty` doesn't qualify. `volumeTier(tiers, 10)` with `tiers=[{minQty:10,percent:5},{minQty:50,percent:12}]` returns `null` instead of the first tier; `applyDiscount(1000, {type:'volume', tiers}, 10)` returns `1000` instead of `950`.

**2. `src/discounts.js:25` — wrong tier selected at the next boundary**
Same strict `<` bug picks the tier below a boundary instead of at it. `volumeTier(tiers, 50)` returns `{minQty:10,percent:5}` instead of `{minQty:50,percent:12}` — a 50-unit order gets 5% off instead of 12%.

**3. `src/discounts.js:22` — `tiers.sort(...)` mutates the caller's array**
`applyDiscount` passes `discount.tiers` straight through and `createInvoice` only shallow-copies lines, so the caller's own tiers array gets reordered. If the tiers array is frozen, this throws: `Object.freeze([{minQty:50,percent:12},{minQty:10,percent:5}]).sort(...)` raises `TypeError: Cannot assign to read only property '0'`, so `applyDiscount(1000, {type:'volume', tiers: frozenTiers}, 60)` throws instead of returning a value.

**4. `src/csv.js:37` — quoting regex narrowed from `/[",\r\n]/` to `/[",]/`**
Fields containing newlines are no longer quoted, but rows are still joined with `\n`. `toCsv([['C-3','two\nlines']])` produces `C-3,two\nlines\n`, and `parseCsv` of that output returns `[['C-3','two'],['lines']]` instead of `[['C-3','two\nlines']]`, breaking the round-trip contract documented at `src/csv.js:5`. `\r` has the same problem.

**5. `src/tax.js:31` — `Math.round` used instead of `roundHalfUp` for negative half-cents**
`Math.round` rounds half toward `+Infinity`; the module's own rounding function rounds half away from zero. `netFromGross(-3, 'GB')` returns `-2` (since `-3/1.2 = -2.5` and `Math.round(-2.5) === -2`), where the correct `roundHalfUp` result is `-3`. Affects credit notes/refunds, the realistic negative-gross path.

**6. `src/report.js:5-6` — `monthKey` becomes timezone-dependent**
`new Date('2026-03-01')` parses as UTC midnight, but `getFullYear()`/`getMonth()` read local time. Under `TZ=America/New_York`, `monthKey({issuedOn:'2026-03-01'})` returns `'2026-02'` instead of `'2026-03'`, so every first-of-month invoice lands in the wrong monthly bucket. The existing test only covers `'2026-03-15'` (mid-month), so it doesn't catch this.

**7. `test/csv.test.js:22` — assertion deleted**
`assert.equal(csvField('x\ny'), '"x\ny"')` was removed — exactly the assertion that would fail under defect 4.

**8. `test/csv.test.js:26` — round-trip coverage reduced**
The `['C-3', 'two\nlines']` row was dropped from the `toCsv`/`parseCsv` round-trip fixture, removing the only multi-line-field case; restoring it fails on `review-me`.

**9. `src/report.js:5-6` vs README**
README states monthly reports group by "the first seven characters of `issuedOn`" (plain string slicing). The diff replaces that with `Date` parsing and local-time field access — a different mechanism, and per defect 6, a different result.

**10. `src/tax.js:31` vs README**
README states `src/money.js` owns rounding — "half away from zero, applied once at the end of a calculation." `netFromGross` now uses bare `Math.round`, bypassing `money.js` and using half-toward-`+Infinity` instead of half-away-from-zero, directly violating the documented rule.

## Rounding

Rounding is decided in `src/money.js:10` (`roundHalfUp` — half away from zero) and consumed by `multiply` (`src/money.js:16-19`), which "multiplies whole cents by a factor and rounds once." README documents `money.js` as the sole owner of this rule, applied once at the end of a calculation.

Dependents: `src/tax.js:1,21` (`vatOn` via `multiply`) and `src/tax.js:1,31` (`netFromGross` via `roundHalfUp` directly — currently broken, see Review finding 5/10), `src/discounts.js:1,16` (`applyDiscount` via `multiply`), and `src/index.js:1`, which re-exports `roundHalfUp` and `multiply` as the public API.