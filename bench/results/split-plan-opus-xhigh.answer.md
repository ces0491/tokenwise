`docs/plan.md` is written; it's the only change in the tree.

What the plan covers:

- **`src/invoice.js`** — export an `isDateString(value)` predicate so the credit note reuses the invoice date regex rather than duplicating it, and branch `invoiceTotals(doc)` on `doc.kind === 'credit'`. The credit branch sums `netCents`, calls `vatOn` once on that positive sum, and negates both.
- **`src/creditnote.js`** — `createCreditNote({ id, invoice, issuedOn, lines, reason })` plus private `creditLine(line, qty)` and `selectedLines(id, invoice, lines)`, with full bodies.
- **`src/report.js`** — `monthlySummary` needs no logic change (it goes through `invoiceTotals`); `topSkus(docs, n)` gets the subtract branch, since credit lines have `netCents` and no `unitCents`.
- **`src/index.js`** and **`README.md`** — export line, modules-table row, rules bullet.

Three things worth flagging, all resolved in the plan:

- **No import cycle.** `creditnote.js` imports from `invoice.js`, so `invoice.js` and `report.js` inline the `doc.kind === 'credit'` check instead of importing a predicate back.
- **`-0`.** `node:assert/strict` compares primitives with `Object.is`, so a US (zero-rated) credit note computing `vat` as `-vatOn(...)` produces `-0` and fails against an expected `0`. The plan prescribes `0 - x` in `invoiceTotals` and `-=` in `topSkus`.
- **Two judgment calls beyond the spec**, marked as such: a `TypeError` for a non-object line entry (otherwise `null.sku` crashes untyped), and duplicate SKUs on the *original* invoice resolving to the first matching line rather than throwing.

Every expected value in the 15 test cases — VAT figures, proportional `netCents`, monthly aggregates — was computed by evaluating the existing `src/` functions rather than by hand; `2350 × 0.15` in particular sits on a rounding boundary and lands on 353. That verification ran as throwaway `node --input-type=module -e` evaluation, so no code was written outside `docs/plan.md`.