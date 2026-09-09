**Decision point:** `src/money.js:10-13` — `roundHalfUp()` implements half-away-from-zero on integer cents:

```js
return value < 0 ? -Math.round(-value) : Math.round(value);
```

It's the only `Math.round` on money in the repo. `multiply()` wraps it, so most consumers inherit the policy indirectly rather than calling it.

**Dependents:**
- `src/tax.js:21` — `vatOn()` via `multiply()`; `src/tax.js:31` — `netFromGross()` calls `roundHalfUp` directly
- `src/discounts.js:16` — `percentOff()` via `multiply()`
- `src/invoice.js:41` — `lineNet()` → discounts; `src/invoice.js:47` — `invoiceTotals()` → `vatOn()`
- `src/index.js:1` — re-exports `roundHalfUp`/`multiply` as public API
- `src/csv.js:64` — uses `fromDecimal()` for parsing only, no rounding

**Second policy:** `src/money.js:56` — `allocate()` floors toward zero, then distributes remainders by largest-remainder (lines 57-65). Deliberate, but it means changing `roundHalfUp` won't change split behaviour.

No `toFixed`, banker's rounding, or local reimplementations found.