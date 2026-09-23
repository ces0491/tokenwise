Good — main is checked out, with the fix to `src/invoice.js` in place (uncommitted, as expected; not asked to commit).

## Fix

`invoiceTotals` in `src/invoice.js` computed VAT per line and summed the results, so each line's fractional cent got rounded up independently (e.g. three 20%-VAT lines of 3 cents each round to 1 cent VAT apiece = 3 total). README requires VAT to be calculated once on the invoice net total. Changed it to call `vatOn(net, invoice.region)` on the summed net instead of summing per-line VAT.

## Review

**src/csv.js:35-38** — `csvField` only quotes commas and quotes, no longer newlines. A field containing `\n` is written unquoted into the CSV stream, so `toCsv([['sku','description'],['C-3','two\nlines']])` embeds a raw line break that `parseCsv` reads back as an extra row instead of one field — round-trip corrupts the data. The test that caught this (`csvField('x\ny')` and the `'C-3'/'two\nlines'` row in the round-trip test) was deleted in the same commit, hiding the regression.

**src/discounts.js:20-27** — `volumeTier` now uses `tier.minQty < qty` instead of `<=`. The module's own docstring and `applyDiscount`'s contract say the highest tier whose `minQty` is *less than or equal to* the quantity applies. Input `volumeTier([{minQty: 10, percent: 5}], 10)` now returns `null` instead of the tier, so a line with qty exactly at a tier boundary gets no discount. The added `tiers.sort(...)` also mutates the caller's array in place as a side effect. No existing test exercises the exact-boundary case, so this passes `npm test`.

**src/report.js:4-7** — `monthKey` now parses `issuedOn` with `new Date(...)` and reads `getFullYear()`/`getMonth()`, which use the host's local timezone, instead of README's documented rule ("group by the first seven characters of `issuedOn`"). In any timezone west of UTC, `monthKey({ issuedOn: '2026-03-01' })` returns `'2026-02'` instead of `'2026-03'` (verified: `2026-03-01T00:00:00Z` renders as `02/28/2026` in `America/New_York`). Invoices near a month boundary land in the wrong monthly summary bucket depending on where the code runs.

**src/tax.js:1,30-31** — `netFromGross` replaced `roundHalfUp` (imported from `money.js`) with a bare `Math.round`, and dropped the `roundHalfUp` import entirely. README states `src/money.js` owns rounding, "half away from zero." `Math.round` rounds half-way values toward +Infinity, not away from zero, so they diverge on negative halves: `netFromGross(-3, 'GB')` is `-3` under `roundHalfUp` (away from zero) but `-2` under the new `Math.round` (verified: `Math.round(-2.5) === -2`).

## Rounding

Rounding is decided in `src/money.js:10-13` (`roundHalfUp`, half away from zero) and applied once by `multiply` (`src/money.js:16-20`). `src/tax.js:1,21,31` depends on it (`vatOn` via `multiply`, `netFromGross` via direct call). `src/discounts.js:1,12-17` depends on it via `multiply` in `percentOff`. `src/invoice.js` depends on it transitively through `lineNet`→`applyDiscounts` and `invoiceTotals`→`vatOn`. `src/index.js:1` re-exports `roundHalfUp` publicly. `src/csv.js:1` depends only on `fromDecimal`, not on rounding itself.