I've added credit notes as `docs/spec.md` describes. `npm test` passes all 44 tests: the existing ones, which I didn't touch, and 15 new ones in `test/creditnote.test.js`. Nothing is committed yet.

**What changed**
- **`src/creditnote.js`** (new) exports `createCreditNote`. It checks its inputs in the spec's order (`id`, `reason`, `invoice`, `issuedOn`, `lines`) and uses the error types the spec gives. Each credited line is the original line's net after discounts, scaled by `qty / originalQty` and rounded once with `roundHalfUp`. The credit note and its lines are frozen, and the original invoice is left unchanged.
- **`src/invoice.js`**: `invoiceTotals` now handles `kind === 'credit'`. It returns negative net, VAT and gross, with VAT calculated once on the credited total. I also added an `isDate` helper so invoices and credit notes check dates with the same pattern.
- **`src/report.js`**: `monthlySummary` counts credit notes in the month they were issued, which needed no code change because it goes through `invoiceTotals`. `topSkus` now subtracts credited `qty` and `netCents`.
- **`src/index.js`** exports `createCreditNote`.
- **`README.md`**: added a rule for credit notes and updated the modules table.

The tests cover a full credit, a partial credit on a discounted line, rounding half up (2.5 → 3), and discounts not being recalculated at the credited quantity (190 rather than 200). They also check that VAT is calculated once on the total (−2 rather than −3 line by line), which input gets reported when several are wrong, that the original invoice is unchanged, and both reports.

**Three cases the spec doesn't cover, and what I did**
- **`lines` isn't an array, or an entry isn't an object:** this throws `TypeError`, matching how `validateLine` treats a wrong shape. Every rule the spec states for `lines` throws `RangeError` as written.
- **The original invoice has the same SKU on two lines:** the credit goes against the first matching line. Crediting by SKU can't tell those lines apart, so if that can happen in real data, the spec needs a way to pick a line.
- **Totals when the credited net is 0:** they come out as `0`, not `-0`, so strict equality checks still pass.