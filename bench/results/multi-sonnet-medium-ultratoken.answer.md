Both jobs confirmed green: 29/29 tests pass, only `src/invoice.js` modified, `main` checked out.

## Fix

`invoiceTotals` in src/invoice.js summed VAT computed separately per line instead of rounding once on the combined net total, breaking the codebase's "round once" convention. Fixed by computing VAT once on the summed net (`vatOn(net, invoice.region)`) instead of summing per-line VAT.

## Review

**src/csv.js:37** — `csvField` no longer quotes fields containing `\r` or `\n`, so a value with a line break is emitted as a bare newline and `toCsv` output no longer round-trips through `parseCsv`.
Scenario: `toCsv([['sku','description'],['C-3','two\nlines']])` produces `sku,description\nC-3,two\nlines\n`, which `parseCsv` reads back as three rows (`['C-3','two']`, `['lines']`) instead of two, and the second column is lost.

**src/discounts.js:25** — The tier test changed from `tier.minQty <= qty` to `tier.minQty < qty`, so a quantity exactly equal to a tier's threshold no longer qualifies for that tier.
Scenario: `volumeTier([{minQty: 10, percent: 5}], 10)` returns `null` (previously returned the tier); with `[{minQty:1},{minQty:10}]` and `qty=10` it returns the `minQty:1` tier instead of `minQty:10`.

**src/discounts.js:22** — `tiers.sort(...)` mutates the caller's array in place; a shared/frozen tier table passed by a consumer is reordered as a side effect, and a frozen array throws.
Scenario: `const TIERS = Object.freeze([{minQty:10},{minQty:1}]); volumeTier(TIERS, 20)` throws `TypeError: Cannot assign to read only property '0'` in strict mode.

**src/tax.js:30** — `roundHalfUp` was replaced with `Math.round`, which rounds half toward +Infinity rather than half away from zero, so negative amounts (credit notes, refunds) round the wrong way; also violates the README rule that src/money.js owns rounding, half away from zero.
Scenario: `netFromGross(-3, 'GB')` = `Math.round(-3/1.2)` = `Math.round(-2.5)` = `-2`, where the documented behavior gives `-3`.

**src/report.js:5-6** — `monthKey` now parses the date string with `new Date()` (UTC midnight) and reads it back with local-time getters, shifting the month in any timezone west of UTC; README specifies the first seven characters of `issuedOn`.
Scenario: `monthKey({issuedOn: '2024-03-01'})` under `TZ=America/New_York` returns `'2024-02'` instead of `'2024-03'`, misgrouping March invoices into February.

**test/csv.test.js:22 (deleted line)** — The assertion `assert.equal(csvField('x\ny'), '"x\ny"')` was removed — exactly the assertion that would catch the csv.js:37 regression.

**test/csv.test.js:26** — The round-trip test case dropped the `['C-3','two\nlines']` row, removing the only multi-line-field coverage and letting the broken `toCsv`/`parseCsv` round trip pass.

## Rounding

Rounding policy is centralized in `src/money.js:10` (`roundHalfUp`, half away from zero) and used by `multiply()` at `src/money.js:19`, which is documented (`src/money.js:15`) to round once. Consumers: `src/tax.js:1` (imports `roundHalfUp`/`multiply` for VAT math), `src/discounts.js:1` (`multiply` for discount amounts), `src/invoice.js` (via `sum`/`cents`, and now the fixed `vatOn` call), and `src/index.js:1` re-exports all of it as the public API. `src/csv.js` depends only on `fromDecimal`, not rounding.

---
Job routing:
1. Fix failing test — ran in-session research (rounding grep) plus `tokenwise:work-medium` on sonnet; no escalation; check passed (29/29, only src/invoice.js changed).
2. Review review-me diff — ran on `tokenwise:work-low` on opus; no escalation; check passed (every finding has file:line and a concrete failing input, working tree untouched, main still checked out).
3. Rounding question — kept in this session (quick grep lookup, a few tool calls).