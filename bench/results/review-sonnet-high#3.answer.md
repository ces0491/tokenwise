All confirmed against the running code.

**src/csv.js:34-38 — `csvField` no longer quotes newlines**
`csvField` was narrowed from `/[",\r\n]/` to `/[",]/`, so a field containing `\n` or `\r` is emitted unquoted. `toCsv` joins rows with `\n`, so an embedded newline is indistinguishable from a row separator on the way back out. Concrete input: `toCsv([['line1\nline2']])` → `"line1\nline2\n"`, which `parseCsv` reads back as two rows `[['line1'], ['line2']]` instead of the original single row/field. This also contradicts `parseCsv`'s own doc comment (csv.js:5) that the module round-trips "commas and newlines inside quotes."

**test/csv.test.js:19-25 — weakened tests hide the csvField/toCsv newline bug**
The assertion `assert.equal(csvField('x\ny'), '"x\ny"')` was deleted, and the `'C-3', 'two\nlines'` row was removed from the round-trip test. These were exactly the cases that would have caught the regression above; with them gone, `npm test` passes despite CSV serialisation being broken for any field containing a newline.

**src/discounts.js:20-28 — `volumeTier` boundary changed from `<=` to `<`, contradicting its own docstring**
The module comment (discounts.js:8) and function comment both say a tier applies when "minQty is less than or equal to" qty, but the loop now uses `tier.minQty < qty`. Concrete input: `volumeTier([{ minQty: 10, percent: 5 }], 10)` now returns `null` instead of the tier, so `applyDiscount(1000, { type: 'volume', tiers: [{ minQty: 10, percent: 5 }] }, 10)` returns `1000` (no discount) instead of `950`.

**src/discounts.js:22 — `volumeTier` mutates the caller's `tiers` array**
`tiers.sort(...)` sorts in place rather than on a copy, silently reordering the discount configuration object passed in by the caller (e.g. a line's `discounts[i].tiers`) as a side effect of merely computing a tier.

**src/report.js:4-7 — `monthKey` no longer matches the documented "first seven characters" rule and is timezone-dependent**
README.md:14 states "Monthly reports group by the first seven characters of `issuedOn`." The new implementation parses `issuedOn` with `new Date(...)` (interpreted as UTC midnight) and then reads it back with local-timezone getters (`getFullYear`/`getMonth`). Concrete input: in a UTC-negative timezone (e.g. US Eastern, UTC-5), `monthKey({ issuedOn: '2026-03-01' })` returns `'2026-02'` instead of `'2026-03'`, because `2026-03-01T00:00:00Z` local-converts to `2026-02-28T19:00:00`.

**src/tax.js:29-31 — `netFromGross` uses `Math.round` instead of `roundHalfUp`, breaking the "half away from zero" rounding rule**
README.md:11 states rounding is half-away-from-zero and owned by `src/money.js`, applied once. `netFromGross` now rounds with plain `Math.round`, which for negative ties rounds toward +Infinity rather than away from zero. Concrete input: `netFromGross(-3, 'GB')` computes `-3 / 1.2 = -2.5`; `Math.round(-2.5)` gives `-2`, but `roundHalfUp(-2.5)` (and the documented rule) gives `-3` — a real discrepancy for negative gross amounts such as credit notes/refunds.