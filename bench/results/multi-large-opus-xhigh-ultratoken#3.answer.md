## Implement

I added `src/creditnote.js`, which exports `createCreditNote`, and re-exported it from `src/index.js`. `invoiceTotals` in `src/invoice.js` and `topSkus` in `src/report.js` now handle `kind === 'credit'` documents, and the new tests are in `test/credit-notes.test.js`: 45 of 45 tests pass, with no existing test file changed.

## Review

**src/csv.js:37** — `csvField` no longer quotes fields that contain a line break, so the CSV output is corrupt and doesn't parse back to the same rows. Input: `parseCsv(toCsv([["C-3","two\nlines"]]))` → expected `[["C-3","two\nlines"]]`, got `[["C-3","two"],["lines"]]`.

**test/csv.test.js:22** — The tests were weakened to hide the csv.js bug. The `csvField('x\ny')` assertion and the `['C-3','two\nlines']` round-trip row were deleted. Input: `csvField('x\ny')` → expected `"x\ny"` wrapped in quotes, got `x\ny` unquoted, and the suite still passes.

**src/tax.js:31** — `netFromGross` now uses `Math.round`, which rounds negative halves toward zero. That breaks the README rule that `money.js` owns rounding, half away from zero. Input: `netFromGross(-3, 'GB')` (-3 / 1.2 = -2.5) → expected `-3`, got `-2`.

**src/discounts.js:25** — The comparison changed from `<=` to `<`, so a tier no longer applies when the quantity equals its `minQty`. Input: `volumeTier([{minQty:10,percent:5},{minQty:1,percent:1}], 10)` → expected `{minQty:10,percent:5}`, got `{minQty:1,percent:1}`.

**src/discounts.js:22** — `tiers.sort` sorts the caller's array in place, so passing tiers in changes them. It also throws on frozen tier config. Input: `const t=[{minQty:10},{minQty:1}]; volumeTier(t, 10)` → expected `t` unchanged as `[{minQty:10},{minQty:1}]`, got `t` reordered to `[{minQty:1},{minQty:10}]`. With `Object.freeze(t)`: expected a tier, got a TypeError.

**src/report.js:5** — `monthKey` now builds the key from `new Date(issuedOn)` and reads it with local-time getters. That breaks the README rule to group by the first seven characters of `issuedOn`: a `YYYY-MM-DD` string parses as UTC midnight, so any timezone behind UTC moves day-1 invoices into the previous month. Input: `monthKey({issuedOn:'2026-03-01'})` with `process.env.TZ='America/New_York'` → expected `2026-03`, got `2026-02`.

## Rounding

It's decided in one place, `roundHalfUp` at `src/money.js:10-13`, which rounds half away from zero. `multiply` (`src/money.js:16-20`) wraps it, and `README.md:11` sets the rule. `allocate` (`src/money.js:50-67`) splits totals by largest remainder and doesn't call it.

Modules that depend on it:
- `src/tax.js:20-21`: `vatOn` goes through `multiply`, and `netFromGross` at `src/tax.js:31` calls `roundHalfUp` directly.
- `src/discounts.js:16`: `percentOff` goes through `multiply`.
- `src/invoice.js:41,52,56`: through `applyDiscounts` and `vatOn`.
- `src/report.js:16,38`: through `invoiceTotals` and `lineNet`.
- `src/creditnote.js:9` (new): calls `roundHalfUp`.

`src/csv.js:64` uses `fromDecimal`, which rejects more than two decimals instead of rounding.

---
- Implement: ran on a Sonnet worker at medium effort with no escalation. `npm test` shows 45 of 45 passing, no existing test file changed, and main is checked out.
- Review: ran on an Opus worker at low effort with no escalation. All 6 findings have a file:line and a failing input. The worker couldn't reproduce the report.js one, so I reproduced it here.
- Rounding: done in this session with no escalation.