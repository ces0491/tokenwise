**Decided in `src/money.js`** — one file, no config, no constants table.

- `src/money.js:10-13` — `roundHalfUp`: half **away from zero** (sign-reflected because JS `Math.round(-2.5) === -2`).
- `src/money.js:4-7` — `cents()` guard: precision is "whole integer cents", enforced by `TypeError` rather than configured.
- `src/money.js:16-20` — `multiply()` is the canonical wrapper (round once); `README.md:11` states the policy.

**Depends on it:**

- `src/tax.js:21` (`vatOn` → `multiply`) and `src/tax.js:31` (`netFromGross` calls `roundHalfUp` **directly**, the one path bypassing `multiply`)
- `src/discounts.js:16` (`percentOff` → `multiply`)
- `src/invoice.js:40-48` — via tax + discounts; VAT once on the net total
- `src/csv.js:64` — `fromDecimal` on ingest
- `src/report.js:18-34` — transitive only, accumulates already-rounded integers
- `src/index.js:1` — re-exports `roundHalfUp`, so it's public API

**Divergences:** `src/money.js:56` `allocate` truncates + largest-remainder (a second policy, and unused in `src/`); `src/discounts.js:51-54` rounds per discount, making chains order-dependent (`test/discounts.test.js:32-33`); the factor `100` is hardcoded at `money.js:31,34,42` with no currency-precision table.