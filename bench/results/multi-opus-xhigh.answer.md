I fixed the failing test on `main` and haven't committed it. `npm test` now passes all 29 tests. `main` is still checked out. I reviewed `review-me` in a temporary worktree, which I've since removed, and left the branch unchanged. The README needs no change, because the fix makes the code follow its VAT rule.

## Fix
`invoiceTotals` worked out VAT separately for each line and added the results up (through `lineVat`). The README says VAT is calculated once on the invoice net total, so three 3-cent GB lines came to 3 cents of VAT instead of 2. It now calls `vatOn(net, region)` once (`src/invoice.js:47`), and I removed the unused `lineVat` helper, which was the per-line version.

## Review
**src/csv.js:37**
`csvField` no longer quotes fields that contain line breaks, so `toCsv` output no longer parses back to the same rows.
Input: `toCsv([['sku','description'],['C-3','two\nlines']])` gives `"sku,description\nC-3,two\nlines\n"`, and `parseCsv` of that returns `[["sku","description"],["C-3","two"],["lines"]]`.

**test/csv.test.js:22, :26**
The test was weakened to hide the defect above: the `csvField('x\ny')` assertion was deleted, and the `['C-3', 'two\nlines']` row was dropped from the round-trip test.
Input: restoring `assert.equal(csvField('x\ny'), '"x\ny"')` fails on `review-me`.

**src/discounts.js:25**
The check changed from `minQty <= qty` to `minQty < qty`, so a quantity exactly at a tier's threshold gets no discount. This contradicts the documented rule at `src/discounts.js:8` ("less than or equal to").
Input: `applyDiscount(1000, { type: 'volume', tiers: [{ minQty: 10, percent: 5 }] }, 10)` returns `1000`; `main` returns `950`.

**src/discounts.js:22**
`tiers.sort(...)` sorts the caller's array in place. That silently reorders the discount data on an invoice line, and it throws when the array is frozen.
Input: `volumeTier(Object.freeze([{ minQty: 50, percent: 12 }, { minQty: 10, percent: 5 }]), 60)` throws `Cannot assign to read only property '0'`; `main` returns the 50-tier. With an unfrozen `[{minQty:50},{minQty:10}]`, the caller's array comes back reordered to `[{minQty:10},{minQty:50}]`.

**src/report.js:5-6**
`monthKey` now goes through `new Date` and local-time getters. That breaks the README rule to group by the first seven characters of `issuedOn`: the month depends on the machine's timezone, and invalid days roll over into the next month.
Input: with `TZ=America/New_York`, `monthKey({ issuedOn: '2026-03-01' })` gives `'2026-02'`. In any timezone, `'2026-02-31'` (accepted by `validateInvoice`'s regex) gives `'2026-03'`, where `main` gives `'2026-02'`.

**src/tax.js:31**
`netFromGross` uses `Math.round` instead of `roundHalfUp`. `Math.round` rounds negative halves towards zero, which breaks the README rule that `src/money.js` owns rounding, half away from zero.
Input: `netFromGross(-3, 'GB')` (−2.5 cents) returns `-2`; `main` returns `-3`. Likewise, `-9` returns `-7` instead of `-8`.

## Rounding
The rounding rule lives in `src/money.js`. `roundHalfUp` (`src/money.js:10-13`) rounds half away from zero, and `multiply` (`src/money.js:16-20`) applies it once. `allocate` (`src/money.js:50-66`) makes its own rounding decision with the largest-remainder method.

These modules depend on that rule:
- **`src/tax.js`**: imports `multiply` and `roundHalfUp` (`:1`). `vatOn` uses `multiply` (`:21`), `netFromGross` uses `roundHalfUp` (`:31`), and `grossFromNet` goes through `vatOn` (`:26`).
- **`src/discounts.js`**: `percentOff` uses `multiply` (`:16`), which covers both percent and volume discounts (`:34`, `:41`).
- **`src/invoice.js`**: indirectly, through `applyDiscounts` in `lineNet` (`:41`) and `vatOn` in `invoiceTotals` (`:47`).
- **`src/report.js`**: indirectly, through `invoiceTotals` (`:16`) and `lineNet` (`:34`).
- **`src/index.js:1`**: re-exports `roundHalfUp` and `multiply`.

`src/csv.js` only imports `fromDecimal`, which never rounds; it rejects more than two decimal places.