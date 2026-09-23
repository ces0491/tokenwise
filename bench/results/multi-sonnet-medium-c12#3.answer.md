That modified file is the intended fix, main is checked out. Done.

## Fix
`invoiceTotals` in `src/invoice.js` computed VAT per line and summed the results, but the README requires VAT to be calculated once on the invoice net total. Per-line rounding on three 3-cent lines at 20% VAT (GB) produced 1+1+1=3 instead of round(9×0.20)=2, so I removed `lineVat` and made `invoiceTotals` call `vatOn(net, invoice.region)` directly; `npm test` now passes 29/29.

## Review

**src/tax.js:31, `netFromGross`** — Rounding changed from `roundHalfUp` to plain `Math.round`, which rounds half-cent ties toward +Infinity instead of away from zero, contradicting README's "half away from zero, applied once." `netFromGross(-3, 'GB')` returns `-2` on `review-me` vs `-3` on `main` (gross −3 cents at 20% VAT gives net exactly −2.5, which away-from-zero rounds to −3).

**src/discounts.js:20-25, `volumeTier`** — Changed the boundary test from `tier.minQty <= qty` to `tier.minQty < qty`, so a tier no longer applies when quantity exactly equals its `minQty`, contradicting the module's own docstring ("less than or equal to the quantity") and README's discount rules. `volumeTier([{minQty:10,percent:5},{minQty:50,percent:12}], 10)` returns `null` instead of the 5% tier. The function also now mutates the caller's `tiers` array in place via `.sort()`.

**src/csv.js:34-37, `csvField`** — Quoting regex narrowed from `/[",\r\n]/` to `/[",]/`, so fields containing a line break are no longer quoted, corrupting round-trip CSV structure. `csvField('a\nb')` returns the bare string `a\nb`; serializing rows `[['x','a\nb'],['y','z']]` with `toCsv` and reparsing with `parseCsv` yields `[["x","a"],["b"],["y","z"]]` instead of the original two rows.

**test/csv.test.js:22, weakened test** — The `csvField('x\ny')` assertion and the `'two\nlines'` row were deleted from the round-trip test, removing the only coverage that would have caught the `csvField` regression above.

**src/report.js:4-7, `monthKey`** — Changed from a string slice of `issuedOn` to `new Date(issuedOn).getFullYear()`/`getMonth()`, which uses the local timezone against a UTC-parsed date. In any timezone behind UTC (e.g. America/New_York, UTC−5), `monthKey({issuedOn: '2026-03-01'})` returns `'2026-02'` instead of `'2026-03'`, misgrouping invoices issued on the first days of a month in `monthlySummary`.

## Rounding
Rounding is decided in `src/money.js:10-13` (`roundHalfUp`: half away from zero) and applied once via `multiply` (`src/money.js:16-20`). `src/tax.js` depends on it: `vatOn` (line 21) calls `multiply`, and `netFromGross` (line 31) calls `roundHalfUp` directly. `src/discounts.js` depends on it via `percentOff` (line 15) calling `multiply`. `src/invoice.js` depends on it transitively through `lineNet`→`applyDiscounts` and `invoiceTotals`→`vatOn`. `src/index.js:1` re-exports `roundHalfUp` and `multiply` as the public API surface for this decision.