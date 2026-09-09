Rounding is decided in one place: `src/money.js`.

- `src/money.js:10-13` — `roundHalfUp(value)`: half away from zero, via `Math.round` with sign handling. This is the codebase-wide policy.
- `src/money.js:16-20` — `multiply(amount, factor)`: the only rounding entry point most callers touch, applying `roundHalfUp` after multiplication.
- `src/money.js:50-67` — `allocate(total, ratios)` deliberately opts out, using largest-remainder with `Math.floor` (lines 56, 59) so split cents sum exactly. Nothing currently imports it.

Dependents:

- `src/tax.js:1,21,31` — `vatOn` via `multiply`; `netFromGross` calls `roundHalfUp` directly.
- `src/discounts.js:1,16` — `percentOff` via `multiply`.
- `src/invoice.js:1-3,40-47` — `lineNet` and `invoiceTotals`, through `applyDiscounts`, `vatOn`, `sum`.
- `src/report.js:1,16,34` — `monthlySummary`, `topSkus`, through `invoiceTotals`/`lineNet`.
- `src/csv.js:1,64` — `fromDecimal` for parsing (no rounding; rejects >2 decimals).

No ad-hoc `toFixed`/`Math.round` outside `money.js`. Changing `roundHalfUp` changes tax, discounts, invoices and reports together.