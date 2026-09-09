# How the tokenwise bench was built

The measurements behind the routing table. `../bench/RESULTS.md` holds the generated tables, `../bench/SCOPE.md` the criteria fixed before the results were read, and `findings.md` what the numbers mean.

## The question

Each row of the routing table says a cheaper model or effort level is enough for some kind of work. That is two claims at once: the cheaper setting still finishes the job, and it costs materially less. Both are testable if "finishes the job" is decided by something other than reading the output and liking it.

## The fixture

`bench/fixture` is a small invoicing library: seven modules, 29 tests, no dependencies, Node's own test runner. Integer cents throughout, VAT once on the invoice net, discounts applied in order, CSV import, monthly reports. It was written for this bench rather than taken from a real project, so the tasks below could be planted precisely and the answers known in advance.

Its size is a limitation, stated here because it bounds every result: context per turn peaks at 52K tokens, so nothing here exercises the long-context regime where cache reads dominate. The observational figures in `../skills/route/reference.md` cover that.

## Five tasks, five graders

Each case is a task with an objective grader. No grader reads for quality; each one checks a fact.

| Case | Task | Grader |
| --- | --- | --- |
| implement | Add a credit-note feature from a written spec | 8 hidden tests plus the 29 originals |
| debug | One planted defect: VAT summed per line rather than once on the net | 5 hidden tests plus the originals |
| review | An uncommitted diff carrying five planted defects among benign refactors | Recall of the five, and a count of findings that match none of them |
| explore | Where is rounding decided and what depends on it, delegated to a subagent | Required identifiers named, plus per-model usage to show what the subagent cost |
| chore | Rename a function across code, tests and README | Tests pass and no occurrence of the old name remains |

Three details make the graders harder to game.

**Original tests are restored before grading.** A model that edits or deletes an existing test to make the suite green gets no credit, because its edits to `test/` are overwritten with the pristine copies before the hidden tests are added.

**Hidden tests are never visible during the run.** They are copied in afterwards. For `implement` they encode the spec's exact rounding and error types; for `debug` they fail both on the planted bug and on plausible band-aid fixes.

**The review diff passes its own test suite.** All 29 visible tests are green with the defects in place, because the CSV defect arrives with a pair of deleted assertions that used to catch it. A reviewer cannot find the bugs by running the tests. The diff also carries a behaviour-preserving refactor in `money.js`, which a reviewer should leave alone.

Every grader was validated before the matrix ran: a reference solution passes the hidden implement tests; the planted debug defect fails exactly one visible and three hidden tests, and the fixture passes those same hidden tests unmodified; each of the five review defects was reproduced with a concrete input.

## Run conditions

Every run is a fresh non-interactive session (`claude -p`) in a throwaway copy of the fixture, with `--setting-sources project --strict-mcp-config` so no user settings, plugins, MCP servers or CLAUDE.md load. That leaves the base system prompt and tool schemas as the fixed overhead on every call: 19K to 28K tokens across the bench's own sessions, median 27K, measured with `node bench/context-profile.mjs --match tokenwise-bench`.

Permissions are bypassed. In an early pilot the permission prompts turned a 16-call run into 28 calls with 20 denials, which would have measured the permission system rather than the model. The directories are disposable copies under the temp directory.

Tokens, cost, turn count and per-model usage come from Claude Code's own JSON result. Cost is its list-price figure; on a subscription that is a weighting for comparison, not a bill.

## What "done" means, fixed in advance

`bench/SCOPE.md` was written while the first matrix was still running, with only three chore results seen, and it records that fact. It states a pass/fail threshold for each claim and what changes in the skill if the claim fails. `bench/summarize.mjs` computes the verdicts from those thresholds, so the report does not depend on anyone re-reading the criteria.

Two rules guard against reading noise as signal. Any verdict that would flip if a single run flipped is replicated to three runs per cell, and the verdict then uses pass counts and median cost. Cost is compared as cost per completed task, which is mean cost divided by pass rate, so a cheap setting that fails one run in three is charged for the retry.

## Corrections made during the run

Three, all recorded in the scope file's revision history.

**A usage limit is not a task failure.** The first replication attempt hit the account's session limit and 23 runs returned HTTP 429 without attempting their task. The summariser initially counted them as failures, which produced zero-dollar medians and flipped several verdicts. The runner now marks such runs invalid and deletes their result file so they are retried, and the report carries a "Runs excluded" table listing any still excluded when it runs. All 23 completed on retry, so it currently reads "None".

**The false-positive rule was wrong.** Hand-reading the four review answers agreed with the keyword grader on every defect found and missed, but the grader charged false positives where the hand count was zero, because a defect explained across several paragraphs was counted once per paragraph. The rule now checks every planted defect against each block. Hand grades are recorded in `bench/results/hand-grades.json`, shown next to the grader's figures, and decide pass or fail for those runs.

**One claim proved untestable.** The per-model prompt cache cannot be measured through this harness. `claude -p --resume` starts a new process, so the control resume on the *same* model already rewrote the whole prefix, reading 15K tokens and writing 65K. A redesign failed too: by the time a later Sonnet resume ran, Sonnet had cached the conversation during an earlier switch. The verdict is "not testable here" and the claim stays in the skill on the documentation's authority, cited as documentation.

## Reproducing it

```sh
node bench/run.mjs                 # every run in matrix.json, skipping ones with results
node bench/run.mjs --repeat 3      # three runs per cell
node bench/run.mjs --only <ids>    # a subset
node bench/run.mjs --regrade       # re-grade saved review answers
node bench/summarize.mjs           # rebuild RESULTS.md
node bench/context-profile.mjs     # the observational table in skills/route/reference.md
```

Runs write to `<tmp>/tokenwise-bench/<run id>`. The full matrix at three runs per cell is roughly $30 at list price and about ninety minutes at two concurrent sessions. Sessions run on your own account, so a session limit will interrupt it; excluded runs are retried on the next invocation.
