# Credit notes

A credit note reverses all or part of an issued invoice. Add `src/creditnote.js`, export its functions from `src/index.js`, and make totals and reports handle credit notes.

## createCreditNote({ id, invoice, issuedOn, lines, reason })

Returns a frozen credit note. Validation, in this order of precedence where several apply:

- `id`: string starting with `CN-`. Otherwise `TypeError`.
- `reason`: non-empty string. Otherwise `TypeError`.
- `invoice`: the original invoice object. Validate it with `validateInvoice`. The original must not be mutated.
- `issuedOn`: `YYYY-MM-DD` string, validated like an invoice date. Otherwise `RangeError`.
- `lines`: optional array of `{ sku, qty }`. When omitted, the whole invoice is credited (every line, full quantity). When given it must be non-empty (`RangeError`), each `sku` must be on the original invoice (`RangeError`), a `sku` may appear only once (`RangeError`), and `qty` must be an integer from 1 to the original line's `qty` inclusive (`RangeError`).

Shape of the result:

```
{
  id, kind: 'credit', invoiceId: invoice.id, region: invoice.region, issuedOn, reason,
  lines: [{ sku, description, qty, netCents }]
}
```

`netCents` is the positive net amount credited for that line: the original line's net (`lineNet`, after its discounts) multiplied by `qty / originalQty`, rounded once with `roundHalfUp`. Discounts are not recomputed at the credited quantity. `description` is copied from the original line.

## Totals

`invoiceTotals(doc)` must accept a credit note (`doc.kind === 'credit'`) and return negative amounts: `net` is minus the sum of `netCents`; `vat` is minus the VAT on that sum, calculated once with `vatOn` for the credit note's region; `gross` is `net + vat`. Invoices are unchanged.

## Reports

- `monthlySummary` includes credit notes by their own `issuedOn` month: `count` increments and the negative totals are added.
- `topSkus` subtracts credited `qty` and `netCents` from the SKU's totals.

## Tests

Add tests under `test/` for the behaviour above and run `npm test`.
