All 29 tests pass now.

`invoiceTotals` was computing VAT per line and rounding each line's VAT before summing, so three £0.03 lines each rounded 0.6p up to 1p, overcharging by a penny. I changed it to sum the net first and apply VAT rounding once to the total, matching how `net` and `gross` are already computed.