# How the tokenwise bench was built

The measurements behind the routing table. `../bench/RESULTS.md` holds the generated tables, `../bench/SCOPE.md` the criteria fixed before the results were read, and `findings.md` what the numbers mean.

## The question

Each row of the routing table says a cheaper model or effort level is enough for some kind of work. That is two claims at once: the cheaper setting still finishes the job, and it costs materially less. Both are testable if "finishes the job" is decided by something other than reading the output and liking it.

## The fixture

`bench/fixture` is a small invoicing library: seven modules, 29 tests, no dependencies, Node's own test runner. Integer cents throughout, VAT once on the invoice net, discounts applied in order, CSV import, monthly reports. It was written for this bench rather than taken from a real project, so the tasks below could be planted precisely and the answers known in advance.

Its size bounds every result: no graded run averaged more than 72K tokens of context per turn, so nothing here exercises the long-context regime, over 100K tokens per call. The observational figures in `../skills/route/reference.md` cover that.

## Five tasks, five graders

Each case pairs a task with a grader that checks a stated fact about the result.

| Case | Task | Grader |
| --- | --- | --- |
| implement | Add a credit-note feature from a written spec | 8 hidden tests plus the 29 originals |
| debug | One planted defect: VAT summed per line rather than once on the net | 5 hidden tests plus the originals |
| review | An uncommitted diff carrying five planted defects among benign refactors | Recall of the five, and a count of findings that match none of them |
| explore | Where is rounding decided and what depends on it, delegated to a subagent | Required identifiers named, plus per-model usage to show what the subagent cost |
| chore | Rename a function across code, tests and README | The original tests, with the rename applied, pass against the model's code; no original test file is deleted; no occurrence of the old name remains |

Three details make the graders harder to game.

**Original tests are restored before grading.** A model that edits an existing test to make the suite green gets no credit, because its edits to `test/` are overwritten with the pristine copies. For `implement` and `debug` the hidden tests are added after that. The chore task renames a function the tests call, so its grader restores the originals with the rename applied, and a run that deleted an original test file fails.

**Hidden tests are never visible during the run.** They are copied in afterwards. For `implement` they encode the spec's exact rounding and error types. For `debug`, three of the five fail on the planted bug and on plausible band-aid fixes, and two check that single-line totals and the helpers are unchanged.

**The review diff passes its own test suite.** All 29 visible tests are green with the defects in place, because the CSV defect arrives with a deleted assertion and a trimmed round-trip test that used to catch it. A reviewer cannot find the bugs by running the tests. The diff also carries a behaviour-preserving refactor in `money.js`, which a reviewer should leave alone.

The implement, debug and review graders were validated before the matrix ran, and `bench/graders.test.mjs` repeats the implement and debug checks in CI: a reference solution passes the hidden implement tests; the planted debug defect fails exactly one visible and three hidden tests, and the fixture passes those same hidden tests unmodified; each of the five review defects was reproduced with a concrete input.

The review grader is the only one that reads prose. It splits an answer into findings, each starting on a line that leads with a code file:line reference, which the prompt asks for and every saved answer gives. A defect counts as found when a finding on its file contains one of the defect's patterns, and a finding that matches no planted defect counts as a false positive. The patterns name the mechanism of each defect, such as `<=`, `Math.round` or a newline, rather than words any mention of the file might use. `bench/results/hand-grades.json` records a hand reading of five answers across the four review cells and decides pass or fail for the runs it covers. `bench/graders.test.mjs` holds answers built to game the grader: file names next to vague words, one finding credited for two defects, fabricated findings. It also checks that every saved answer keeps its grade.

## Run conditions

Every run is a fresh non-interactive session (`claude -p`) in a throwaway copy of the fixture, with `--setting-sources project --strict-mcp-config` so no user settings, plugins, MCP servers or CLAUDE.md load. The `multi` and `multi-large` runs are the exception: each loads the plugin with the `ultratoken` hook and worker agents staged in (`experiments/ultratoken/`), whether or not its prompt uses the keyword, so the two arms of C10 and C11 carry the same context. That leaves the base system prompt and tool schemas as the fixed overhead on every call: 19K to 28K tokens across the bench's own sessions, median 27K, measured with `node bench/context-profile.mjs --match tokenwise-bench`.

Permissions are bypassed. In an early pilot the permission prompts turned a 16-call run into 28 calls with 20 denials, which would have measured the permission system rather than the model. The directories are disposable copies under the temp directory.

Tokens, cost, turn count and per-model usage come from Claude Code's own JSON result. Cost is its list-price figure, which on a subscription is a weighting for comparison rather than a bill.

A run that hits the account's session limit returns HTTP 429 without attempting its task. The runner marks those invalid and deletes the result file so the next invocation retries them, and `bench/RESULTS.md` lists any still excluded when it is generated. A re-run on a subscription can hit the same limit. A run killed at its timeout or stopped by its budget cap (25 minutes and $6 by default, higher for the ultracode and multi cells in `bench/matrix.json`) did attempt its task, so it counts as a failure instead. None of the published runs hit either.

## What "done" means, fixed in advance

`bench/SCOPE.md` was written while the first matrix was still running, with only three chore results seen, and it records that fact. It states a pass/fail threshold for each claim and what changes in the skill if the claim fails. `bench/summarize.mjs` computes the verdicts from those thresholds, so the report does not depend on anyone re-reading the criteria.

Two rules guard against reading noise as signal. Any verdict that would flip if a single run flipped is replicated to three runs per cell, and the verdict then uses pass counts and median cost. Cost is compared as cost per completed task, which is mean cost divided by pass rate, so a cheap setting that fails one run in three is charged for the retry.

## What this harness cannot measure

The per-model prompt cache. `claude -p --resume` starts a new process, so a resume on the *same* model already rewrites the whole prefix to cache, reading 15K tokens and writing 65K. Neither the original design nor a redesign could separate that from the per-model behaviour the claim was about, so C7's verdict is "not testable here" and the claim stays in the skill on the documentation's authority.

How an ultracode run's cost splits between the orchestrating session and its workflow agents. The agents run on the session's model, so per-model usage merges them with the main loop. An ultracode run records its stream, reduced to tool names and usage, which shows whether the session was offered the Workflow tool and how often it called it. Its per-model usage less the main loop's own usage gives the tokens spent outside the main loop, and that figure includes Claude Code's internal calls as well as the agents. The bench's tasks are small, so C9 tests whether ultracode costs more than `xhigh` on tasks that size. Whether it pays on work that splits into context-sized parts is out of its reach.

## Changes to the graders and criteria

Several graders and criteria changed after runs had been seen, some of them after publication. `bench/SCOPE.md`'s revision history dates each change, says what it was, and records what it did to the verdicts; no post-publication change moved one. Review and explore answers are saved, so a change to those graders is re-graded against every published run with `--regrade`. The tests, chore and plan graders read the run's working copy, which is not kept, so a change to one of them applies to new runs, and the revision history says what was checked about the published runs instead.

## What the skill itself costs

The single-job task runs load no plugins, so their costs leave out the skill. `bench/skill-cost.mjs` measures it in sessions of its own. Each is a `claude -p` process in a fresh copy of the fixture, on Opus 5 at xhigh effort unless noted, with the plugin loaded from the repository, and feeds its messages over stream-json one turn at a time, so later turns read the prompt cache the way an interactive session does.

| Session | Messages | What it shows |
| --- | --- | --- |
| no-plugin | "Reply with OK." | The context a session starts with, without the plugin |
| idle | "Reply with OK." twice | The context the plugin adds while never used |
| invoked | a route, "Reply with OK.", a second route, "Reply with OK." | What a routing turn costs, what stays in context after it, and what a second route adds |
| unprompted | a plain question about which model and effort to use, "Reply with OK." | Whether Claude runs the skill unasked, and what that leaves behind |
| mention | a question about how many tokens the session has used, "Reply with OK." | Whether the skill runs when nobody asked for a route |
| no-description | `/tokenwise:route` with nothing after it, "Reply with OK." | What the forked skill does with nothing to route |

Context per call comes from each API call's usage, and each turn's output, thinking and cost from the result Claude Code writes when the turn ends, subagents included. Transcripts keep only those, with working directories, session ids and local paths removed, and each records a hash of the SKILL.md it ran against. The idle and mention sessions depend only on the skill's name and description, so versions that change neither reuse them. Each case ran once per version and variant (1.1.0 ran with and without the fork), except: the 1.1.1 routing sessions ran a second time on identical text (`1.1.1-r2`), to show how much a single run moves, and the 1.1.1 and 1.1.2 invoked sessions also ran on Opus 5 at high and Sonnet 5 at medium (`-opus-high`, `-sonnet-medium`), to show how a route's cost depends on the setting it is asked from. One 1.1.2 idle session started 1,188 tokens larger than every other session with the plugin loaded, which the reduced transcript cannot explain. The idle and mention sessions then ran twice more on the same text: both idle runs matched within 2 tokens, and the last of each is saved. The saved mention session started 181 tokens larger than the one before it. Both larger starts read nothing from the prompt cache on their first call, where every other idle, unprompted and mention session read 30,890 tokens from it. The 1.2.0 sessions ran on Claude Code 2.1.270, where the measured sessions started about 16.7K tokens smaller than on 2.1.267. On Opus 5, the idle session's second "Reply with OK." and the reply after the second route read about 17K tokens of a 26K to 28K context from the cache, where 2.1.267 read nearly all of it, so those turns cost about four times as much. The reply after a route sent as a session's first message reads only the shared prefix from the cache on both versions. On Sonnet 5 the reply after the second route, and in the unprompted and mention sessions the second turn, read their whole context. The shared no-plugin session ran on 2.1.267, so 1.2.0 has its own, and `skill-cost.mjs` computes the idle figure only against a no-plugin session on the same Claude Code version. `bench/breakeven.mjs` combines those routes with the task runs into the chart in `findings.md`, and fails if any route it uses ran against a `SKILL.md` other than the one in the checkout.

## Reproducing it

```sh
node bench/run.mjs --results bench/rerun                                   # the 92 published runs, into a fresh directory
node bench/summarize.mjs --results bench/rerun --out bench/rerun/RESULTS.md  # the report and verdicts from your runs
node bench/run.mjs --only <ids>                                            # a subset
node bench/run.mjs --regrade                                               # re-grade saved review and explore answers
node --test bench/graders.test.mjs bench/matrix.test.mjs                   # graders against gaming cases; matrix expansion
node scripts/check-matrix.mjs                                              # matrix.json names exactly the published runs
node scripts/check-models.mjs --live                                       # whether each alias still resolves to its measured model
node bench/skill-cost.mjs --compare 1.0.1,1.1.0-inline@1.0.1,1.1.2    # what routing itself costs, from the saved sessions
node bench/skill-cost.mjs --label <name> --sessions invoked,unprompted     # measure the current skill; about $1 at list price
node bench/breakeven.mjs --check                                           # the breakeven chart follows from the saved runs
node bench/context-profile.mjs                                             # the observational table in skills/route/reference.md
```

`matrix.json` lists every run, and `repeat: 3` on a run gives its cell three runs, so the matrix expands to exactly the 68 published runs. It names models by alias, so a re-run reproduces the published runs only while the aliases still resolve to the models they used; the `--live` check says whether they do. Writing to a fresh results directory runs all of them and leaves the published data in `bench/results/` untouched. Working copies go to `<tmp>/tokenwise-bench/<run id>`. The published runs come to $48.08 at list price, across 117 minutes of session time. Sessions run on your own account, so a session limit will interrupt a re-run; excluded runs are retried on the next invocation.
