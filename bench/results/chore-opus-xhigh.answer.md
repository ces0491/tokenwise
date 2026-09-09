Renamed `vatOn` → `vatAmount` in all 5 files that referenced it:

- `src/tax.js` — definition plus the internal call in `grossFromNet`
- `src/index.js` — public re-export
- `src/invoice.js` — import and call site
- `test/tax.test.js` — import, test name, and 5 assertions
- `README.md` — the `src/tax.js` row in the modules table

`grep` for `vatOn` (including case variants and `vat_on` / "vat on") returns nothing. `npm test` passes: 29 tests, 0 failures.