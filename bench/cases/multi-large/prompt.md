This repository needs three things done. They are independent of each other.

1. Implement the credit notes feature specified in docs/spec.md. Follow the spec exactly: file names, exports, error types and rounding rules. Add tests for it under test/ and run npm test until everything passes. Do not change existing tests.
2. Review the changes on the branch review-me against main (`git diff main...review-me`) for defects: behaviour that is wrong, tests that were weakened, and changes that break documented rules in README.md. For each defect give the file and line, what goes wrong, and a concrete input that shows it. Do not change that branch and do not comment on style.
3. Where is monetary rounding decided in this codebase, and which modules depend on that decision? Answer in under 150 words with file:line references.

Leave main checked out when you finish. End with one answer in three sections headed exactly `## Implement`, `## Review` and `## Rounding`. Under Implement, say in two sentences what you built. Under Review, one block per defect, nothing else.
