# tokenwise bench

Measures whether the routing advice in `../skills/route/SKILL.md` pays: for each task type, what each model and effort combination costs and whether it still gets the job done. Results are in `RESULTS.md`; the raw JSON for every run is in `results/`.

## What is measured

Each run is a fresh `claude -p` session in a throwaway copy of `fixture/`, a small invoicing library (7 modules, 29 tests, no dependencies). Runs load no user settings, plugins, MCP servers or CLAUDE.md (`--setting-sources project --strict-mcp-config`), so the fixed overhead per call is the base system prompt and tool schemas only: 19K to 28K tokens across these sessions, median 27K. Permissions are bypassed because a denied tool call shows up as extra turns and would distort the comparison; the directories are disposable.

Tokens, cost, turn count and per-model usage come from Claude Code's own JSON result (`--output-format json`). Cost is Claude Code's list-price figure.

| Case | Task | Grader |
| --- | --- | --- |
| `implement` | Add a credit-note feature from `docs/spec.md` | 8 hidden tests plus the 29 originals, with the original tests restored first so edits to them do not count |
| `debug` | One planted defect: VAT summed per line instead of once on the net. One visible test fails | 5 hidden tests plus the originals: three fail on the bug and on band-aid fixes, two check that single-line totals and the helpers are unchanged |
| `review` | An uncommitted diff with five planted defects and benign refactors, all visible tests passing | Recall of the five: the answer is split into findings, each led by a code file:line reference, and a defect counts as found when a finding on its file names its mechanism. Findings that match no planted defect count as false positives |
| `explore` | Where is rounding decided and who depends on it, delegated to a subagent | Must name `roundHalfUp` and `money.js` and two of three dependent modules; per-model usage shows what the subagent cost |
| `chore` | Rename `vatOn` to `vatAmount` across code, tests and README | The original tests with the rename applied pass against the model's code, no original test file is deleted, and no old name remains |

Five extra runs resume the finished `implement-opus-xhigh` session with one short question each, three on the same model and two on Sonnet, to probe what a model switch on a warm context costs. They do not isolate it — see C7 in `SCOPE.md`.

`split-plan-opus-xhigh` writes `docs/plan.md` without code; `split-impl-sonnet-medium` then implements from that plan in a fresh session. Their combined cost is compared with the opus one-shot.

`review-opus-ultracode` and `debug-opus-ultracode` run those cases with ultracode on, beside `review-opus-xhigh` and `debug-opus-xhigh` on the same model (C9 in `SCOPE.md`). Ultracode runs stream their session and keep a reduced copy in `results/<id>.stream.jsonl`, with tool names and usage and no message text. A session that was not offered the Workflow tool had workflows unavailable, so it is marked invalid and re-run. Before those cells, one capped probe on Sonnet checks that ultracode applies under the runner's flags:

```sh
node bench/run.mjs --matrix bench/ultracode-probe.json --results bench/probe
```

None of these runs load the plugin, so none of their costs include the skill. `skill-cost.mjs` measures what the skill itself costs in sessions of its own, with transcripts in `results/skill-cost/`; `../docs/methodology.md` describes them.

## Run it

```sh
node bench/run.mjs --results bench/rerun          # every published run, into a fresh directory
node bench/summarize.mjs --results bench/rerun --out bench/rerun/RESULTS.md
node bench/run.mjs --only debug-haiku             # a subset; a base id brings its cell's replicates
node bench/run.mjs --only review-opus-low#3       # one replicate
node bench/run.mjs --force                        # rerun into bench/results, replacing the published runs
node bench/run.mjs --force --models sonnet        # rerun what a change to the sonnet alias affects
node scripts/check-models.mjs --live              # whether each alias still resolves to the model it was measured on
node bench/run.mjs --regrade                      # re-grade saved review and explore answers with the current graders
node --test bench/graders.test.mjs bench/matrix.test.mjs bench/stream.test.mjs   # graders against gaming cases; matrix expansion; stream reader
node bench/summarize.mjs                          # rebuild RESULTS.md
node scripts/check-matrix.mjs                     # matrix.json names exactly the published runs
node bench/context-profile.mjs                    # the observational table in skills/route/reference.md
node bench/skill-cost.mjs --compare 1.0.1,1.1.2@1.0.1               # what routing costs, from the saved sessions
node bench/skill-cost.mjs --label <name> --sessions invoked,unprompted  # measure the current skill; about $1
node bench/breakeven.mjs                                            # the breakeven chart in docs/, from the saved runs
```

Each run in `matrix.json` sets its cell's size with `repeat`, so the matrix expands to exactly the published runs, and `run.mjs` skips any run whose result file already exists. Pointed at the committed `results/`, it runs nothing; `--results` with a fresh directory runs everything. Working copies go to `<tmp>/tokenwise-bench/<run id>` (`--runs-root` overrides). Sessions run on your own Claude account. The published runs come to $48.08 at list price, across 117 minutes of session time at the default `--concurrency 2`. A session limit will interrupt a re-run, and the runs it kills are retried on the next invocation.

## Limits

- Cells whose verdict would flip if one run flipped ran three times; the rest ran once, including the cells behind C7 and C8. `SCOPE.md` treats cost differences under 30% between single runs as noise.
- The fixture is small; no graded run averaged more than 72K tokens of context per turn, so the cache-read costs of long sessions are underrepresented here. The measurements in `../skills/route/reference.md` cover that regime.
- Review grading matches patterns, so it can be wrong on an answer unlike the saved ones; its patterns name the mechanism of each defect. The answers are saved in `results/*.answer.md`, `results/hand-grades.json` records a hand reading of five answers across the four review cells, and `graders.test.mjs` holds answers built to game the grader.
- The tests, chore and plan graders read each run's working copy, which is not kept, so a change to one of them cannot be re-graded against published runs.
- `turns` is Claude Code's `num_turns`, which tracks API calls closely without being the same count.
- Model aliases (`haiku`, `sonnet`, `opus`, `fable`) resolve to whatever Claude Code maps them to at run time; the raw JSON records the exact model ids. The published runs used `claude-haiku-4-5-20251001`, `claude-sonnet-5`, `claude-opus-5` and `claude-fable-5-1`, and a re-run after Anthropic moves an alias measures a different model. `../CONTRIBUTING.md` has the procedure.
