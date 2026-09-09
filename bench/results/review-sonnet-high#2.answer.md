**File**: `src/csv.js:34-37` (`csvField`)
**Defect**: The quoting regex was narrowed from `/[",\r\n]/` to `/[",]/`, so fields containing a line break are no longer quoted, but `parseCsv` still treats a bare `\n`/`\r` as a row terminator (`src/csv.js:24-27`). Serialising and re-parsing a value with an embedded newline now silently corrupts the data.
**Concrete input**: `toCsv([['sku', 'x\ny']])` produces `"sku,x\ny\n"`; `parseCsv` of that output yields `[['sku','x'],['y']]` — two rows instead of the original one, and the second row is missing the `sku` column entirely.

**File**: `test/csv.test.js:18-28`
**Defect**: The test that asserted `csvField('x\ny')` quotes the value, and the `'two\nlines'` entry in the `toCsv`/`parseCsv` round-trip test, were both deleted. This removes the only coverage of the newline-quoting behavior, so the regression in `src/csv.js:34-37` above passes the suite undetected.

**File**: `src/discounts.js:20-27` (`volumeTier`)
**Defect**: The tier match condition was changed from `tier.minQty <= qty` to `tier.minQty < qty`, contradicting the function's own documented contract at line 8: "A volume discount applies the highest tier whose minQty is less than or equal to the quantity." A quantity exactly equal to a tier's threshold no longer qualifies for that tier.
**Concrete input**: `volumeTier([{ minQty: 10, percent: 5 }], 10)` now returns `null` instead of the `{ minQty: 10, percent: 5 }` tier, so a line with `qty: 10` gets no volume discount even though the documented rule says it should.

**File**: `src/report.js:4-7` (`monthKey`)
**Defect**: `monthKey` now parses `issuedOn` with `new Date(...)` and reads `getFullYear()`/`getMonth()` (local time), instead of slicing the string as README.md documents: "Monthly reports group by the first seven characters of `issuedOn`." Since `new Date('YYYY-MM-DD')` is parsed as UTC midnight but `getFullYear`/`getMonth` read local time, the result depends on the host timezone.
**Concrete input**: on a host set to a timezone behind UTC (e.g. `America/New_York`, UTC-5), `monthKey({ issuedOn: '2026-03-01' })` returns `'2026-02'` instead of `'2026-03'`, silently misfiling the invoice into the wrong month in `monthlySummary`.

**File**: `src/tax.js:29-32` (`netFromGross`)
**Defect**: Rounding was switched from `roundHalfUp` (half away from zero, per README.md: "`src/money.js` owns rounding: half away from zero, applied once at the end of a calculation") to bare `Math.round`, which rounds half-ties toward positive infinity rather than away from zero. This also bypasses `money.js` as the sole owner of rounding.
**Concrete input**: `netFromGross(-3, 'GB')` (rate 0.2, so `-3 / 1.2 = -2.5` exactly) returns `-2` with `Math.round`, but the documented half-away-from-zero rule requires `-3`.