**Canonical decision:** `src/money.js:10-13` — `roundHalfUp` rounds half *away from zero* (the negative branch flips `Math.round`'s toward-+∞ bias). Precision is whole cents, hardcoded as the literal `100` at `src/money.js:34` and `src/money.js:42`; there's no precision constant or config key. `multiply()` at `src/money.js:16-20` is the wrapper business code goes through.

**Dependents:** `src/tax.js:21` (`vatOn`) and `src/discounts.js:16` (`percentOff`) call `multiply`; `src/invoice.js:46-47` calls `vatOn`/`sum`; `src/report.js:16,34` builds on `invoiceTotals`/`lineNet`. `src/csv.js:64` depends on `fromDecimal` only. `src/index.js:1` re-exports the primitive publicly.

**Divergences:**
- `src/money.js:56` — `allocate()` truncates toward zero with largest-remainder redistribution, deliberately not using `roundHalfUp`.
- `src/tax.js:31` — `netFromGross` calls `roundHalfUp` directly on a division, bypassing `multiply`; makes it non-inverse with `grossFromNet`.
- `src/money.js:31` — `fromDecimal` throws on 3+ decimals rather than rounding.
- `src/report.js:19-21` — sums already-rounded per-invoice VAT, so monthly VAT ≠ `vatOn(monthlyNet)`.