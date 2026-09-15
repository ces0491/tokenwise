This repository needs three things done. They are independent of each other.

1. npm test fails. Find the root cause and fix it in src/. Do not modify anything under test/. Run npm test to confirm.
2. Review the changes on the branch review-me against main (`git diff main...review-me`) for defects: behaviour that is wrong, tests that were weakened, and changes that break documented rules in README.md. For each defect give the file and line, what goes wrong, and a concrete input that shows it. Do not change that branch and do not comment on style.
3. Where is monetary rounding decided in this codebase, and which modules depend on that decision? Answer in under 150 words with file:line references.

Leave main checked out when you finish. End with one answer in three sections headed exactly `## Fix`, `## Review` and `## Rounding`. Under Fix, say in two sentences what was wrong. Under Review, one block per defect, nothing else.
