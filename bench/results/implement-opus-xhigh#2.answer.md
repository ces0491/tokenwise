All 39 tests pass (exit 0), and no existing test file was touched.

## What I added

**`src/creditnote.js`** — `createCreditNote({ id, invoice, issuedOn, lines, reason })` returns a frozen note. Validation runs in the spec's order: `id` must be a string starting with `CN-` (TypeError), `reason` a non-empty string (TypeError), `invoice` through `validateInvoice`, `issuedOn` against the same `YYYY-MM-DD` regex invoices use (RangeError), then the credited lines (RangeError for empty/non-array, unknown sku, repeated sku, or a `qty` outside 1..original). Omitting `lines` credits every line in full.

`netCents` per line is `roundHalfUp((lineNet(original) * qty) / original.qty)` — one rounding, on the original line's already-discounted net, so a volume tier earned at qty 10 still applies to a single credited unit (900 → 90, not 100). `description` is copied from the original line; the invoice is only read, never mutated.

**`invoiceTotals(doc)`** now branches on `doc.kind === 'credit'`: sums `netCents`, negates it for `net`, calls `vatOn` once on the positive sum for `-vat`, and returns `net + vat` as gross. Invoice behaviour is unchanged.

**`report.js`** — `monthlySummary` needed no logic change; it already groups by `issuedOn` and adds whatever `invoiceTotals` returns, so a credit note counts in its own month with negative totals. `topSkus` now subtracts `qty` and `netCents` for credit-note lines.

**`src/index.js`** exports `createCreditNote`. **README** gets a rules bullet and a `src/creditnote.js` row; the `src/report.js` row now says "across invoices and credit notes".

## Two spec gaps I decided rather than guessed

- Credit-note lines come out in the order you pass them, not invoice order (invoice order when `lines` is omitted).
- A SKU that appears only on credit notes still shows up in `topSkus` with negative totals, sorting below everything positive.

Both are unspecified; say the word if you want either the other way.

One judgement call worth flagging: `description` is copied verbatim, so crediting an invoice line that has no description yields a line with `description: undefined` present as a key. That matters only if something downstream does a strict deep-equal against a three-key object.