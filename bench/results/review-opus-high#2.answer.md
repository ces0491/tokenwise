All findings verified by running the code. Six defects.

---

**1. `src/discounts.js:25` — volume tier boundary is now exclusive**

`if (tier.minQty < qty)` should be `<=`. The docstring at `src/discounts.js:8` states the rule: "applies the highest tier whose minQty is less than or equal to the quantity". A quantity sitting exactly on a tier boundary now falls through to the tier below, or to no discount at all.

```js
const tiers = [{ minQty: 10, percent: 5 }, { minQty: 50, percent: 12 }];
volumeTier(tiers, 10)                                  // → null   (expected {minQty:10,percent:5})
applyDiscount(10000, { type: 'volume', tiers }, 10)    // → 10000  (expected 9500)
lineNet({ sku:'A', qty:50, unitCents:100, discounts:[{type:'volume',tiers}] })
                                                       // → 4750   (expected 4400 — got the 5% tier, not 12%)
```

---

**2. `src/discounts.js:22` — `tiers.sort()` mutates the caller's array**

`sort` is in-place on the array handed in by the caller. `applyDiscount` passes `discount.tiers` straight through, and `createInvoice` copies lines shallowly, so the array reached is the caller's own object. Two consequences: the caller's tier order is silently rewritten, and a frozen tiers array throws.

```js
const line = { sku:'A', qty:60, unitCents:100,
  discounts:[{ type:'volume', tiers:[{minQty:50,percent:12},{minQty:10,percent:5}] }] };
lineNet(line);
line.discounts[0].tiers  // → [{minQty:10,…},{minQty:50,…}] — reordered in the caller's object

const frozen = Object.freeze([{minQty:50,percent:12},{minQty:10,percent:5}]);
applyDiscount(10000, { type:'volume', tiers: frozen }, 60);
// TypeError: Cannot assign to read only property '0' of object '[object Array]'
```

---

**3. `src/csv.js:37` — fields containing newlines are no longer quoted, producing malformed CSV**

Dropping `\r\n` from the test regex means `toCsv` emits a raw line break inside a field, splitting one row into two. `parseCsv` still handles quoted newlines (`src/csv.js:5`, and the surviving test at `test/csv.test.js:15`), so output and input no longer agree.

```js
csvField('x\ny')                                              // → 'x\ny'  (expected '"x\ny"')
parseCsv(toCsv([['sku','description'], ['C-3','two\nlines']]))
// → [['sku','description'], ['C-3','two'], ['lines']]   — 3 rows, field count wrong
```

---

**4. `test/csv.test.js:22, 26` — the two assertions covering defect 3 were deleted**

`assert.equal(csvField('x\ny'), '"x\ny"')` was removed from `csvField quotes only when needed`, and the `['C-3', 'two\nlines']` row was removed from the `toCsv round-trips through parseCsv` fixture. These were the only assertions exercising newline-in-field serialisation; with them gone the suite reports 29/29 passing against the broken `csvField`. Restoring either line fails.

---

**5. `src/tax.js:31` — `Math.round` breaks the half-away-from-zero rule for negative amounts**

README: "`src/money.js` owns rounding: half away from zero." `Math.round` breaks ties toward `+∞`, so negative gross amounts (credit notes, refunds) round the wrong way. The `roundHalfUp` import was removed at `src/tax.js:1`.

```js
netFromGross(-3, 'GB')       // → -2   (-3/1.2 = -2.5 exactly; roundHalfUp gives -3)
```

---

**6. `src/report.js:5-6` — `monthKey` is timezone-dependent**

README: "Monthly reports group by the first seven characters of `issuedOn`." `new Date('YYYY-MM-DD')` parses as UTC midnight, but `getFullYear`/`getMonth` read local time, so in any zone west of UTC the first day of a month lands in the previous month. Invoices then aggregate into the wrong bucket in `monthlySummary`.

```js
// TZ=America/New_York
monthKey({ issuedOn: '2024-03-01' })   // → '2024-02'  (expected '2024-03')
```

Verified by running node with `TZ=America/New_York`. The existing tests don't catch it because no test date is the 1st of a month — `test/report.test.js` uses the 5th, 20th and 10th.