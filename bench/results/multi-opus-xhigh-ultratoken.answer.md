## Fix
`invoiceTotals` in `src/invoice.js` worked out VAT for each line, rounded it, and then added the lines up. README rule 12 says VAT is calculated once on the invoice's net total, so three 3-cent GB lines came to 3 cents of VAT instead of 2. It now calls `vatOn(net, invoice.region)` once (`src/invoice.js:47`), and the `lineVat` helper, which nothing else used, is gone. `npm test` passes 29 of 29 with nothing under `test/` touched.

## Review
**src/csv.js:37** — `csvField` no longer quotes fields that contain `\r` or `\n`. A multi-line description gets split into extra rows when parsed back. Input: `parseCsv(toCsv([['a','two\nlines']]))` → actual `[["a","two"],["lines"]]`, expected `[["a","two\nlines"]]`. Confirmed by running.

**test/csv.test.js:19-27** — Two test cases were deleted, which weakens the suite and hides the csv.js defect above: the `csvField('x\ny')` assertion and the `['C-3','two\nlines']` row in the round-trip test. Input: the deleted assertion `csvField('x\ny')` → actual `x\ny`, expected `"x\ny"`.

**src/discounts.js:25** — The comparison changed from `<=` to `<`, so a tier no longer applies when the quantity equals its `minQty`. Input: `volumeTier([{minQty:10,p:1},{minQty:1,p:0}], 10)` → actual `{minQty:1,p:0}`, expected `{minQty:10,p:1}`. Confirmed by running.

**src/discounts.js:22** — `tiers.sort(...)` sorts the caller's array in place. Input: `t=[{minQty:10},{minQty:1}]`, then `volumeTier(t,10)` → afterwards `t` is actual `[{minQty:1},{minQty:10}]`, expected unchanged `[{minQty:10},{minQty:1}]`. It also throws on frozen tier arrays. Confirmed by running.

**src/tax.js:31** — `netFromGross` now uses `Math.round` in place of `roundHalfUp`, and `Math.round` rounds negative halves toward +infinity. README rule: "src/money.js owns rounding: half away from zero". Input: `netFromGross(-4995,'GB')` (raw value -4162.5) → actual `-4162`, expected `-4163`. Confirmed by running.

**src/report.js:5-6** — `monthKey` now parses `issuedOn` with `new Date()`, which reads `YYYY-MM-DD` as UTC midnight, then takes the month with local-time getters. In any timezone behind UTC, invoices dated on the 1st land in the previous month. README rule: "Monthly reports group by the first seven characters of issuedOn". Input: `monthKey({issuedOn:'2026-03-01'})` with TZ=America/New_York → actual `2026-02`, expected `2026-03`. Not confirmed by running: Node on this Windows machine ignores the `TZ` variable (offset stayed -120, and it returned `2026-03` locally). The failure follows from JS Date semantics.

## Rounding
The decision is made in `src/money.js:10-13`: `roundHalfUp` rounds half away from zero, as README.md:11 requires. `multiply` (`src/money.js:16-20`) applies it once. `allocate` (`src/money.js:50-67`) sets its own rule: it truncates, then hands out the leftover cents by largest remainder.

Modules that depend on it:
- `src/tax.js:21` (`vatOn` calls `multiply`) and `src/tax.js:31` (`netFromGross` calls `roundHalfUp`). `grossFromNet` (`src/tax.js:26`) inherits it.
- `src/discounts.js:16` (`percentOff` calls `multiply`), used at lines 34 and 41.
- `src/invoice.js:41` and `src/invoice.js:47`, through discounts and `vatOn`.
- `src/report.js:16` and `src/report.js:34`, through `invoiceTotals` and `lineNet`.
- `src/index.js:1-2` re-exports the helpers.

`src/csv.js:64` only calls `fromDecimal`, which parses exactly and doesn't round.

---
- Fix: sent to a Sonnet worker at medium effort, no escalation. Check passed: `npm test` 29/29 green on main, and only `src/invoice.js` changed.
- Review: sent to an Opus worker at low effort, no escalation. Check passed: every finding has a file:line and an input. The `src/report.js` finding couldn't be reproduced on this machine because Node here ignores `TZ`.
- Rounding: done in this session, no escalation, line references checked against the working tree.

main is checked out and `src/invoice.js` has uncommitted changes. Nothing has been committed.