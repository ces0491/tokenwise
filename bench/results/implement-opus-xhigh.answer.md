Done. `npm test` passes: 43 tests, 0 failures (32 pre-existing, 11 new). No existing test file was touched.

**`src/creditnote.js`** (new) — `createCreditNote({ id, invoice, issuedOn, lines, reason })` returns a frozen note in the spec's shape. Validation runs in the spec's precedence order: `id` prefix and `reason` (`TypeError`), then `validateInvoice`, then `issuedOn`, then the line selection. Omitting `lines` credits every line at full quantity. `netCents` is `multiply(lineNet(original), qty / originalQty)`, so the discounted line net is scaled and rounded once with `roundHalfUp` rather than the discounts being re-evaluated at the credited quantity. The invoice is only read; credited lines are fresh objects.

**`src/invoice.js`** — `invoiceTotals(doc)` takes a `kind === 'credit'` branch: net is minus the sum of `netCents`, VAT is one `vatOn` call on that sum for the note's region, gross is their sum. Invoice behaviour is unchanged. The date pattern is now `export const ISO_DATE` so the credit note validates `issuedOn` against the same regex instead of a copy.

**`src/report.js`** — `monthlySummary` needed no logic change (it groups by `issuedOn` and delegates to `invoiceTotals`), so a note lands in its own month with the negative totals. `topSkus` subtracts `qty` and `netCents` for credit-note lines.

**`src/index.js`** — exports `createCreditNote`. **`README.md`** — added the `src/creditnote.js` row, a rule describing credit notes, and updated the `invoice.js`/`report.js` row descriptions.

Two spec gaps I decided rather than guessed, both flagged here in case you want them the other way:

- A non-array `lines` (e.g. `lines: 'A'`) throws `TypeError`, matching how the codebase splits wrong-type from bad-value; the spec only assigns `RangeError` to the empty case, which I kept.
- `description` is always copied onto the credited line, so it's present as `undefined` when the original line has none.

The one non-obvious line is `0 - credited` in `invoiceTotals` — negation would give `-0` for a zero-value credit note and break strict deep-equality against `0`. There's a comment on it and a check that the totals come back as `+0`.