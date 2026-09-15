## Fix

`invoiceTotals` in `src/invoice.js` computed VAT per line and summed the results, but README.md line 12 requires VAT to be calculated once on the invoice net total. Rounding VAT separately per line (e.g. three lines of 3 cents each at 20% GB VAT) accumulates rounding error, giving 3 instead of 2; fixed by computing `vatOn(net, invoice.region)` once and removing the now-unused `lineVat` helper.

## Review

**src/tax.js:30-32 — `netFromGross`**
Rounding no longer goes through `money.js`. It was `roundHalfUp(cents(grossCents) / (1 + vatRate(region)))`; now it's raw `Math.round(...)`, dropping the `roundHalfUp` import. This breaks README's rule that `src/money.js` owns rounding, "half away from zero" (README line 11), because `Math.round` rounds half-values toward +Infinity, not away from zero. Concrete input: `netFromGross(-3, 'GB')` → `-3 / 1.2 = -2.5`. Old: `roundHalfUp(-2.5) = -3`. New: `Math.round(-2.5) = -2`.

**src/discounts.js:20-26 — `volumeTier`**
Boundary changed from `tier.minQty <= qty` to `tier.minQty < qty`, so a tier no longer applies when `qty` exactly equals its `minQty`. This contradicts the module's own doc comment on line 8, left unchanged: "applies the highest tier whose minQty is less than or equal to the quantity." Concrete input: `volumeTier([{ minQty: 10, percent: 5 }], 10)` → old: `{ minQty: 10, percent: 5 }`; new: `null`. Correspondingly `applyDiscount(1000, { type: 'volume', tiers: [{ minQty: 10, percent: 5 }] }, 10)` goes from `950` to `1000`.

**src/report.js:4-6 — `monthKey`**
Replaced `invoice.issuedOn.slice(0, 7)` with `new Date(issuedOn)` plus local-timezone `getFullYear()`/`getMonth()`. This breaks README line 14 ("Monthly reports group by the first seven characters of `issuedOn`"), because date-only ISO strings parse as UTC midnight while `getFullYear`/`getMonth` read local time, so the result depends on the host timezone. Concrete input: `monthKey({ issuedOn: '2026-03-01' })` run on a host in a UTC-5 zone (e.g. `America/New_York`) evaluates local time as `2026-02-28 19:00`, returning `'2026-02'` instead of `'2026-03'`.

**src/csv.js:34-37 and test/csv.test.js:19-27 — `csvField`**
The quoting regex was narrowed from `/[",\r\n]/` to `/[",]/`, so fields containing newlines are no longer quoted. `parseCsv` (unchanged) treats bare `\n`/`\r` as row separators, so this breaks CSV round-tripping — contradicting `parseCsv`'s own docstring on line 5 ("commas and newlines inside quotes"). The corresponding test assertions (`csvField('x\ny')` and the `'two\nlines'` round-trip case) were deleted rather than updated, hiding the regression. Concrete input: `toCsv([['sku', 'description'], ['A-1', 'two\nlines']])` now emits `A-1,two\nlines` unquoted; `parseCsv` of that output produces 3 rows instead of 2, splitting the field's content into a spurious extra row.

## Rounding

Rounding is owned by `roundHalfUp` in `src/money.js:10-13` (half away from zero), used internally by `multiply` (`src/money.js:16-20`). Direct dependents:

- `src/tax.js:21` — `vatOn` calls `multiply`
- `src/tax.js:31` — `netFromGross` calls `roundHalfUp` directly
- `src/discounts.js:16` — `percentOff` calls `multiply` (used by percent/volume discounts)
- `src/invoice.js` — totals derive from these via `lineNet`/`vatOn`, without rounding independently
- `src/index.js:1` — re-exports `roundHalfUp`/`multiply` publicly

`allocate` (`src/money.js:50-67`) does its own floor/largest-remainder split, not `roundHalfUp`, by design (exact-sum requirement).