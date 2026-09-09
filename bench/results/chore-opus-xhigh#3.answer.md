Renamed `vatOn` → `vatAmount` in all 5 files that referenced it:

- `src/tax.js:20` — the definition; `src/tax.js:26` — internal call from `grossFromNet`
- `src/index.js:2` — public re-export
- `src/invoice.js:2,47` — import and call site
- `test/tax.test.js` — import, test name, and 5 assertions
- `README.md:21` — the module table entry

No occurrences remain, and no pre-existing `vatAmount` symbol was shadowed. `npm test` passes: 29 tests, 0 failures.