All 37 tests pass, including the 8 new credit-note tests, and none of the pre-existing tests were touched.

Summary of changes:

- **`src/creditnote.js`** (new) — `createCreditNote({ id, invoice, issuedOn, lines, reason })`, validating in the spec's precedence order (`id` → `reason` → `invoice` via `validateInvoice` → `issuedOn` → `lines`), scaling each credited line's net with `multiply` (one `roundHalfUp`), and returning a frozen credit note.
- **`src/invoice.js`** — `invoiceTotals` now branches on `doc.kind === 'credit'`, summing `netCents` and returning negated `net`/`vat`/`gross` (VAT computed once via `vatOn`); invoice behavior is unchanged.
- **`src/report.js`** — `topSkus` subtracts a credit note's `qty`/`netCents` instead of calling `lineNet`; `monthlySummary` needed no change since it already delegates to `invoiceTotals`/`monthKey`, which now handle credit notes correctly.
- **`src/index.js`** — exports `createCreditNote`.
- **`test/creditnote.test.js`** (new) — covers validation order/errors, non-mutation of the original invoice, full vs. partial credit lines, the half-up rounding rule, and credit-note handling in `invoiceTotals`, `monthlySummary`, and `topSkus`.