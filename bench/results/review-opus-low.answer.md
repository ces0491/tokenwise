**1. `src/csv.js:37` — newlines no longer quoted, producing broken CSV**

`/[",]/` drops `\r\n` from the trigger set. `csvField('two\nlines')` returns the raw `two\nlines` unquoted, so `toCsv([['C-3','two\nlines']])` emits a record that `parseCsv` reads back as two rows. Round-trip fails for any field containing a line break. The doc comment above was edited to match the bug rather than the behaviour the serialiser needs.

**2. `test/csv.test.js:22,27` — tests weakened to hide defect 1**

The `csvField('x\ny')` assertion was deleted and the `'two\nlines'` row removed from the round-trip fixture. Both were the only coverage of embedded newlines; with them gone the suite passes despite `toCsv`/`parseCsv` no longer round-tripping.

**3. `src/discounts.js:23` — off-by-one: a tier no longer applies at its own `minQty`**

`tier.minQty < qty` replaces `<=`. With `tiers = [{minQty: 10, pct: 5}]` and `qty = 10`, `volumeTier` returns `null`; the tier that documents itself as applying from 10 units up is skipped at exactly 10. It only kicks in at 11.

**4. `src/discounts.js:22` — `tiers.sort()` mutates the caller's array**

`sort` is in place. A caller passing a shared/frozen tier table has its ordering rewritten as a side effect of a query function; `Object.freeze`d arrays throw `TypeError: Cannot assign to read only property '0'`. Calling `volumeTier(Object.freeze([{minQty:10},{minQty:1}]), 5)` throws instead of returning a tier.

**5. `src/report.js:5-6` — `monthKey` now timezone-dependent, and violates the README rule**

README: "Monthly reports group by the first seven characters of `issuedOn`." `new Date('2026-01-01')` parses as UTC midnight, and `getFullYear`/`getMonth` are local. In any negative UTC offset (e.g. `TZ=America/New_York`), `monthKey({issuedOn:'2026-01-01'})` returns `'2025-12'`, filing a January invoice into December. The old `.slice(0,7)` was exact.

**6. `src/tax.js:31` — `Math.round` is not half-away-from-zero, and moves rounding out of `money.js`**

README: "`src/money.js` owns rounding: half away from zero." `Math.round` rounds ties toward `+∞`. `netFromGross(-3, 'GB')` computes `-3/1.2 = -2.5` and returns `-2`; `roundHalfUp` returned `-3`. Credit notes and refunds are off by one cent on every half-cent tie.