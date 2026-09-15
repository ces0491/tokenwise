## Fix
`invoiceTotals` worked out VAT for each line with `lineVat`/`vatOn`, which rounds every time, then added up the rounded amounts instead of rounding once on the invoice's total net. So rounding stacked up across lines: three 3-cent lines at 20% GB VAT give 0.6→1 three times = 3, where rounding the combined net gives 1.8→2 (fixed at `src/invoice.js:52` with `vatOn(net, invoice.region)`).

## Review
**`src/tax.js:31`**: `netFromGross` uses `Math.round`, which rounds negative halves toward positive infinity. README says rounding is half away from zero and belongs to `src/money.js`.
Input: `netFromGross(-3, 'GB')` (-3/1.2 = -2.5) → actual `-2`, expected `-3`.

**`src/discounts.js:25`**: the comparison changed from `<=` to `<`, so a tier no longer applies when the quantity equals its `minQty`.
Input: `volumeTier([{minQty: 10}], 10)` → actual `null`, expected `{minQty: 10}`.

**`src/discounts.js:22`**: `tiers.sort(...)` sorts the caller's array in place, so the input is changed and a frozen array throws.
Input: `const t=[{minQty:5},{minQty:1}]; volumeTier(t, 3)` → actual `t` becomes `[{minQty:1},{minQty:5}]`, expected `t` left unchanged. `volumeTier(Object.freeze([{minQty:5},{minQty:1}]), 3)` → actual TypeError, expected `{minQty:1}`.

**`src/report.js:5-6`**: `monthKey` parses the date with `new Date` (as UTC) and reads it back with local-time getters. In time zones west of UTC the key lands in the previous month. README says reports group by the first seven characters of `issuedOn`.
Input: `monthKey({issuedOn: '2026-03-01'})` with `TZ=America/New_York` → actual `"2026-02"`, expected `"2026-03"`.

**`src/csv.js:37`**: `csvField` no longer quotes fields that contain CR or LF, so a multi-line field breaks the CSV and doesn't round-trip.
Input: `parseCsv(toCsv([['C-3','two\nlines']]))` → actual `[['C-3','two'],['lines']]`, expected `[['C-3','two\nlines']]`. `csvField('x\ny')` → actual `x\ny`, expected `"x\ny"`.

**`test/csv.test.js:19-26`**: the tests were weakened to match the csv.js change. The `csvField('x\ny')` assertion and the `['C-3','two\nlines']` round-trip row were removed.
Input: `csvField('x\ny')` → actual `x\ny` (no test catches it), expected `"x\ny"`.

## Rounding
The rule is set in `src/money.js:10-13`: `roundHalfUp` rounds half away from zero. `multiply` (`src/money.js:16-19`) is the standard way to call it, and `README.md:11` says money.js owns rounding. `allocate` (`src/money.js:56-65`) doesn't use it; it floors and hands out the leftover cents by largest remainder.

Modules that depend on it:
- `src/tax.js`: `vatOn` at :21 goes through `multiply`, gross at :26 goes through `vatOn`, and `netFromGross` at :31 calls `roundHalfUp` directly.
- `src/discounts.js:16`: `percentOff` goes through `multiply`, and :34 and :41 use it.
- `src/invoice.js`: indirectly, through `applyDiscounts` at :41 and `vatOn` at :46 and :52.
- `src/report.js:1`: indirectly, through `invoiceTotals` and `lineNet`.
- `src/index.js:1`: re-exports it.

`src/csv.js` only uses `fromDecimal`, which doesn't round.

---
- Fix: ran on a Sonnet worker at medium effort, no escalation. `npm test` gives 29 passed, 0 failed, and only `src/invoice.js` changed. The change is not committed and main is checked out.
- Review: ran on an Opus worker at low effort, no escalation. All 6 findings have a file:line and a failing input, and the review-me branch was left untouched.
- Rounding: answered in this session, no escalation. The references were read from the source after the fix.