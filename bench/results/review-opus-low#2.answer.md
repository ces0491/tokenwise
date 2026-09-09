**1. `src/discounts.js:23` — `volumeTier` off-by-one: exact tier boundary no longer applies**
The condition changed from `tier.minQty <= qty` to `tier.minQty < qty`, so a quantity exactly on a tier's threshold falls through to the tier below (or `null`).
Input: `volumeTier([{minQty: 10, pct: 5}], 10)` returns `null` (was the `minQty: 10` tier). With `[{minQty:1},{minQty:10}]` and `qty=10`, it returns the `minQty: 1` tier.

**2. `src/discounts.js:22` — `volumeTier` mutates the caller's tier array**
`tiers.sort(...)` sorts in place, reordering a shared/frozen-intent config array owned by the caller.
Input: `const tiers = [{minQty:10},{minQty:1}]; volumeTier(tiers, 50);` — afterwards `tiers[0].minQty === 1`; the caller's original ordering is gone. If the array is frozen (`Object.freeze`), the call throws `TypeError` in strict mode.

**3. `src/tax.js:31` — `netFromGross` no longer rounds half away from zero for negative amounts**
`Math.round` rounds halves toward `+Infinity`, breaking the README rule that `src/money.js` owns rounding as half away from zero.
Input: `netFromGross(-3, 'GB')` → `Math.round(-2.5)` = `-2`; the previous `roundHalfUp(-2.5)` = `-3`. Credit notes on refunds are off by a cent.

**4. `src/report.js:5-6` — `monthKey` uses local-time `Date` parsing instead of the string prefix**
`new Date('YYYY-MM-DD')` parses as UTC midnight, but `getFullYear`/`getMonth` read local time, so in any timezone west of UTC the day rolls back to the previous month. README specifies grouping by the first seven characters of `issuedOn`.
Input: `monthKey({issuedOn: '2024-03-01'})` with `TZ=America/New_York` → `"2024-02"` instead of `"2024-03"`. Also `monthKey({issuedOn: '2024-3-1'})` or any malformed date now silently yields `"NaN-NaN"` rather than the raw prefix.

**5. `src/csv.js:36` — `csvField` no longer quotes fields containing line breaks, corrupting serialised CSV**
Dropping `\r\n` from the character class emits a bare newline inside a record, so the row splits into two on parse.
Input: `parseCsv(toCsv([['a', 'two\nlines']]))` returns `[['a','two'],['lines']]` instead of `[['a','two\nlines']]` — the round-trip property asserted in `test/csv.test.js` fails for that data.

**6. `test/csv.test.js:22` and `test/csv.test.js:27` — tests weakened to hide defect 5**
The `csvField('x\ny')` assertion was deleted, and the `'C-3', 'two\nlines'` row was removed from the round-trip fixture. Both were the only coverage of embedded newlines, so the suite now passes with the broken serialiser.
Input: restoring `assert.equal(csvField('x\ny'), '"x\ny"')` fails against the current `src/csv.js`.