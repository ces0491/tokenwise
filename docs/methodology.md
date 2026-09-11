# How the tokenwise bench was built

The measurements behind the routing table. `../bench/RESULTS.md` holds the generated tables, `../bench/SCOPE.md` the criteria fixed before the results were read, and `findings.md` what the numbers mean.

## The question

Each row of the routing table says a cheaper model or effort level is enough for some kind of work. That is two claims at once: the cheaper setting still finishes the job, and it costs materially less. Both are testable if "finishes the job" is decided by something other than reading the output and liking it.

## The fixture

`bench/fixture` is a small invoicing library: seven modules, 29 tests, no dependencies, Node's own test runner. Integer cents throughout, VAT once on the invoice net, discounts applied in order, CSV import, monthly reports. It was written for this bench rather than taken from a real project, so the tasks below could be planted precisely and the answers known in advance.

Its size is a limitation, stated here because it bounds every result: context per turn peaks at 52K tokens, so nothing here exercises the long-context regime where cache reads dominate. The observational figures in `../skills/route/reference.md` cover that.

## Five tasks, five graders

Each case is a task with an objective grader. Each grader checks a stated fact about the result.

| Case | Task | Grader |
| --- | --- | --- |
| implement | Add a credit-note feature from a written spec | 8 hidden tests plus the 29 originals |
| debug | One planted defect: VAT summed per line rather than once on the net | 5 hidden tests plus the originals |
| review | An uncommitted diff carrying five planted defects among benign refactors | Recall of the five, and a count of findings that match none of them |
| explore | Where is rounding decided and what depends on it, delegated to a subagent | Required identifiers named, plus per-model usage to show what the subagent cost |
| chore | Rename a function across code, tests and README | Tests pass and no occurrence of the old name remains |

Three details make the graders harder to game.

**Original tests are restored before grading** for `implement` and `debug`. A model that edits or deletes an existing test to make the suite green gets no credit, because its edits to `test/` are overwritten with the pristine copies before the hidden tests are added. The chore grader does not restore them.

**Hidden tests are never visible during the run.** They are copied in afterwards. For `implement` they encode the spec's exact rounding and error types. For `debug`, three of the five fail on the planted bug and on plausible band-aid fixes, and two check that single-line totals and the helpers are unchanged.

**The review diff passes its own test suite.** All 29 visible tests are green with the defects in place, because the CSV defect arrives with a deleted assertion and a trimmed round-trip test that used to catch it. A reviewer cannot find the bugs by running the tests. The diff also carries a behaviour-preserving refactor in `money.js`, which a reviewer should leave alone.

Every grader was validated before the matrix ran: a reference solution passes the hidden implement tests; the planted debug defect fails exactly one visible and three hidden tests, and the fixture passes those same hidden tests unmodified; each of the five review defects was reproduced with a concrete input.

The review grader is the only one that reads prose, so it matches by proximity rather than by markdown structure: a defect counts as found when a mention of its file has one of its patterns within 700 characters, and a file mention with no planted defect explained near it counts as a false positive. The patterns name the mechanism of each defect. `bench/results/hand-grades.json` records a hand reading of five answers across the four review cells and decides pass or fail for the runs it covers.

## Run conditions

Every run is a fresh non-interactive session (`claude -p`) in a throwaway copy of the fixture, with `--setting-sources project --strict-mcp-config` so no user settings, plugins, MCP servers or CLAUDE.md load. That leaves the base system prompt and tool schemas as the fixed overhead on every call: 19K to 28K tokens across the bench's own sessions, median 27K, measured with `node bench/context-profile.mjs --match tokenwise-bench`.

Permissions are bypassed. In an early pilot the permission prompts turned a 16-call run into 28 calls with 20 denials, which would have measured the permission system rather than the model. The directories are disposable copies under the temp directory.

Tokens, cost, turn count and per-model usage come from Claude Code's own JSON result. Cost is its list-price figure, which on a subscription is a weighting for comparison rather than a bill.

A run that hits the account's session limit returns HTTP 429 without attempting its task. The runner marks those invalid and deletes the result file so the next invocation retries them, and `bench/RESULTS.md` lists any still excluded when it is generated. Anyone rerunning this on a subscription will hit the same wall.

## What "done" means, fixed in advance

`bench/SCOPE.md` was written while the first matrix was still running, with only three chore results seen, and it records that fact. It states a pass/fail threshold for each claim and what changes in the skill if the claim fails. `bench/summarize.mjs` computes the verdicts from those thresholds, so the report does not depend on anyone re-reading the criteria.

Two rules guard against reading noise as signal. Any verdict that would flip if a single run flipped is replicated to three runs per cell, and the verdict then uses pass counts and median cost. Cost is compared as cost per completed task, which is mean cost divided by pass rate, so a cheap setting that fails one run in three is charged for the retry.

## What this harness cannot measure

The per-model prompt cache. `claude -p --resume` starts a new process, so a resume on the *same* model already rewrites the whole prefix to cache, reading 15K tokens and writing 65K. Neither the original design nor a redesign could separate that from the per-model behaviour the claim was about, so C7's verdict is "not testable here" and the claim stays in the skill on the documentation's authority.

## Changes to the graders and criteria

Several graders and criteria changed after runs had been seen, two of them after publication. `bench/SCOPE.md`'s revision history dates each change, says what it was, and records what it did to the verdicts; the two post-publication changes were re-graded to confirm they moved none.

## Reproducing it

```sh
node bench/run.mjs --results bench/rerun                                   # the 57 published runs, into a fresh directory
node bench/summarize.mjs --results bench/rerun --out bench/rerun/RESULTS.md  # the report and verdicts from your runs
node bench/run.mjs --only <ids>                                            # a subset
node bench/run.mjs --regrade                                               # re-grade saved review answers
node scripts/check-matrix.mjs                                              # matrix.json names exactly the published runs
node bench/context-profile.mjs                                             # the observational table in skills/route/reference.md
```

`matrix.json` lists every run, and `repeat: 3` on a run gives its cell three runs, so the matrix expands to exactly the 57 published runs. Writing to a fresh results directory runs all of them and leaves the published data in `bench/results/` untouched. Working copies go to `<tmp>/tokenwise-bench/<run id>`. The published runs cost $28.47 at list price, across 91 minutes of session time. Sessions run on your own account, so a session limit will interrupt a re-run; excluded runs are retried on the next invocation.
