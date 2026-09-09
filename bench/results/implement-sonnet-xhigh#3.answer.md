All 44 tests pass, and none of the pre-existing test files were touched (confirmed by git status — only `src/*` and `README.md` modified, plus two new files).

## Summary

Implemented per `docs/spec.md`:

- **`src/creditnote.js`** (new) — `createCreditNote({ id, invoice, issuedOn, lines, reason })`, validating in the spec's precedence order (id → reason → invoice → issuedOn → lines) and returning a frozen credit note. `netCents` per line is the original discounted `lineNet` scaled by `qty / originalQty` via `money.js`'s `multiply` (single `roundHalfUp` rounding, discounts never recomputed).
- **`src/invoice.js`** — `invoiceTotals` now branches on `doc.kind === 'credit'`, returning negative `net`/`vat`/`gross` computed from the credit note's summed `netCents`; invoice behavior unchanged.
- **`src/report.js`** — `topSkus` subtracts credited `qty`/`netCents` for credit notes; `monthlySummary` required no logic change since it already delegates to `invoiceTotals`/`monthKey`, both of which now handle credit notes generically.
- **`src/index.js`** — exports `createCreditNote`.
- **`README.md`** — added the `creditnote.js` module row and a rules bullet on credit note scaling/rounding and negative totals.
- **`test/creditnote.test.js`** (new) — 15 tests covering full and partial credit notes, discount-not-recomputed behavior, half-away-from-zero rounding, immutability of the original invoice, every validation error (including precedence), and integration with `invoiceTotals`, `monthlySummary`, and `topSkus`.

No existing test files were modified.