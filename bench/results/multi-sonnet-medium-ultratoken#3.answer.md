All checks pass — tests green, only src/ touched, review findings all carry file:line and a failing input, main is checked out.

## Fix

`invoiceTotals` in `src/invoice.js` computed VAT per line and summed the rounded results, over-rounding when a rate produces fractional cents per line. The fix computes VAT once on the summed net total (`src/invoice.js:51`, `vat = vatOn(net, invoice.region)`), matching how `vatOn`/`netFromGross` round once elsewhere. `npm test` now passes 29/29, and only `src/invoice.js` was modified.

## Review

**1. `src/discounts.js:25` — off-by-one, tier no longer applies at its own `minQty`**
`tier.minQty < qty` should be `<=`. A tier is meant to apply once quantity reaches `minQty`.
Input: `volumeTier([{minQty:10,percent:5},{minQty:50,percent:12}], 10)` returns `null` on review-me vs. `{minQty:10,...}` on main; `qty:50` wrongly returns the 10-tier instead of the 50-tier.

**2. `src/discounts.js:22` — mutates the caller's array**
`tiers.sort(...)` sorts in place instead of a copy. Input: `const t=[{minQty:50},{minQty:10}]; volumeTier(t,100);` leaves `t` reordered as a side effect on the caller's own config array.

**3. `src/report.js:5-6` — timezone-dependent month key, contradicts README**
README states monthly reports group by the first seven characters of `issuedOn`. `new Date('2024-03-01')` parses as UTC midnight but `getFullYear`/`getMonth` read local time. Under `TZ=America/New_York`, `monthKey({issuedOn:'2024-03-01'})` returns `"2024-02"` instead of `"2024-03"`, moving every first-of-month invoice into the wrong month's summary.

**4. `src/tax.js:30` — `Math.round` breaks the documented "half away from zero" rule for negatives**
README specifies rounding is half away from zero, but `netFromGross` uses `Math.round` directly instead of `roundHalfUp`. Input: `netFromGross(-3, 'GB')` → `-3/1.2 = -2.5` → `Math.round` gives `-2`, but the documented rule (and `roundHalfUp`) requires `-3`. Affects credit notes/refunds.

**5. `src/csv.js:37` plus `test/csv.test.js` — newline no longer quoted, and the covering test was deleted**
The quoting regex `/[",]/` dropped `\r\n`, so a field containing a line break is emitted unquoted and splits into two rows on parse. Input: `toCsv([['C-3','two\nlines']])` produces `C-3,two\nlines\n`, and `parseCsv` of that output yields `[['C-3','two'],['lines']]` instead of round-tripping. The `'two\nlines'` fixture row and the `csvField('x\ny')` assertion were removed from `test/csv.test.js` to hide the failure — a real behavior regression paired with a weakened test.

(Noted, not a defect: `src/money.js`'s `sign` helper refactor and the `sign`→`negative` rename in `fromDecimal` are behavior-preserving.)

## Rounding

Monetary rounding is decided in `src/money.js:9-13` (`roundHalfUp`, half-away-from-zero on fractional cents) and applied once inside `multiply` (`src/money.js:16-20`) and `allocate` (`src/money.js:50-67`, largest-remainder method for exact splits).

Dependents: `src/tax.js` (`vatOn`, `netFromGross`) and `src/discounts.js` (`percentOff`, via `multiply`) both rely on `roundHalfUp` for their single, documented rounding pass. `src/invoice.js` (`invoiceTotals`, after today's fix) depends on `vatOn` rounding VAT exactly once on the summed net, not per line.

---
- Job 1 (fix): ran on sonnet/medium, no escalation, check passed — `npm test` 29/29, only `src/invoice.js` changed.
- Job 2 (review): ran on opus/low, no escalation, check passed — 5 findings, each with file:line and a concrete failing input.
- Job 3 (rounding): kept in-session (quick grep/read), answered above.