Perfect! ✅ The refactoring is complete and all tests pass.

**Summary of changes:**

| File | Changes |
|---|---|
| `src/tax.js` | Renamed function definition `vatOn` → `vatAmount`; updated call in `grossFromNet` |
| `src/index.js` | Updated export from `vatOn` → `vatAmount` |
| `src/invoice.js` | Updated import and function call in `invoiceTotals` |
| `test/tax.test.js` | Updated import, test name, and all 5 function calls |
| `README.md` | Updated module table documentation |

**Test results:** All 29 tests pass, including the renamed "vatAmount rounds once" test. ✓