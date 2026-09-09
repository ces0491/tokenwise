# tokenwise bench

Measures whether the routing advice in `skills/route/SKILL.md` pays: for each task type, what each model and effort combination costs and whether it still gets the job done. Results are in `RESULTS.md`; the raw JSON for every run is in `results/`.

## What is measured

Each run is a fresh `claude -p` session in a throwaway copy of `fixture/`, a small invoicing library (7 modules, 29 tests, no dependencies). Runs load no user settings, plugins, MCP servers or CLAUDE.md (`--setting-sources project --strict-mcp-config`), so the fixed overhead per call is the base system prompt and tool schemas only: 19K to 28K tokens across these sessions, median 27K. Permissions are bypassed because a denied tool call shows up as extra turns and would distort the comparison; the directories are disposable.

Tokens, cost, turn count and per-model usage come from Claude Code's own JSON result (`--output-format json`). Cost is Claude Code's list-price figure.

| Case | Task | Grader |
| --- | --- | --- |
| `implement` | Add a credit-note feature from `docs/spec.md` | 8 hidden tests plus the 29 originals, with the original tests restored first so edits to them do not count |
| `debug` | One planted defect: VAT summed per line instead of once on the net. One visible test fails | 5 hidden tests that fail on the bug and on band-aid fixes, plus the originals |
| `review` | An uncommitted diff with five planted defects and benign refactors, all visible tests passing | Recall of the five (a defect counts as found when a mention of its file has one of its patterns within 700 characters); file mentions with no planted defect explained near them count as false positives |
| `explore` | Where is rounding decided and who depends on it, delegated to a subagent | Must name `roundHalfUp` and `money.js` and two of three dependent modules; per-model usage shows what the subagent cost |
| `chore` | Rename `vatOn` to `vatAmount` across code, tests and README | Tests pass and no old name remains |

Five extra runs resume the finished `implement-opus-xhigh` session with one short question each, three on the same model and two on Sonnet, to probe what a model switch on a warm context costs. They do not isolate it — see C7 in `SCOPE.md`.

`split-plan-opus-xhigh` writes `docs/plan.md` without code; `split-impl-sonnet-medium` then implements from that plan in a fresh session. Their combined cost is compared with the opus one-shot.

## Run it

```sh
node bench/run.mjs                      # every run in matrix.json, skipping ones with results
node bench/run.mjs --repeat 3           # three runs per cell, as the replication rule requires
node bench/run.mjs --only debug-haiku   # a subset
node bench/run.mjs --force              # rerun everything
node bench/run.mjs --regrade            # re-grade saved review answers with the current grader
node bench/summarize.mjs                # rebuild RESULTS.md
node bench/context-profile.mjs          # the observational table in skills/route/reference.md
```

Runs go to `<tmp>/tokenwise-bench/<run id>` (`--runs-root` overrides). Sessions run on your own Claude account; the published matrix cost roughly $30 at list price and took about ninety minutes at the default `--concurrency 2`. A session limit will interrupt it, and the runs it kills are retried on the next invocation.

## Limits

- Cells that decide a verdict are run three times; the rest once. Differences under about 30% are within run-to-run noise.
- The fixture is small; context per turn peaks at 52K, so the cache-read costs of long sessions are underrepresented here. The measurements in `skills/route/reference.md` cover that regime.
- Review grading is keyword-based and approximate, and its patterns name the mechanism of each defect. The answers are saved in `results/*.answer.md`, and `results/hand-grades.json` records a hand reading of one answer per cell.
- `turns` is Claude Code's `num_turns`, which tracks API calls closely without being the same count.
- Model aliases (`haiku`, `sonnet`, `opus`, `fable`) resolve to whatever Claude Code maps them to at run time; the raw JSON records the exact model ids.
