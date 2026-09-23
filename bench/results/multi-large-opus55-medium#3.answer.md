## Implement

I added `src/creditnote.js` with `createCreditNote`, which validates in the order the spec gives and computes each line's `netCents` as the original `lineNet` × qty / originalQty, rounded once with `roundHalfUp`. It returns a frozen note, `createCreditNote` is exported from `src/index.js`, `invoiceTotals`, `monthlySummary` and `topSkus` now handle `kind: 'credit'`, and `test/creditnote.test.js` covers it. `npm test` passes 37 of 37, and the README module table and rules now cover credit notes. Nothing is committed and `main` is checked out.

## Review

**`src/csv.js:37`**: `csvField` no longer quotes fields that contain `\r` or `\n`, so `toCsv` output with a multi-line field doesn't parse back. This breaks the documented round-trip. Input: `parseCsv(toCsv([['a', 'x\ny']]))` returns `[['a','x'],['y']]`.

**`test/csv.test.js:22` and `:26` (line numbers on main)**: The branch deletes the `csvField('x\ny')` assertion and the `'two\nlines'` round-trip row. That weakens the tests so the csv.js regression above passes unnoticed.

**`src/discounts.js:22`**: `tiers.sort(...)` sorts the caller's array in place, and it throws on a frozen array. Input: `volumeTier(Object.freeze([{minQty:50,percent:12},{minQty:10,percent:5}]), 20)` throws `TypeError`. With a plain array, the caller's tier order changes to `[10, 50]`.

**`src/discounts.js:25`**: `tier.minQty < qty` should be `<=`. The documented rule is "minQty is less than or equal to the quantity". Input: `volumeTier([{minQty:10, percent:5}], 10)` returns `null`, so a 10-unit line at 100c comes out at 1000 net where it should be 950.

**`src/tax.js:31`**: `Math.round` rounds a negative half toward +∞ where the rule is half away from zero. It also skips `money.js`, which the README says owns rounding. Input: `netFromGross(-3, 'GB')` gives `-2`; `roundHalfUp(-2.5)` gives `-3`.

**`src/report.js:5-6`**: `monthKey` parses the date as UTC midnight and then reads the local month. In any timezone behind UTC, the first day of a month lands in the previous month. The README says to use the first seven characters of `issuedOn`. Input: with `TZ=America/New_York`, `monthKey({issuedOn:'2026-03-01'})` gives `'2026-02'`.

## Rounding

Rounding is decided in `src/money.js:10` (`roundHalfUp`, half away from zero). `multiply` at `src/money.js:16-19` rounds once through it.

These modules depend on that decision:
- **`src/tax.js`**: `vatOn` at `:21` uses `multiply`, and `netFromGross` at `:31` calls `roundHalfUp` directly. `grossFromNet` at `:26` goes through `vatOn`.
- **`src/discounts.js:16`**: `percentOff` uses `multiply`, and so do the percent and volume discounts.
- **`src/invoice.js`**: `lineNet` at `:41` goes through `applyDiscounts`, and `invoiceTotals` at `:51` and `:55` goes through `vatOn`.
- **`src/creditnote.js:41`**: pro-rata `netCents` calls `roundHalfUp` directly.
- **`src/report.js`**: depends indirectly, through `invoiceTotals` at `:16` and `lineNet` at `:38`.
- **`src/index.js:1`**: re-exports `roundHalfUp` and `multiply`.

`allocate` at `src/money.js:50` is the exception. It uses its own truncate-plus-largest-remainder scheme and never calls `roundHalfUp`.