All 29 tests pass now.

`invoiceTotals` was computing VAT per line and summing the already-rounded results, so three lines each rounding 0.6¢ up to 1¢ VAT overcharged the invoice by a cent. I changed it to sum the net first and round VAT once on that total (in `src/invoice.js`), matching how `vatOn` is meant to be used.