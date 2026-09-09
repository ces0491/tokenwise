All tests pass ✓

The bug was calculating VAT per line and then summing (1+1+1=3), rather than calculating VAT once on the invoice total (20% of 9 = 1.8 → rounds to 2). The fix changes `invoiceTotals` to compute VAT on the total net amount, not on each line individually.