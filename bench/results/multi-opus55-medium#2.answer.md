## Fix
`invoiceTotals` in `src/invoice.js` worked out VAT separately on each line and then added those amounts up. README says VAT is calculated once on the invoice net total, so three GB lines of 3c gave VAT of 1+1+1 = 3c when it should be `round(9 × 0.2)` = 2c. I changed it to `vatOn(net, region)` and removed `lineVat`, which is now unused and isn't exported from `index.js`. `npm test` passes 29/29. The change is uncommitted on `main`, and README needs no update.

## Review
**`src/csv.js:37`**: `csvField` no longer quotes fields that contain `\r` or `\n`, so a multi-line field breaks into separate rows. `parseCsv(toCsv([['C-3','two\nlines']]))` returns `[["C-3","two"],["lines"]]`. This breaks the round trip the header comment promises.

**`test/csv.test.js:22` and `:27` (deleted lines)**: The branch weakens the tests to hide the csv.js regression. It deletes the `csvField('x\ny')` assertion and drops the `['C-3','two\nlines']` row from the round-trip test.

**`src/discounts.js:25`**: The tier check changed from `<=` to `<`, so a quantity exactly on a tier boundary gets no discount. `applyDiscount(1000, {type:'volume', tiers:[{minQty:10, percent:5}]}, 10)` returns 1000 when it should be 950. This contradicts the module's documented rule: "minQty is less than or equal to the quantity".

**`src/discounts.js:22`**: `tiers.sort(...)` sorts the caller's array in place. After `volumeTier(t, 20)` with `t = [{minQty:50},{minQty:10}]`, `t` has been reordered. With a frozen tiers array, such as tiers on an invoice from `createInvoice`, it throws `TypeError`.

**`src/report.js:5-6`**: `monthKey` now parses `issuedOn` as a `Date`. A date-only ISO string is read as UTC midnight, but `getMonth()` returns the local month. In any timezone behind UTC, `{issuedOn:'2026-03-01'}` gives `'2026-02'`. README says to group by the first seven characters. I couldn't reproduce this here because Node on this machine ignores `TZ` and runs at UTC+2, so this finding comes from the JS date-parsing rules.

**`src/tax.js:31`**: `netFromGross` now uses `Math.round`, which rounds a .5 towards +∞. README says `money.js` owns rounding and rounds half away from zero. `netFromGross(-3, 'GB')` (-3 / 1.2 = -2.5) returns -2 when it should be -3.

## Rounding
Rounding is decided in `src/money.js:10-13`. `roundHalfUp` rounds half away from zero. `multiply` (`src/money.js:16-20`) applies it once to `amount × factor`. `allocate` (`src/money.js:50-67`) handles splits separately, using floor plus largest remainder.

Modules that depend on it:
- `src/tax.js`: `vatOn` goes through `multiply` (`:21`), and `netFromGross` calls `roundHalfUp` directly (`:31`). `grossFromNet` (`:26`) inherits it through `vatOn`.
- `src/discounts.js`: `percentOff` uses `multiply` (`:16`), which both percent and volume discounts rely on (`:34`, `:41`).
- `src/invoice.js`: depends indirectly, through `lineNet` → `applyDiscounts` and `invoiceTotals` → `vatOn`.
- `src/report.js`: depends indirectly, through `invoiceTotals` and `lineNet`.
- `src/index.js:1`: re-exports `roundHalfUp` and `multiply` publicly.

`src/csv.js` only uses `fromDecimal`, which doesn't round. It rejects anything with more than two decimal places.