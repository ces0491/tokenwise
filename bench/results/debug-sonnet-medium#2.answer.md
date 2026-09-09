All 29 tests pass now.

`invoiceTotals` was computing VAT per line and summing the results, rounding VAT separately for each line (3 lines of 3 cents at 20% each rounded to 1 cent, summing to 3). I changed it to compute VAT once on the total net (`vatOn(net, region)`), which rounds 9×20%=1.8 to 2 as the "vatOn rounds once" test elsewhere already required.