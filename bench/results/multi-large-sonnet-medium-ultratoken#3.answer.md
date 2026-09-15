Confirmed: no lines were removed from existing test files, only additions. All checks pass. Main is checked out.

## Implement

Added `src/creditnote.js` with `createCreditNote`, exported it from `src/index.js`, and updated `invoiceTotals` (src/invoice.js) and `topSkus` (src/report.js) to handle credit notes per the spec's validation order, rounding rule, and negative-total conventions. Added `test/creditnote.test.js` plus new (non-destructive) test cases in `test/invoice.test.js` and `test/report.test.js`; `npm test` passes 41/41 with no existing test altered.

## Review

**1. `src/discounts.js:22` — volume-tier selection picks the wrong tier**
`if (tier.minQty < qty)` should be `<=`, and combined with ascending sort the loop keeps the *lowest* applicable tier instead of the highest, contradicting the documented "highest tier whose minQty is less than or equal to the quantity."
`volumeTier([{minQty:50,percent:12},{minQty:10,percent:5}], 10)` → `null` (main: `{minQty:10,percent:5}`). `volumeTier([{minQty:50,percent:12},{minQty:10,percent:5}], 50)` → `{minQty:10,percent:5}` (main: `{minQty:50,percent:12}`) — a 50-unit line gets 5% instead of 12%, a 10-unit line gets no discount.

**2. `src/discounts.js:21` — `tiers.sort(...)` mutates the caller's array**
In-place sort reorders a tier array the caller owns (e.g. a shared/frozen config). Passing a frozen tiers array throws `TypeError` where main does not mutate it.

**3. `src/tax.js:31` — `Math.round` replaces `roundHalfUp`, wrong for negatives**
`Math.round(-2.5)` is `-2`, not half-away-from-zero, breaking the README rule that `src/money.js` owns rounding.
`netFromGross(-3, 'GB')` → `-2` (main: `-3`).

**4. `src/report.js:5-6` — `monthKey` uses `new Date` + local-time getters instead of slicing the string**
README requires grouping by the first seven characters of `issuedOn`. `'YYYY-MM-DD'` parses as UTC midnight then reads back in local time, shifting the month in negative-offset zones, and produces `'NaN-aN'` for unparseable dates instead of a plain slice.
`monthKey({issuedOn:'2024-03-01'})` → `'2024-02'` (main: `'2024-03'`) on a negative-UTC-offset machine.

**5. `src/csv.js:25` — `csvField` no longer quotes embedded line breaks, corrupting CSV**
`csvField('x\ny')` → `'x\ny'` unquoted (main: `'"x\ny"'`). Since `parseCsv` still treats quoted newlines as part of a field, round-tripping breaks: `parseCsv(toCsv([['a\nb','c']]))` → `[['a'],['b','c']]` instead of `[['a\nb','c']]`.

**6. `test/csv.test.js:22,27` — tests weakened to hide defect 5**
The assertion `assert.equal(csvField('x\ny'), '"x\ny"')` was deleted, and the `'two\nlines'` row was removed from the `toCsv` round-trip fixture; both would fail against review-me's `csvField`.

## Rounding

Rounding is decided in `src/money.js:10` (`roundHalfUp`, half-away-from-zero) and applied via `multiply` (`src/money.js:19`, one rounding pass per calculation) and `allocate` (`src/money.js:50-67`, largest-remainder split, no extra rounding). README.md states this ownership explicitly ("`src/money.js` owns rounding … applied once at the end of a calculation"). Dependents: `src/discounts.js` (percent/fixed/tier discount amounts), `src/tax.js` (`vatOn`, gross/net conversion — and where `review-me` swapped in raw `Math.round`, defect 3 above), `src/invoice.js` (line and invoice totals), and the new `src/creditnote.js` (`netCents` scaling). `src/report.js` and `src/csv.js` consume already-rounded cent values and don't round independently.

---
Worker summary:
- Implement credit notes — ran `tokenwise:work-medium` / sonnet, no escalation, check passed (41/41 tests green, no existing test edited — verified independently).
- Review review-me — ran `tokenwise:work-low` / opus, no escalation, check passed (6 defects, each with file:line and a concrete failing input).