## Implement

Added `src/creditnote.js` with `createCreditNote`, exported it from `src/index.js`, and updated `invoiceTotals` (src/invoice.js) and `topSkus` (src/report.js) to handle `kind: 'credit'` documents per the spec's validation order, proration and negative-totals rules. Added `test/creditnote.test.js` (9 new tests); all 38 tests pass via `npm test`.

## Review

**1. `src/tax.js:30` (`netFromGross`) — breaks "half away from zero" rounding**
The diff drops `roundHalfUp` for plain `Math.round`, which rounds `.5` toward `+∞` instead of away from zero.
Example: `netFromGross(-3, 'GB')` — raw quotient `-3/1.2 = -2.5`. Spec/README requires `-3`; actual code returns `Math.round(-2.5) = -2`.

**2. `src/discounts.js:20-26` (`volumeTier`) — boundary changed from `<=` to `<`**
Contradicts its own doc comment ("minQty is less than or equal to the quantity") and the discount rules.
Example: `volumeTier([{ minQty: 10, percent: 5 }], 10)` now returns `null` instead of the tier, so `applyDiscount(1000, { type: 'volume', tiers }, 10)` returns `1000` instead of the correct `950`.

**3. `src/report.js:4-7` (`monthKey`) — violates "group by the first seven characters of `issuedOn`"**
Replaced the string-prefix logic with `new Date(...)` + local-time `getFullYear`/`getMonth`, which is timezone-dependent since `new Date('YYYY-MM-DD')` parses as UTC midnight.
Example: `monthKey({ issuedOn: '2026-03-01' })` on a UTC-5 machine (e.g. America/New_York) returns `'2026-02'` instead of `'2026-03'`.

**4. `src/csv.js:34-38` (`csvField`) — no longer quotes fields with line breaks, paired with weakened tests**
The regex dropped `\r\n`, so a field with an embedded newline is emitted unquoted and no longer round-trips through CSV. `test/csv.test.js` had the `csvField('x\ny')` assertion and the `'two\nlines'` round-trip case deleted rather than fixed.
Example: `csvField('two\nlines')` returns `'two\nlines'` unquoted; serializing `[['sku','description'],['C-3','two\nlines']]` with `toCsv` and re-parsing with `parseCsv` no longer reproduces the original rows — the embedded newline is read back as a new row.

## Rounding

Rounding is decided in `src/money.js:10` (`roundHalfUp`, half away from zero) and `src/money.js:16-20` (`multiply`, which rounds once via `roundHalfUp`), per the rule stated in README.md. Direct dependents: `src/tax.js:21` (`vatOn`, via `multiply`) and `src/tax.js:31` (`netFromGross`, via `roundHalfUp` directly — on `main`; on `review-me` this call was swapped for plain `Math.round`, see Review #1). `src/discounts.js:16` (`percentOff`, via `multiply`) also depends on it. Transitively, `src/invoice.js` (`lineNet`, `invoiceTotals`) and `src/creditnote.js:42` (new `createCreditNote`, via `roundHalfUp` directly) depend on this decision, since they compose `vatOn`/`percentOff`/direct rounding.