Excellent! ✅ The refactoring is complete and all tests pass.

**Summary of changes:**

| File | Changes |
|---|---|
| `src/tax.js` | Renamed function definition from `vatOn` to `vatAmount` (line 20) and updated its call in `grossFromNet` (line 26) |
| `src/index.js` | Updated export from `vatOn` to `vatAmount` |
| `src/invoice.js` | Updated import and function call from `vatOn` to `vatAmount` |
| `test/tax.test.js` | Updated import and all test invocations from `vatOn` to `vatAmount` |
| `README.md` | Updated documentation reference from `vatOn` to `vatAmount` |

**Test results:** All 29 tests pass ✓
- The test name was also updated: "vatAmount rounds once" (previously "vatOn rounds once")
- No failures or errors