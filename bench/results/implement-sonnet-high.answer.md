Implemented and verified. Summary:

**`src/creditnote.js`** (new) — `createCreditNote({ id, invoice, issuedOn, lines, reason })`:
- Validates in spec order: `id` (must start with `CN-`, else `TypeError`) → `reason` (non-empty string, else `TypeError`) → `invoice` (via `validateInvoice`, propagating its error types) → `issuedOn` (`YYYY-MM-DD`, else `RangeError`) → `lines` (optional; when given: non-empty, each sku on the invoice, no duplicates, qty in `[1, originalQty]` — all `RangeError`).
- Full credit (no `lines`) copies every original line at full qty. Partial credit prorates `lineNet(original) * qty/originalQty` via `multiply`, which rounds once with `roundHalfUp` — matches the spec's rounding rule.
- Reads the original invoice only; never mutates it. Returns a frozen object with the exact shape from the spec.

**`src/invoice.js`** — `invoiceTotals` now branches on `doc.kind === 'credit'`: net = −Σ`netCents`, vat = −`vatOn(that sum, region)` (single rounding), gross = net + vat. Invoice behavior unchanged.

**`src/report.js`** — `topSkus` subtracts credited `qty`/`netCents` for credit-note lines instead of adding. `monthlySummary` needed no change — it already just calls `invoiceTotals(doc)` and groups by `doc.issuedOn`, so it picked up credit notes automatically.

**`src/index.js`** — exports `createCreditNote`.

**`test/creditnote.test.js`** (new, 9 tests) — covers full/partial credit creation and rounding, validation-order precedence and each error case, non-mutation of the original invoice, negative `invoiceTotals` for full and partial credits, `monthlySummary` folding credits into their own month (same-month netting and cross-month split), and `topSkus` subtraction.

No existing test files were touched. `npm test` — 38/38 passing. Updated the README's module table to mention `src/creditnote.js` and the credit-note behavior of `topSkus`.