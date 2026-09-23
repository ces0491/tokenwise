# Changelog

Versions follow the bar in `SCOPE.md`: a changed recommendation is a minor bump, a changed answer format or a removed section is a major one.

## 1.3.2 — 2026-09-23

No row of the routing table changed. `SKILL.md` did, so its routes were measured again.

- **Opus 5.5.** From Claude Code 2.1.280 the `opus` alias and the account default model resolve to Opus 5.5, which no bench run has used. The routing table's Opus cells now say they were measured on `claude-opus-5`, and the guide says the same. Corrections from the live docs, fetched 23 September 2026:
  - An effort change keeps the prompt cache on Opus 5.5 as well as Fable 5.1, with an API key or a subscription. `SKILL.md`, `reference.md` and the guide named Fable 5.1 only.
  - Opus 5.5 defaults to `medium` effort. The effort ladder and `reference.md` gave `high` on every model but Opus 4.7.
  - `reference.md` carries Opus 5.5's prices: a cache read at 0.05x input, and 2x Sonnet 5 on every class except cache reads, which cost the same.
  - The setup skill names Opus 5.5 at `medium` as the account default from 2.1.280, and says the bench has not run it.
  - The workflow size guideline's `medium` is fewer than 10 agents, and `small` is the default on Pro. `SKILL.md` and `reference.md` said under 15. `reference.md`'s quote of the skills page on `context: fork` now matches the page's wording.
- **Routes measured again, on Claude Code 2.1.280.** The Opus sessions ran with `--model claude-opus-5`, because `opus` now resolves to Opus 5.5 and `bench/breakeven.mjs` pairs a route with task cells by model id. A route in a session already under way cost $0.044 from Sonnet 5 at medium, $0.120 from Opus 5 at high and $0.131 from Opus 5 at xhigh, against $0.039, $0.100 and $0.116 for 1.3.0, and left 457 to 980 tokens behind. A session with no plugin starts 13.2K tokens larger on 2.1.280 than on 2.1.272. `hooks/route-costs.json` moves the hooks' thresholds to the new figures, and a session on Opus 5.5, which has no measured route, takes the cheapest, $0.044.
- **Document formats: a code review report and a claude.ai artifact.** `experiments/doc-format/` adds two documents to the paper. A 12 KB Markdown review added 4.9K tokens, its pandoc HTML 8.3K and its PDF 12.5K, and a single-file Quarto page could not be read. `measure.mjs` now also takes links: a `https://claude.ai/artifact/<id>` link is read once offered the Artifact and Read tools and once offered only WebFetch, any other `https` link once offered only WebFetch, each against its own no-document session. On a 51 KB artifact the link added 46.1K tokens against 23.7K for the saved HTML and 18.8K for a Markdown copy, and WebFetch could not open it. The paper's arXiv page through WebFetch added 1.2K. `--tools` offers file sessions Grep, Glob and read-only Bash as well, which got Claude through the Quarto page. The report counts calls by tool, and runs saved before this still reprint.
- **File paths in a printed PDF.** `experiments/doc-format/pdf-wrap.mjs` makes a PDF of a synthetic review with Chrome, pdflatex, Typst, LibreOffice and Word, skipping any that is not installed, and checks which paths survive text extraction. Chrome, LibreOffice and Word split paths only at a hyphen, Typst at slashes too, and pdflatex split none but let one run off the page. Chrome with inline code set to `nowrap` split none. It spends nothing, and its tests run in CI.
- **Whether Claude gives the paths back.** `experiments/doc-format/recall.mjs` hands Claude the synthetic review as Markdown, HTML and PDFs, asks for every path, and scores the list, `--repeat` times per copy. Claude gave back every split path in the main run. On an earlier, filler-text version of the document, rebuilt with `--text filler`, it returned split paths with a hyphen missing in 3 of 16 reads; the prompt's `--framing` made no clear difference. Its tests run in CI.

## 1.3.1 — 2026-09-16

No row of the routing table changed, and `SKILL.md` is untouched, so the 1.3.0 route measurements still describe what ships.

- **The re-send figures say what rates they are priced on.** Both hooks called Claude Code's estimate "at list price". `PreModelSwitch` reports the basis in `pricing`, where `"configured"` is the organization's own rates, and the hook dropped only `"default"`; `SessionStart` sends no such field. The switch figure now repeats what Claude Code reported, and the resume guard quotes the figure as an estimate without naming a basis.
- **The switch figure reads a transcript by bytes.** A line cut across a chunk boundary was carried back as re-encoded text, so a character split at the boundary returned as U+FFFD. A JSON string absorbs that without failing to parse, so no answer it gave was wrong; the remainder is now carried as raw bytes, and `readSync` is called until the chunk is full.
- **What the skill costs is keyed on `SKILL.md`'s hash.** `bench/breakeven.mjs` built its route labels from `plugin.json`'s version, so a release needed three new measured sessions even when the skill's text had not changed. It now takes the newest label set recorded against this checkout's hash, preferring the plugin's own version, and `hooks/route-costs.json` names that set in `measured`. A release that does edit `SKILL.md` still fails `--check`, listing every version tried and what each ran against. This is the first release to reuse a measurement: its routes are the 1.3.0 sessions.
- **Corrections from a review against `SCOPE.md`'s standing criteria.**
  - `skills/route/reference.md` said the bench falsified four of the nine claims, from when the scope had nine. C10 and C11 were added for 1.3.0 and both falsified, so it reads six of the eleven, as `docs/findings.md` and `bench/RESULTS.md` do.
  - The setup skill's account defaults left out the Anthropic API, which the model configuration docs list alongside Max, Team Premium and Enterprise as defaulting to Opus 5.
  - The README says `node` has to be on your PATH, since both hooks and setup run Node scripts, and qualifies "all 87 graded runs passed" with the one review answer `bench/results/hand-grades.json` decides.
  - The guide drops three figures a reader cannot recompute and names the method behind them instead, carries the live check behind "not when you cancel" where the claim is, and loses a heading and a closing line that restated the section below it.
- **`scripts/check-figures.mjs` holds the three copies of the observational token profile together.** The table in `reference.md` is the source of record, and the check fails when the README or `SKILL.md` quotes a different number, the way `check-models.mjs` already works for model ids. CI runs it, and the pinned CLI moves to 2.1.273.

## 1.3.0 — 2026-09-15

No row of the routing table changed. The plugin now sets a default once, warns before a re-send, and routes on request, in that order; `SCOPE.md` sets out why.

- **`/tokenwise:setup` starts new sessions on Sonnet 5 at medium.** On the four bench tasks both ran, Sonnet 5 at medium passed every run at 19% to 59% of Opus 5 at xhigh's cost per completed task. The skill shows the current `model` and the effort saved for Sonnet 5, anything that would override a change (`ANTHROPIC_MODEL`, `CLAUDE_CODE_EFFORT_LEVEL`, project settings), and what Sonnet gives up, and writes only after a yes. It writes the effort under `modelSettings`, because a level saved there takes precedence over the top-level `effortLevel`. `restore` puts back the values from before setup first ran, except any the user has changed since, and a second run changes nothing. It runs only when typed, so its description is not in context.
- **A warning when resuming would re-send an expired conversation.** A SessionStart hook on resume and fork shows the tokens and estimated cost Claude Code reports, and suggests `/clear`. When Claude Code sends no model, as on the resumes checked on 2.1.272, the threshold falls back to the cheapest measured route.
- **A figure after a model switch.** Claude Code's warm-cache confirmation says the history gets re-read without saying how much. A PreModelSwitch hook shows what the next message re-sends. It returns no decision, because an `ask` would refuse switches from `/config` and fast mode. It stays silent when the target model already holds the cache.
- **Both hooks** show a line only above what a route costs from the session's model, read from `hooks/route-costs.json`, which `bench/breakeven.mjs` now writes and checks. They return only a `systemMessage`. Two forks of one conversation, one with a 40,000-character hook message that Claude Code cut to a 2,281-character preview, sent first requests within 31 tokens of each other. Both need Claude Code 2.1.251 or later.
- **Switch for the session with `s`.** Typing `/model <name>` or `/effort <level>` saves a new default for new sessions, replacing one set by setup. The route skill, setup, the guide and the README now advise `s` in the `/model` picker for a phase, and a typed command only for a new default. `reference.md` quotes the model configuration docs.
- **Skill cost.** The skill's cost is re-measured on the shipped `SKILL.md`, on Claude Code 2.1.272. A route in a session already under way costs $0.04 from Sonnet 5 at medium, $0.10 from Opus 5 at high and $0.12 from Opus 5 at xhigh, and leaves 468 to 825 tokens behind. Loaded and never used, the plugin adds 153 tokens, against 156 for 1.2.0. `docs/breakeven.svg` and `hooks/route-costs.json` are redrawn from those routes. On 2.1.272 a Sonnet 5 session starts 12.4K tokens larger than an Opus 5 one, so the Sonnet label has its own idle session, as `docs/methodology.md` records.
- **Sending each job in a prompt to its own setting did not pay.** `experiments/ultratoken/` holds a prompt keyword whose hook told Claude to split a request into jobs and send each to a worker agent on the setting the routing table starts that work on. `bench/SCOPE.md` adds C10 (three small jobs in one prompt) and C11 (one of them large), written before any run. The `multi` and `multi-large` cases grade each job on its own section of one answer, three runs per cell from Opus 5 at xhigh and Sonnet 5 at medium. The keyword cost 1.25 and 1.85 times the plain prompt's cost per completed task with small jobs, and 0.99 and 1.17 times with the large one, against a 0.7 bar. Both claims are falsified from both settings, so the hook and its four agents stay out of the plugin. `bench/run.mjs` stages them in for the multi runs.
- **The runner builds a working copy with a branch to review.** A case with `branch` commits its overlays on main and the review diff on a second branch.
- **The review grader reads labelled findings.** It starts a finding on a line such as `- **File/Line:** \`src/tax.js:31\``. Every published review grade and hand grade is unchanged. One C11 review section, which gave its references as `` `file` line N ``, is hand-graded in `bench/results/hand-grades.json`, and the verdict is the same either way.
- **Bench totals.** The published runs number 92, 87 of them graded, and come to $68.52 at list price. The 24 multi runs came to $20.44.

## 1.2.0 — 2026-09-14

No row of the routing table changed.

- **The skill routes ultracode.** Its ladder had one line saying to use ultracode only when the work splits into independent parts, and nothing on how to turn it on or what it costs. A new section, built on Claude Code's model configuration, workflows and subagents docs, covers:
  - Ultracode is a setting that sends `xhigh` and runs a workflow for each substantive task.
  - Recommend it for high-judgment work that splits into independent parts. Use the `ultracode` prompt keyword for one such task and `/effort ultracode` for a run of them.
  - It needs a model that supports `xhigh`, so not Haiku.
  - Workflow agents take their model in the subagent order. With `CLAUDE_CODE_SUBAGENT_MODEL=haiku` and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`, which this plugin recommends, a whole workflow runs on Haiku.
  - An answer that recommends ultracode says its cost grows with the number of agents, gives the review measurement, where it ran a workflow at 9.5 times `xhigh`, and points to `/usage`.

  The skill's description now covers questions about turning ultracode on. The phase-boundary protocol turns ultracode off when the next phase does not split. The guide has a matching section.
- **The skill knows `ultrathink`.** Claude Code's model configuration docs describe it as a prompt keyword for deeper reasoning on one turn that leaves the effort level unchanged. Moving up a tier now tries it before an effort change for a single turn that needs more thought, the effort ladder lists it as unmeasured, and the description covers questions about it. `reference.md` quotes the docs, and the skill and guide mark as an inference that it keeps the cache.
- **Haiku no longer gets an effort level.** Two routing rows and the classify grid said "sonnet or haiku, `low`". Claude Code's model configuration docs list the models that support effort, and Haiku is not among them, so `/effort low` does nothing on it. The rows now read "sonnet, `low`, or haiku", which matches the bench: its Haiku runs set no effort.
- **The bench can run ultracode.** `bench/SCOPE.md` adds C9, written before any ultracode run: on tasks this size, ultracode costs at least 1.3 times as much as `xhigh` on Opus for no better result, tested on `review` and on `debug`. `bench/matrix.json` adds `review-opus-xhigh`, `review-opus-ultracode` and `debug-opus-ultracode`, three runs each, and raises `debug-opus-xhigh` to three. An ultracode run streams its session through `bench/stream.mjs` and records whether it was offered and called the Workflow tool, plus the tokens spent outside the main loop. A run not offered the tool had workflows unavailable, so it is marked invalid. `bench/ultracode-probe.json` is one capped Sonnet run that checks the runner's flags before the Opus runs, and `bench/stream.test.mjs` runs in CI. The RESULTS header now lists every Claude Code version the runs used.
- **C9 holds on the review and is not testable on the bug fix.** On the six-file review, Opus with ultracode started a workflow in all three runs and found the same five defects as Opus at `xhigh`, at a $4.75 median list price against $0.50. On the bug fix no run started a workflow, and the median came to 1.26 times `xhigh`'s, or 1.37 against the two `xhigh` runs on the same Claude Code version. The skill's ultracode section, its answer rule, the guide, the README and `docs/findings.md` quote these results. `debug-opus-xhigh`'s median is $0.35. The published runs number 68, 63 of them graded, and come to $48.08 at list price.
- **Figures.** The skill's cost is measured on the shipped `SKILL.md`, on Claude Code 2.1.270. A route in a session already under way costs $0.04 from Sonnet 5 at medium, $0.10 from Opus 5 at high and $0.11 from Opus 5 at xhigh, and leaves 655 to 780 tokens behind. Loaded and never used, the plugin adds 156 tokens of context, against 131 before the description mentioned ultracode and `ultrathink`. `docs/breakeven.svg` is redrawn from those routes and from every task cell whose runs all passed, including Opus ultracode on the review and the bug fix. `skill-cost.mjs` computes the idle figure only against a no-plugin session on the same Claude Code version, and a label can store its own no-plugin session.
- **What a document costs to read, by format.** `experiments/doc-format/` measures the tokens a PDF, an HTML page and their Markdown and plain-text conversions add when Claude Code reads them. On *Attention Is All You Need*, the arXiv HTML page added 101.8K tokens, the PDF 19.3K (sent as page images), pandoc Markdown 34.6K and pdftotext 18.5K. `--report` reprints the table from the saved run, and its tests run in CI.
- **Unmeasured at the top of the ladder.** The `max` entry in the effort ladder says no bench run measured it, and the ultracode entry says it was measured on small tasks only. `reference.md` quotes the docs behind the ultracode section and marks where the skill goes beyond them.

## 1.1.2 — 2026-09-11

No row of the routing table changed.

- **The skill counts effort changes as cache breaks.** Claude Code's prompt caching docs give each effort level its own cache on most models, so raising effort on a warm context re-processes it just as a model switch does. The skill named only the model cache, and a measured 1.1.1 route said an effort change "doesn't touch the cache". It now covers both, notes that Fable 5.1 on an API key or subscription keeps its cache across effort changes, and says that after `/clear` a change usually costs what a new session's first request costs, outside the documented-behaviour note because it is inferred from the docs. Escalating on a large context now starts with writing down where the work stands and running `/clear`.
- **The description no longer says a switch costs nothing.** It says to switch after `/clear` so the conversation is not re-processed, and `plugin.json` and the README match.
- **Where a route pays for itself.** `bench/breakeven.mjs` draws `docs/breakeven.svg` from the published runs: what each setting cost on the bench's tasks, what a route costs from Sonnet 5 at medium, Opus 5 at high and Opus 5 at xhigh, and the task sizes below which a route costs more than it saves. CI runs its `--check`, which fails when `SKILL.md` differs from the text the charted routes ran against, and `bench/breakeven.test.mjs` covers its axes, bands and parsing.
- **Figures.** The skill's cost is measured on the shipped `SKILL.md` from all three settings: a route in a session already under way costs $0.04, $0.10 and $0.14, and leaves 622 to 828 tokens behind. Loaded and unused, the plugin adds 131 tokens. A second run of 1.1.1 on identical text shows a single route's cost moving by $0.025 between runs.
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
