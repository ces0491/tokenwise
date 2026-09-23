All 29 tests pass now.

`invoiceTotals` was computing VAT per line and summing the results, so each line's fractional cent got rounded up separately (three lines of 3 cents at 20% GB VAT each rounded 0.6→1, totaling 3) instead of once on the invoice net. I changed it to compute VAT once on the summed net (9×0.2=1.8→2), matching the documented "rounded once" behavior in `vatOn`.