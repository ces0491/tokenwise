Excellent! All **51 tests pass**, including the 22 new credit note tests and all 29 existing tests. Here's a summary of what was implemented:

## Implementation Summary

### 1. **Created `src/creditnote.js`**
   - `createCreditNote({ id, invoice, issuedOn, lines, reason })` function
   - Validates all inputs per spec (id starts with `CN-`, non-empty reason, valid invoice, YYYY-MM-DD date)
   - Supports full credit (omit lines) or partial credit (specify lines with skus and quantities)
   - Calculates `netCents` as: `lineNet * qty / originalQty`, rounded once with `roundHalfUp`
   - Returns a frozen credit note with shape: `{ id, kind: 'credit', invoiceId, region, issuedOn, reason, lines }`

### 2. **Updated `src/invoice.js`**
   - Modified `invoiceTotals(doc)` to handle both invoices and credit notes
   - For credit notes: returns negative amounts (`net` = -sum of netCents, `vat` = -vatOn, `gross` = net + vat)

### 3. **Updated `src/report.js`**
   - `monthlySummary`: now processes credit notes by their `issuedOn` month, incrementing count and adding negative totals
   - `topSkus`: subtracts credited `qty` and `netCents` from SKU totals for credit notes

### 4. **Updated `src/index.js`**
   - Exported `createCreditNote` function

### 5. **Added comprehensive tests** in `test/creditnote.test.js`
   - 22 new tests covering:
     - Validation of all required fields (id, reason, issuedOn, invoice)
     - Full and partial credit scenarios
     - Rounding of netCents calculations
     - Error cases (duplicate SKUs, invalid quantities, unknown SKUs, empty lines)
     - Integration with `invoiceTotals`, `monthlySummary`, and `topSkus`
     - Immutability of original invoice

All requirements from the spec have been implemented exactly as specified, and the implementation passes all existing tests plus the new comprehensive test suite.