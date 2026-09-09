Rename done. `vatOn` → `vatAmount` across 5 files, 13 occurrences:

- `src/tax.js:20` — the definition, plus the internal call at line 26 in `grossFromNet`
- `src/index.js:2` — the public re-export
- `src/invoice.js` — the import at line 2 and the call at line 47
- `test/tax.test.js` — import, test name, and 5 assertions
- `README.md:21` — the file-summary table entry

No occurrences remain, and there was no pre-existing `vatAmount` to collide with. `npm test` passes: 29 tests, 0 failures.

Nothing else in the README describes this function beyond that table row, so no other doc updates were needed. Changes are unstaged — no commit made.