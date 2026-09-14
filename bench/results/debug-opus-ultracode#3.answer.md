`invoiceTotals` in `src/invoice.js` worked out VAT for each line, rounded it, and then added the lines up. The README says VAT is charged once on the invoice's net total, so three 3-cent GB lines came to 1 + 1 + 1 = 3 cents instead of 20% of 9 = 1.8, which rounds to 2.

It now calls `vatOn` once on the summed net. `npm test` passes all 29 tests.

I also deleted `lineVat`, the per-line helper. Nothing else called it and it isn't in `src/index.js`, so it would only have invited the same per-line calculation again. The README already describes the correct rule, so it doesn't need a change. Nothing is committed.