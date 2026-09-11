# Changelog

Versions follow the bar in `SCOPE.md`: a changed recommendation is a minor bump, a changed answer format or a removed section is a major one.

## 1.1.2 — 2026-09-11

No row of the routing table changed.

- **The skill counts effort changes as cache breaks.** Claude Code's prompt caching docs give each effort level its own cache on most models, so raising effort on a warm context re-processes it just as a model switch does. The skill named only the model cache, and a measured 1.1.1 route said an effort change "doesn't touch the cache". It now covers both, notes that Fable 5.1 on an API key or subscription keeps its cache across effort changes, and says that after `/clear` a change usually costs what a new session's first request costs, outside the documented-behaviour note because it is inferred from the docs. Escalating on a large context now starts with writing down where the work stands and running `/clear`.
- **The description no longer says a switch costs nothing.** It says to switch after `/clear` so the conversation is not re-processed, and `plugin.json` and the README match.
- **Where a route pays for itself.** `bench/breakeven.mjs` draws `docs/breakeven.svg` from the published runs: what each setting cost on the bench's tasks, what a route costs from Sonnet 5 at medium, Opus 5 at high and Opus 5 at xhigh, and the task sizes below which a route costs more than it saves. CI runs its `--check`, which fails when `SKILL.md` differs from the text the charted routes ran against, and `bench/breakeven.test.mjs` covers its axes, bands and parsing.
- **Figures.** The skill's cost is measured on the shipped `SKILL.md` from all three settings: a route in a session already under way costs $0.04, $0.10 and $0.14, and leaves 620 to 826 tokens behind. Loaded and unused, the plugin adds 129 tokens. A second run of 1.1.1 on identical text shows a single route's cost moving by $0.025 between runs.
- **`bench/skill-cost.mjs` runs as a command when started through a symlink or junction**, where it previously exited without doing anything.

## 1.1.1 — 2026-09-11

No routing recommendation changed.

- **The skill's own claims are corrected.**
  - The effort ladder gave `xhigh` as Claude Code's default. Claude Code's model configuration docs give `high` on every model that supports effort, except Opus 4.7.
  - The phase-boundary protocol said `/clear` removes the skill's text and that compaction carries it. That described the skill before it ran forked.
  - The subagent note gave Plan the Opus cap that the docs give Explore.
- **The bench report states the matrix's context and cost from the data.**
  - `bench/RESULTS.md` gave context per turn as peaking at 93K, which was a single resume call. It now gives the highest per-turn average in a graded run, 52K, as the docs do.
  - It states the total cost and session time of the published runs, so `--check` covers the figures the docs quote.
  - It names the verdicts that rest on single runs.
- **The runner fails loudly.**
  - A run that fails blocks the runs that depend on it, and `bench/run.mjs` exits non-zero.
  - An invalid run no longer leaves its answer behind.
  - `bench/skill-cost.mjs` stops on a git failure before a paid session starts.
  - `bench/context-profile.mjs` leaves out the skill-cost sessions.
- **Checks.**
  - The grader tests cover the implement reference solution and the planted debug defect.
  - CI runs `actions/checkout` and `actions/setup-node` v7, markdownlint-cli 0.49.1, and a pinned Claude Code CLI.
- **Figures.**
  - The skill's cost is re-measured on the shipped `SKILL.md`: a route leaves 754 tokens behind.
  - The draft skill text behind the middle column of the findings table is saved beside its transcripts.
  - The documentation is corrected against the data and its cited sources, and tightened against the project's writing rules.

## 1.1.0 — 2026-09-11

Asking for a route costs less, and the cost is published.

- **The skill runs in a forked subagent.** Its text and reasoning stay in the subagent and only the answer returns. Measured on Opus 5 at xhigh, a route left 9.6K tokens behind for every later call in 1.0.1, mostly the answer and its thinking; it now leaves 876. A route in a session already under way costs $0.136, against $0.165. The forked skill cannot see the conversation: it routes from the description after `/tokenwise:route`, asks for one when there is none, and points to `/context` for the context size a switch would re-process.
- **It routes without looking around.** The skill no longer reads files, runs commands or checks settings to answer, and keeps its reasoning short.
- **The phase-boundary protocol routes the next phase just before `/clear`**, so nothing the route returns is carried.
- **`bench/skill-cost.mjs` measures what the skill itself costs**: idle, per route, what stays in context, and whether Claude runs it unasked. `docs/findings.md` has the figures, including that a route can cost about what a small chore saves.

## 1.0.1 — 2026-09-11

No routing recommendation changed.

- **The evidence names the models it was measured on.** The skill, guide and findings name `claude-haiku-4-5-20251001`, `claude-sonnet-5`, `claude-opus-5` and `claude-fable-5-1`, and the skill tells users when their model is newer than the one a row was measured on. `scripts/check-models.mjs` checks those names against the published runs in CI, and with `--live` asks Claude Code what each alias resolves to today. `CONTRIBUTING.md` sets out what to do when Anthropic releases or retires a model, and `bench/run.mjs --models <alias>` re-runs what an alias change affects.
- **The bench reproduces.** `bench/matrix.json` sets each cell's size, so it expands to exactly the 57 published runs. `node bench/run.mjs --results bench/rerun` runs all of them into a fresh directory, and `scripts/check-matrix.mjs` fails in CI if the matrix and the published runs diverge. Before this, the committed runner could not produce two of the published replicates, and on a clean clone it ran nothing.
- **`context-profile.mjs` attributes subagent transcripts to their project.** It had been naming their project `subagents`, which let the bench's own subagents into the default report and dropped subagents from `--match` reports. The observational figures in the README, skill and reference are re-run with the fixed script and dated 11 September 2026.
- **Model and effort cost in different ways.** The model sets the price per token; effort changes how many tokens a task spends. `docs/findings.md` shows both from the run data, and records that no run used `max` effort or ultracode.
- **The graders are harder to game.**
  - The review grader grades each finding against the mechanism of a planted defect, and counts invented findings as false positives.
  - The chore grader runs the original tests and fails a run that deleted one.
  - The plan grader sees committed code changes.
  - A run stopped at its budget cap or killed at the timeout counts as a failure, instead of being excluded or retried.
  - C5 compares defect counts, not floating-point recall.
  - Every published grade and verdict is unchanged. `bench/graders.test.mjs` runs in CI with answers and working copies built to game each grader.
- **Smaller fixes.** The routing-table sync no longer counts a row marked `**Untested**` or `untested` as measured. The demo renders lines containing `%`, and accepts an answer file with CRLF line endings.
- **Documentation corrected against the data.** Changes include re-run costs quoted from the published runs, ratios recomputed from unrounded medians, the debug hidden tests and review overlay described as they are, and the falsified claims attributed to the skill rather than the routing table.

## 1.0.0 — 2026-09-09

The routing table is now backed by a published benchmark, and every figure in the plugin traces to a run or to a script in the repository.

### The bench

52 graded runs across five task types, plus five session resumes, on Claude Code 2.1.263. Thresholds were fixed in `bench/SCOPE.md` before the results were read, and `bench/summarize.mjs` computes the verdicts from them. The raw JSON for every run is in `bench/results/`.

Four of the skill's eight claims were falsified, and the skill changed to match:

- **Debugging a reproducible failure** starts on Sonnet at medium, not the top model at high. Sonnet fixed the planted bug in all three runs for a third of Opus's cost.
- **Reviewing a diff** starts on Opus at low effort, not high. Low found all five planted defects in three turns; high found the same five in thirteen, for 3.3 times the cost.
- **Forcing subagents onto Haiku** saves 30%, short of the 40% the bench set as its pass mark.
- **Splitting a small task** into a planning session and an implementation session cost more than doing it in one, so the protocol keeps its cache justification and drops the cost claim.

Five of the nine rows carry no measurement and are marked untested in the table.

### Corrections to the documentation

Six claims did not survive an audit against the run data: the run count, "every recommendation was run", the direction of the four falsifications, a subagent cost figure that appears in no run, a 404 pricing URL, and the description of the planted review defects. Fixed per-call overhead and peak context per turn were both restated from measurements rather than recollection.

`bench/context-profile.mjs` now produces the observational table in `skills/route/reference.md` from local transcripts, so that half is reproducible too. It counts API calls by `requestId`: one response spans several transcript lines sharing a `usage` object, and counting lines inflates both calls and tokens.

### Repository

- `SCOPE.md` sets the bar and defines what 1.0 means.
- `.github/workflows/checks.yml` runs the mechanical Done criteria on every pull request: fixture tests, markdownlint, `claude plugin validate`, and checks that `bench/RESULTS.md` follows from the run data and that the guide's routing table matches the skill's.
- The guide's routing table is generated from the skill's by `scripts/sync-routing-table.mjs`, so the two cannot drift.

## 0.1.0

Initial release: the `route` skill, with the routing table as an untested set of recommendations.
