**`src/discounts.js:25` — volume tier boundary is now exclusive**

`if (tier.minQty < qty)` should be `<=`. Both the module docstring (`src/discounts.js:8`, "the highest tier whose minQty is less than or equal to the quantity") and the README discount rule are broken at the boundary, and the tier one step up is selected for any quantity in between.

```js
const tiers = [{ minQty: 10, percent: 5 }, { minQty: 50, percent: 12 }];
volumeTier(tiers, 10)                                   // null      — expected { minQty: 10, percent: 5 }
applyDiscount(1000, { type: 'volume', tiers }, 10)      // 1000      — expected 950
volumeTier(tiers, 50)                                   // { minQty: 10, ... } — expected { minQty: 50, ... }
```

A customer ordering exactly the tier-threshold quantity gets no discount; one ordering exactly 50 gets 5% instead of 12%. The existing test at `test/discounts.test.js:15` only probes 9, 12, 20 and 100, so the boundary is untested and the suite still passes.

---

**`src/discounts.js:22` — `volumeTier` sorts the caller's array in place**

`tiers.sort(...)` mutates the argument rather than working on a copy. Two consequences:

```js
const caller = [{ minQty: 50, percent: 12 }, { minQty: 10, percent: 5 }];
volumeTier(caller, 20);
caller.map(t => t.minQty)   // [10, 50] — caller's ordering silently rewritten

volumeTier(Object.freeze([{ minQty: 50, percent: 12 }, { minQty: 10, percent: 5 }]), 20);
// TypeError: Cannot assign to read only property '0' of object '[object Array]'
```

A discount definition reused across lines or invoices is reordered by the first lookup, and a frozen tier table — the natural shape for a shared rate config, matching `Object.freeze` use in `src/tax.js:4` and `createInvoice` at `src/invoice.js:55` — throws.

---

**`src/csv.js:37` — fields containing a newline are no longer quoted, corrupting output**

Dropping `\r\n` from the character class means `toCsv` emits a raw line break inside a field, which `parseCsv` then reads as a row boundary. The round trip loses data and shifts every following column.

```js
csvField('two\nlines')                       // 'two\nlines'  — expected '"two\nlines"'
const rows = [['sku', 'description'], ['A-1', 'two\nlines']];
parseCsv(toCsv(rows))                        // [['sku','description'], ['A-1','two'], ['lines']]
                                             // expected the original two rows
```

`parseCsv` still handles embedded newlines correctly (`src/csv.js:5`, and the test at `test/csv.test.js:15`), so the writer and reader now disagree. A `description` field with a line break — the exact case `linesFromCsv` consumes — produces a malformed row that fails or mis-parses on re-import. Carriage return is affected identically: `csvField('a\rb')` returns `'a\rb'` unquoted.

---

**`test/csv.test.js:22` and `test/csv.test.js:26` — assertions removed rather than the bug fixed**

The two cases that covered the behaviour above were deleted: `assert.equal(csvField('x\ny'), '"x\ny"')` from the quoting test, and the `['C-3', 'two\nlines']` row from the round-trip test. Both fail against the current `csvField`. Restoring either line turns the suite red; with them gone all 29 tests pass while the serialiser is broken, and the docstring at `src/csv.js:6` still promises newline handling.

---

**`src/tax.js:31` — `netFromGross` rounds half-to-even-toward-`+∞`, not half away from zero**

`Math.round` replaces `roundHalfUp`, and the two differ on a negative exact half. The README states `src/money.js` owns rounding, half away from zero; `roundHalfUp` is now dropped from the import at `src/tax.js:1`.

```js
netFromGross(-3, 'GB')      // -2   (-3 / 1.2 === -2.5, Math.round(-2.5) === -2)
roundHalfUp(-3 / 1.2)       // -3
```

Every other money path (`multiply`, `vatOn`, `percentOff`, `allocate`) still rounds away from zero, so a credit note or refund routed through `netFromGross` is off by one cent against the same figure computed via `grossFromNet`, and the sign asymmetry means net→gross→net is no longer a stable pair for negative amounts. The test at `test/tax.test.js:26` uses only positive, exactly-divisible values, so it does not exercise the difference.

---

**`src/report.js:5-6` — `monthKey` is timezone-dependent and disagrees with the documented rule**

The README states monthly reports group by the first seven characters of `issuedOn`. `new Date('2026-03-01')` parses a date-only string as UTC midnight, while `getFullYear`/`getMonth` read local time. In any timezone behind UTC the date rolls back a day, and month-start dates land in the previous month.

```js
// TZ=America/New_York
monthKey({ issuedOn: '2026-03-01' })   // '2026-02' — expected '2026-03'
monthlySummary([{ id: 'A', region: 'ZA', issuedOn: '2026-03-01',
                  lines: [{ sku: 'A', qty: 2, unitCents: 500 }] }])
// keys: ['2026-02'] — the invoice is booked to the wrong month
```

Every first-of-month invoice moves into the prior period, so month boundaries and totals are wrong for US-hosted runs; `2026-01-01` falls into `2025-12`, crossing the year. The suite passes on a UTC+2 machine and would fail on a UTC-5 one, making the result depend on where the report runs. `getFullYear()` is also unpadded, so a year below 1000 yields a key shorter than `YYYY-MM`, which the string sort at `src/report.js:25` orders incorrectly.