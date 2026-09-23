Both background agents finished and their findings match my own independent read of the diff. Main is checked out with 38/38 tests passing.

## Implement

Added `src/creditnote.js` exporting `createCreditNote`, wired into `src/index.js`, and updated `invoiceTotals` (src/invoice.js) plus `monthlySummary`/`topSkus` (src/report.js) to handle credit notes per the spec's validation order, rounding rule, and negative-totals behaviour. Added `test/creditnote.test.js` (11 new tests) without touching any existing test; `npm test` passes 38/38.

## Review

**src/csv.js:37** — `csvField` no longer quotes embedded newlines.
What goes wrong: the quoting regex was narrowed from `/[",\r\n]/` to `/[",]/`, so a field containing `\n` is emitted unquoted, and `toCsv` joins rows with `\n`, making the embedded newline indistinguishable from a row separator.
Example: `toCsv([['C-3', 'two\nlines']])` → `"C-3,two\nlines\n"`; parsing that back gives `[['C-3','two'],['lines']]`, not the original row.

**test/csv.test.js:21,26** — Test coverage for newline quoting was deleted, weakening the suite so the regression above goes undetected.
What goes wrong: the assertion `csvField('x\ny') === '"x\ny"'` was removed, and the `'C-3', 'two\nlines'` row was dropped from the round-trip test.
Example: neither test still exercises a field containing `\n`, so `npm test` stays green despite the broken round-trip.

**src/discounts.js:25** — `volumeTier` changed its boundary from `tier.minQty <= qty` to `tier.minQty < qty`, contradicting its own doc comment ("the highest tier whose minQty is less than or equal to the quantity").
Example: `volumeTier([{ minQty: 10, percent: 5 }], 10)` now returns `null` instead of the 10-qty tier — a quantity that exactly meets a threshold no longer gets that tier's discount.

**src/discounts.js:22** — `volumeTier` now calls `tiers.sort(...)` in place, mutating the caller's discount config as a side effect of a lookup.
Example: `const d = { type: 'volume', tiers: [{minQty:50,percent:12},{minQty:10,percent:5}] }; applyDiscount(1000, d, 5);` reorders `d.tiers` even though no tier applied, corrupting shared discount objects reused across lines/invoices.

**src/report.js:5-6** — `monthKey` now derives the month via `new Date(issuedOn).getFullYear()/getMonth()` instead of slicing the string, breaking README's "group by the first seven characters of issuedOn" and making grouping timezone-dependent.
Example: in a UTC-5 environment, `monthKey({ issuedOn: '2026-03-01' })` parses as `2026-03-01T00:00:00Z` = `2026-02-28T19:00` local, returning `'2026-02'` instead of `'2026-03'` — invoices near month boundaries land in the wrong month of `monthlySummary`.

**src/tax.js:31** — `netFromGross` swapped `roundHalfUp` for `Math.round`, violating the README rule that `src/money.js` owns rounding (half away from zero, applied once) for negative amounts.
Example: `netFromGross(-3, 'GB')` computes `-3/1.2 = -2.5`; `Math.round(-2.5)` gives `-2`, but half-away-from-zero (`roundHalfUp`) gives `-3` — diverges from `grossFromNet`/`vatOn`, which still round correctly.

## Rounding

Rounding is decided in `src/money.js:10-13` (`roundHalfUp`, half away from zero) and applied once inside `multiply` (`src/money.js:16-20`, line 19). Dependents: `src/tax.js:1` imports `multiply`/`roundHalfUp` — `vatOn` (tax.js:21) uses `multiply`, `netFromGross` (tax.js:31) calls `roundHalfUp` directly; `src/discounts.js:1,16` uses `multiply` for `percentOff`; `src/invoice.js` depends indirectly via already-rounded results from tax.js/discounts.js; `src/index.js:1` re-exports both as public API. My new `src/creditnote.js` also calls `roundHalfUp` directly for prorating credited net.