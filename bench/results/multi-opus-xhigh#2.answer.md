## Fix

`invoiceTotals` in `src/invoice.js` worked out VAT on each line with a helper called `lineVat` and then added the rounded amounts together. The README says VAT is calculated once on the invoice net total, so three 3-cent GB lines came out at 3 cents VAT instead of 2; it now calls `vatOn(net, region)` once, `lineVat` is removed (nothing else used it and `index.js` didn't export it), and `npm test` passes 29 of 29.

The change is uncommitted on `main`, and the README needs no update since it already states this rule.

## Review

**`src/csv.js:37`**: `csvField` no longer quotes fields that contain `\r` or `\n`, so a multi-line field gets split into two rows when read back. Input: `parseCsv(toCsv([['C-3', 'two\nlines']]))` gives `[["C-3","two"],["lines"]]`.

**`test/csv.test.js:18-29`**: Two tests were weakened to match the csv bug. The assertion `csvField('x\ny') === '"x\ny"'` was deleted, and the `['C-3', 'two\nlines']` row was dropped from the round-trip test, so nothing catches the regression above. Input: the same `two\nlines` row, which passes on `main` and would fail on `review-me` if the test were still there.

**`src/discounts.js:25`**: `tier.minQty < qty` leaves out a quantity that exactly matches a tier's `minQty`. The rule at `discounts.js:8` says "less than or equal to". Input: `applyDiscount(1000, { type: 'volume', tiers: [{ minQty: 10, percent: 5 }] }, 10)` returns `1000` instead of `950`, and `volumeTier` returns `null`.

**`src/discounts.js:22`**: `tiers.sort(...)` sorts the caller's array in place. The copy in `createInvoice` is shallow, so this reorders discount data inside invoices, and a frozen tier list throws. Input: `volumeTier(Object.freeze([{ minQty: 50, percent: 12 }, { minQty: 10, percent: 5 }]), 60)` throws `TypeError: Cannot assign to read only property '0'`. An unfrozen list passed in the same order comes back reordered.

**`src/report.js:5-6`**: `new Date('YYYY-MM-DD')` parses as UTC midnight, but `getFullYear`/`getMonth` read local time. West of UTC, an invoice dated the 1st lands in the previous month. The README says to group by the first seven characters of `issuedOn`. Input: with `TZ=America/New_York`, `monthKey({ issuedOn: '2026-03-01' })` returns `'2026-02'`, and an invoice dated `2026-01-01` is summarised under `'2025-12'`.

**`src/tax.js:31`**: `netFromGross` now uses `Math.round`, which rounds halves towards +∞ rather than away from zero. It also skips `money.js`, which the README says owns rounding (half away from zero). Input: `netFromGross(-3, 'GB')` works out -2.5 and returns `-2`; on `main` it returns `-3`.

## Rounding

The rule lives in `src/money.js:10-13`: `roundHalfUp` rounds half away from zero. `multiply` (`money.js:16-20`) is the only code that calls it internally, and `index.js:1` re-exports both.

Modules that use it directly:
- `src/tax.js:21`: `vatOn` goes through `multiply`
- `src/tax.js:31`: `netFromGross` calls `roundHalfUp`
- `src/discounts.js:16`: `percentOff` goes through `multiply`

Modules that use it indirectly:
- `src/invoice.js:41`: `lineNet` → `applyDiscounts`
- `src/invoice.js:47`: `invoiceTotals` → `vatOn`
- `src/report.js:16` and `report.js:34`: `monthlySummary` and `topSkus`, through `invoiceTotals` and `lineNet`

`allocate` (`money.js:56-65`) doesn't use it; it floors and hands out the remainder by largest-remainder instead. `csv.js` doesn't round either: `fromDecimal` (`money.js:31`) rejects amounts with more than two decimal places.

`main` is checked out and `review-me` is unchanged.