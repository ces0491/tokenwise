# invoicer

A small invoicing library. No dependencies. Node 20 or later.

```
npm test
```

## Rules

- Every amount is an integer number of cents. `src/money.js` owns rounding: half away from zero, applied once at the end of a calculation.
- VAT is calculated once on the invoice net total, never per line. Rates by region live in `src/tax.js`.
- Discounts apply to a line's gross (quantity times unit price) in the order given: percent, fixed amount, or volume tiers. A discounted line never goes below zero.
- Dates are `YYYY-MM-DD` strings. Monthly reports group by the first seven characters of `issuedOn`.

## Modules

| File | Purpose |
|---|---|
| `src/money.js` | integer-cent arithmetic, rounding, decimal parsing and formatting, proportional allocation |
| `src/tax.js` | VAT rates by region, `vatOn`, gross and net conversion |
| `src/discounts.js` | percent, fixed and volume-tier discounts |
| `src/invoice.js` | invoice validation and totals |
| `src/csv.js` | CSV parse and serialise, invoice lines from CSV |
| `src/report.js` | monthly summary and top SKUs across invoices |
| `src/index.js` | public exports |
