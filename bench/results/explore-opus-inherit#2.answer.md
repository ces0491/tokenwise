**Decision point:** `src/money.js:10-13` — `roundHalfUp` uses half-away-from-zero via `value < 0 ? -Math.round(-value) : Math.round(value)`. Money is integer cents (`cents()`, `src/money.js:4-7`). Precision is not a constant: `2` is hardcoded in the parse regex `src/money.js:31` and the `100` scale factor at `:34`/`:42`, so a 0- or 3-decimal currency can't be added without editing this file.

Two other policies live alongside it: `allocate()` uses floor + largest-remainder (`src/money.js:56-65`) to preserve sums, and `fromDecimal` rejects >2 decimals rather than rounding (`:31`).

**Direct dependents:** `src/tax.js:21,31` (`vatOn`, `netFromGross` — the only external `roundHalfUp` caller), `src/discounts.js:16` (`percentOff`), and `src/index.js:1`, which re-exports it as public API.

**Transitive:** `src/invoice.js:40-48`, `src/report.js:16-21,34`, `src/csv.js:64`.

No module bypasses it — the only rounding operators in the tree are inside `money.js`. But `README.md:11` claims rounding is "applied once at the end"; `src/discounts.js:51-54` rounds per discount in a loop, making stacked discounts order-dependent — pinned as intended by `test/discounts.test.js:31-35`.