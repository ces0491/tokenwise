Good — no test/ files modified, only new ones added. Main is checked out with these changes in the working tree (uncommitted, since no commit was requested).

## Implement

Added `src/creditnote.js` with `createCreditNote({ id, invoice, issuedOn, lines, reason })`, which builds a frozen credit note (full or partial, line quantities scaled with `roundHalfUp`, no re-discounting) as a negative-valued document. Extended `invoiceTotals` (`src/invoice.js`), `monthlySummary` and `topSkus` (`src/report.js`) to handle credit notes by their own `issuedOn` and sign, exported `createCreditNote` from `src/index.js`, and added `test/creditnote.test.js` (9 new tests) — all 38 tests pass and no existing test file was modified.

## Review

**1. `src/discounts.js` line 24 (`if (tier.minQty < qty) best = tier;`)**
Off-by-one: the original used `tier.minQty <= qty`. A tier now fails to apply when quantity exactly equals its threshold.
Scenario: `applyDiscount(10000, { type: 'volume', tiers: [{ minQty: 10, percent: 10 }] }, 10)`. On main, the tier applies and returns `9000`. On the branch, `10 < 10` is false, `best` stays `null`, and it returns `10000` — no discount at the exact tier boundary.

**2. `src/discounts.js` line 22 (`tiers.sort(...)`)**
`sort` mutates the caller's array in place. `applyDiscount` passes `discount.tiers` directly, so calling `applyDiscount` on a discount object reorders the tier array stored on that object. A caller holding `const d = { type:'volume', tiers:[{minQty:50,percent:20},{minQty:10,percent:10}] }` finds `d.tiers` permanently reordered after the call.

**3. `src/tax.js` line 31 (`Math.round(cents(grossCents) / (1 + vatRate(region)))`)**
`Math.round` rounds half toward `+Infinity`, not half away from zero, violating the README rule that `src/money.js` owns rounding half away from zero. The `roundHalfUp` import was dropped.
Scenario: `netFromGross(-3, 'GB')` → `-3 / 1.2 === -2.5` exactly; `Math.round(-2.5) === -2`, whereas `roundHalfUp(-2.5) === -3`. Off by one cent on any negative gross (credit note / refund) landing on a half cent.

**4. `src/report.js` lines 5-6 (`new Date(invoice.issuedOn)` + `getFullYear`/`getMonth`)**
`new Date('YYYY-MM-DD')` parses as UTC midnight, but `getFullYear`/`getMonth` read local time. In any timezone west of UTC the date shifts back a day, moving month-boundary invoices into the previous month. This also contradicts the README rule that monthly reports group by the first seven characters of `issuedOn`.
Scenario: with `TZ=America/New_York`, `monthKey({ issuedOn: '2024-03-01' })` returns `"2024-02"` instead of `"2024-03"`; every invoice issued on the 1st is grouped into the wrong month.

**5. `src/csv.js` lines 34-37 (`/[",]/` instead of `/[",\r\n]/`)**
Fields containing `\r` or `\n` are no longer quoted, so the embedded newline is emitted raw and breaks the record into two rows — `toCsv` no longer round-trips through `parseCsv`.
Scenario: `parseCsv(toCsv([['sku','description'],['C-3','two\nlines']]))` returns three rows (`['sku','description']`, `['C-3','two']`, `['lines']`) instead of the two rows put in.

**6. `test/csv.test.js` lines 22 and 26-27 — tests weakened**
The assertion `assert.equal(csvField('x\ny'), '"x\ny"')` was deleted, and the `['C-3', 'two\nlines']` row was removed from the round-trip fixture. Both removals exist solely to hide defect 5: restoring either line makes the suite fail on the branch.

## Rounding

Rounding is decided in `src/money.js:10-12` (`roundHalfUp`, half away from zero) and used by `multiply` (`src/money.js:19`), the single point every monetary computation must funnel through per the spec/README.

Dependents: `src/tax.js:1` (imports `multiply`, `roundHalfUp` for VAT), `src/discounts.js:1` (imports `multiply` for percentage discounts), `src/invoice.js:1` (imports `sum`/`cents`), `src/csv.js:1` (imports `fromDecimal`), and `src/index.js:1` (re-exports all of it as the public API). `allocate` (`src/money.js:50-67`) uses floor + largest-remainder rather than `roundHalfUp`.

---
- Implement: ran on `tokenwise:work-medium` (sonnet, medium) — no escalation; check passed (38/38 tests, no existing test file touched, main checked out).
- Review: ran on `tokenwise:work-low` (opus, low) — no escalation; check passed (6 defects, each with file:line and a concrete failing input).
- Rounding: handled in this session (quick grep/read lookup).