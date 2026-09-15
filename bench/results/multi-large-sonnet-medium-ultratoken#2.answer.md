All 38 tests pass and no existing test file was modified (only `test/creditnote.test.js` was added). Branch is on `main`.

## Implement
Added `src/creditnote.js` with `createCreditNote`, and wired credit notes into `invoiceTotals` (src/invoice.js) and `topSkus` (src/report.js) so they carry negative net/vat/gross and subtract from SKU rankings, exporting the new function from `src/index.js`. 38/38 tests pass, including 9 new ones in `test/creditnote.test.js`, with no existing test file touched.

## Review

**1. `src/csv.js:34-37` — newlines no longer quoted**
`csvField` regex changed from `/[",\r\n]/` to `/[",]/`, so a field containing a line break is emitted raw and splits into two records.
Input: `toCsv([['C-3','two\nlines']])` yields `C-3,two\nlines\n`; `parseCsv` of that returns two rows (`['C-3','two']` and `['lines']`) instead of one. Round-trip is broken.

**2. `test/csv.test.js:22, 27` — tests weakened to hide defect 1**
The assertion `assert.equal(csvField('x\ny'), '"x\ny"')` was deleted, and the `'two\nlines'` row was removed from the round-trip fixture — exactly the cases that would fail under the `csv.js` change. Coverage for embedded newlines is now zero.

**3. `src/discounts.js:22` — boundary tier no longer applies**
`tier.minQty <= qty` became `tier.minQty < qty`, so a quantity exactly equal to a tier's threshold gets no tier.
Input: `volumeTier([{minQty: 10, pct: 5}], 10)` returns `null` (previously returned the tier). An order of exactly 10 units silently loses its discount.

**4. `src/discounts.js:21` — caller's array is mutated**
`tiers.sort(...)` sorts in place instead of on a copy. If the caller passes a frozen/shared tier table (e.g. a `VAT_RATES`-style frozen constant), `sort` throws `TypeError` under strict mode (ES modules).

**5. `src/tax.js:31` — rounding no longer half away from zero**
`roundHalfUp` was replaced with `Math.round`. README states `src/money.js` owns rounding as "half away from zero." `Math.round` rounds halves toward `+Infinity` instead.
Input: `Math.round(-0.5) === -0` vs `roundHalfUp(-0.5) === -1` — a negative (credit) amount landing on a half-cent rounds the wrong direction, off by one cent.

**6. `src/report.js:5-6` — month key is timezone-dependent**
`monthKey` now parses `issuedOn` with `new Date()` (UTC midnight for `YYYY-MM-DD`) but reads it back with local-time `getFullYear`/`getMonth`. README states monthly reports group by "the first seven characters of `issuedOn`."
Input: under `TZ=America/New_York`, `monthKey({issuedOn: '2024-03-01'})` returns `'2024-02'` — every first-of-month invoice attributed to the wrong month.

## Rounding
Monetary rounding is decided in one place: `roundHalfUp` in `src/money.js:9-13` (half away from zero), used by `multiply` (`src/money.js:16-20`, which rounds once per operation) and by `allocate` (`src/money.js:50-67`, largest-remainder split that always sums exactly to the total).

Dependents: `src/tax.js:1` (imports `roundHalfUp`, `multiply`) for VAT calculations; `src/discounts.js:1` (imports `multiply`) for discount amounts; `src/invoice.js:1` (imports `sum`) for invoice totals; `src/csv.js:1` (imports `fromDecimal`) for parsing decimal amounts; `src/index.js:1` re-exports the whole `money.js` surface as the public API.

- Job 1 (implement): ran on `tokenwise:work-medium` / sonnet, no escalation, check passed — 38/38 tests, no existing test files changed.
- Job 2 (review): ran on `tokenwise:work-low` / opus, no escalation, check passed — all 6 findings carry file:line and a concrete failing input.
- Job 3 (rounding): handled directly in this session (quick lookup, few tool calls).

Repo is left on `main`.