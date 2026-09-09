**Canonical decision:** `roundHalfUp` at `src/money.js:10-13` — `Math.round` with sign handling, so half-away-from-zero. Amounts are integer cents throughout, which fixes the scale at 2 decimals (validated by `cents`, `src/money.js:4`). `README.md:11` states the policy: applied once at the end of a calculation.

**Direct dependents:**
- `src/money.js:19` — `multiply` is the main funnel.
- `src/tax.js:31` — `netFromGross` calls it directly; `src/tax.js:21` — `vatOn` via `multiply`.
- `src/discounts.js:16` — `percentOff` via `multiply`, reaching `applyDiscount` (`src/discounts.js:29`) and `applyDiscounts` (`:51`).
- `src/invoice.js:39,45` — `lineNet` and `invoiceTotals` sit at the end of both chains.
- `src/index.js:1` re-exports it publicly.

**Independent of it:**
- `src/money.js:56-59` — `allocate` uses `Math.floor` plus largest-remainder distribution, deliberately not `roundHalfUp`, so splits sum exactly.
- `src/money.js:42` — `toDecimal` truncates for display.

`VAT_RATES` (`src/tax.js:4-9`) supplies the factors feeding these rounded multiplications.