## Implement

Added `src/creditnote.js` with `createCreditNote`, wired into totals (`invoice.js`) and reports (`report.js`) per the spec, and exported it from `src/index.js`. Added `test/creditnote.test.js` covering validation order, non-mutation, whole/partial crediting with rounding, and the totals/monthlySummary/topSkus integration — all 38 tests pass (`npm test`).

## Review

**src/report.js:5-6 (`monthKey`)** — Rewritten to use `new Date(invoice.issuedOn)` plus `getFullYear()`/`getMonth()`, replacing the old `issuedOn.slice(0, 7)`. This breaks README's stated rule ("Monthly reports group by the first seven characters of `issuedOn`"): `Date` parses `YYYY-MM-DD` as UTC midnight but `getFullYear`/`getMonth` read it back in local time, so in any timezone west of UTC the day rolls back. Example: with the system in `America/Los_Angeles` (UTC-8), `monthKey({ issuedOn: '2026-01-01', ... })` returns `'2025-12'` instead of `'2026-01'`, silently moving invoices into the wrong monthly summary.

**src/tax.js:30-32 (`netFromGross`)** — Changed from `roundHalfUp(...)` (imported from `money.js`) to plain `Math.round(...)`, duplicating rounding logic outside `money.js` and breaking README's rule that "`src/money.js` owns rounding: half away from zero". `Math.round` doesn't round negative halves away from zero. Example: `netFromGross(-3, 'GB')` — `vatRate('GB')` is `0.2`, so `-3 / 1.2 = -2.5`; old code (`roundHalfUp`) returns `-3`, new code returns `-2` (`Math.round(-2.5) === -2` in JS).

**src/discounts.js:20-26 (`volumeTier`)** — Comparison changed from `tier.minQty <= qty` to `tier.minQty < qty`, which contradicts the function's own doc comment ("applies the highest tier whose `minQty` is less than or equal to the quantity") and silently changes discount behavior at exact boundaries. Example: `volumeTier([{ minQty: 10, percent: 5 }], 10)` now returns `null` instead of the tier — a customer ordering exactly the threshold quantity no longer gets the volume discount. The function also now mutates its input via `tiers.sort(...)`, reordering the caller's array as a side effect (e.g. `discount.tiers` on a shared discount object).

**src/csv.js:34-37 (`csvField`) + test/csv.test.js:22 (weakened test)** — The quoting regex dropped `\r\n`, so fields containing a line break are no longer quoted, and the corresponding round-trip assertions (`csvField('x\ny')`, and the `'two\nlines'` row in the `toCsv`/`parseCsv` round-trip test) were deleted rather than fixed. Example: `csvField('two\nlines')` now returns `'two\nlines'` unquoted; serializing that into a CSV row via `toCsv` produces a bare embedded newline that `parseCsv` will read back as an extra row, breaking the round trip README doesn't explicitly promise but the removed test existed specifically to guard.

## Rounding

Monetary rounding is decided in `src/money.js`: `roundHalfUp` (money.js:10-13) implements "half away from zero," and `multiply` (money.js:16-20) applies it once when scaling cents by a factor. `allocate` (money.js:50-67) uses a separate floor + largest-remainder method, not `roundHalfUp`, to split a total into whole-cent parts that sum exactly.

Dependents: `tax.js` (`vatOn` via `multiply`, `netFromGross` via `roundHalfUp` directly) and `discounts.js` (`percentOff` via `multiply`), which feed `invoice.js` (`lineNet`, `invoiceTotals`) and now `creditnote.js` (`createCreditNote`'s proportional `netCents`, via `multiply`).