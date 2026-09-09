Six defects, all verified by running the code. Nothing changed in the working tree.

---

**`src/csv.js:37` — `csvField` no longer quotes line breaks, so `toCsv` output no longer round-trips**

The character class dropped `\r\n`. `parseCsv` still treats a bare `\n` or `\r` as a row terminator (`src/csv.js:24`), so any field containing a newline is emitted unquoted and re-parses as a row split.

```
toCsv([['sku','description'], ['C-3','two\nlines']])
  -> "sku,description\nC-3,two\nlines\n"
parseCsv(that) -> [["sku","description"],["C-3","two"],["lines"]]
```

Expected three fields in two rows; got a 2-field row and a 1-field row. `csvField('x\ny')` returns `x\ny` instead of `"x\ny"`. Same for `\r`: `toCsv([['a\rb']])` re-parses as two rows. This also contradicts the function's own remaining contract in `src/csv.js:5`, which still advertises "commas and newlines inside quotes".

---

**`test/csv.test.js:22` and `test/csv.test.js:26` — the two assertions that caught the above were deleted**

`assert.equal(csvField('x\ny'), '"x\ny"')` was removed from the `csvField` test, and the `['C-3', 'two\nlines']` row was removed from the round-trip fixture. Those were the only newline cases in the suite. With them gone the full suite passes (29/29) against the broken `csvField`; restoring either line fails it. The test name `csvField quotes only when needed` and `toCsv round-trips through parseCsv` still claim coverage the test no longer has.

---

**`src/discounts.js:25` — `tier.minQty < qty` excludes the boundary quantity, contradicting the documented `<=`**

The doc comment at `src/discounts.js:8` says "the highest tier whose minQty is less than or equal to the quantity". Strict `<` means a quantity exactly equal to a tier's `minQty` never selects that tier.

```
volumeTier([{minQty:10,percent:5},{minQty:50,percent:12}], 10)  -> null           (expected the 5% tier)
volumeTier([{minQty:10,percent:5},{minQty:50,percent:12}], 50)  -> {minQty:10,percent:5}  (expected the 12% tier)
```

Through the public path, a line at exactly the tier threshold is charged full price:

```
lineNet({sku:'A', qty:10, unitCents:1000,
         discounts:[{type:'volume', tiers:[{minQty:10, percent:5}]}]})
  -> 10000   (expected 9500)
```

At `qty:50` the customer silently gets the 5% tier instead of 12%. The existing test only probes 9, 12, 20 and 100 — never a boundary value — which is why this passes.

---

**`src/discounts.js:22` — `tiers.sort(...)` mutates the caller's array in place**

`Array.prototype.sort` sorts in place, and `tiers` here is the caller's own array, reached via `discount.tiers` at `src/discounts.js:42`. A tier list held on a discount object is reordered as a side effect of reading it:

```
const CONFIG = [{minQty:50,percent:12},{minQty:10,percent:5}];
volumeTier(CONFIG, 60);
CONFIG  -> [{minQty:10,percent:5},{minQty:50,percent:12}]   // caller's array reordered
```

On a frozen tier table — plausible given `Object.freeze` is already used for `VAT_RATES` (`src/tax.js:4`) and for invoices in `createInvoice` (`src/invoice.js:55`) — it throws outright:

```
volumeTier(Object.freeze([{minQty:50,percent:12},{minQty:10,percent:5}]), 60)
  -> TypeError: Cannot assign to read only property '0' of object '[object Array]'
```

---

**`src/tax.js:31` — `Math.round` is half-up toward +∞, not half away from zero**

README states `src/money.js` owns rounding and that it is half away from zero. The import of `roundHalfUp` was dropped and replaced with `Math.round`, which differs on negative halves — reachable on credit notes and refunds:

```
netFromGross(-3, 'GB')  -> -2     (exact -2.5; half away from zero is -3)
```

Larger case: `netFromGross(-199995, 'GB')` returns `-166662` where `roundHalfUp` gives `-166663`. The replacement comment "Plain rounding is enough here" asserts an equivalence that does not hold for negative inputs. `cents()` accepts negative integers, so nothing upstream blocks these.

---

**`src/report.js:5-6` — `monthKey` now parses through `Date` and reads local-time fields, so the month shifts west of UTC**

`new Date('2026-03-01')` parses a date-only string as **UTC** midnight, but `getFullYear`/`getMonth` return **local** components. In any timezone with a negative UTC offset the key rolls back to the previous day, and at a month boundary to the previous month.

Run with `TZ=America/New_York`:

```
monthKey({issuedOn: '2026-03-01'})  -> '2026-02'   (expected '2026-03')
monthKey({issuedOn: '2026-01-01'})  -> '2025-12'   (expected '2026-01', wrong year too)
```

This breaks the README rule "Monthly reports group by the first seven characters of `issuedOn`", and it silently misfiles first-of-month invoices into the prior period in `monthlySummary` (`src/report.js:16`), including across a year boundary. The existing test uses `'2026-03-15'`, a mid-month date that survives the shift, and the developer machine here is UTC+2, so the suite passes locally while failing for any US-based run.