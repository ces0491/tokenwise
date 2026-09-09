All 29 tests pass now.

`invoiceTotals` was computing VAT per line and summing the rounded results, so three lines of 3 cents each rounded 0.6→1 three times (3 cents VAT) instead of rounding once on the combined net. I changed it to round VAT once on the invoice's total net amount via `vatOn(net, invoice.region)`, matching `vatOn`'s documented "rounded once" contract.