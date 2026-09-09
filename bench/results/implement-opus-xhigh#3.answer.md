Done. `npm test`: 40 pass, 0 fail — 11 new tests plus the 29 that existed (no existing test file touched).

**`src/creditnote.js`** — `createCreditNote({ id, invoice, issuedOn, lines, reason })` validates in the spec's precedence order: `id` (string starting `CN-`, `TypeError`) → `reason` (non-empty string, `TypeError`) → `invoice` via `validateInvoice` → `issuedOn` (`RangeError`) → credited `lines` (`RangeError` for empty/non-array, unknown sku, repeated sku, and `qty` outside 1..original). Omitting `lines` credits every line at full quantity. Each result line carries `netCents = roundHalfUp(lineNet(original) × qty / originalQty)` via `multiply`, so discounts are prorated rather than recomputed, and `description` is copied across. The result is frozen; the invoice is only read.

**`src/invoice.js`** — `invoiceTotals` branches on `doc.kind === 'credit'`: net is the negated sum of `netCents`, VAT is one `vatOn` call on that sum negated, gross is their sum. Invoice behaviour is byte-identical. The date regex is now behind an exported `isDateString` so the credit note validates its date against the same rule instead of a copy; that helper is deliberately not re-exported from `src/index.js`, which gains only `createCreditNote`.

**`src/report.js`** — `monthlySummary` needed no logic change once totals handle credit notes (it groups on the document's own `issuedOn` and counts it). `topSkus` subtracts `line.qty` and `line.netCents` for credit notes.

Two judgement calls worth flagging:

- Totals subtract from zero (`0 - credited`) rather than negating. Plain `-vatOn(...)` yields `-0` for a US credit note (0% VAT), which `assert.deepStrictEqual` treats as unequal to `0`. There's a test pinning this.
- A credited line entry that isn't an object throws `TypeError` ("not an object"), matching `validateLine`. The spec doesn't cover that case; the enumerated line failures all throw `RangeError` as specified.

README updated: new `src/creditnote.js` row, a Rules bullet on credit note sign conventions, and the `src/report.js` row now mentions credit notes. No commit made.