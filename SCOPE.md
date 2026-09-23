# SCOPE — tokenwise

## Purpose

A Claude Code plugin that gets more work out of a Claude subscription for the least effort from its user. It sets efficient defaults once, warns before an action re-sends a large conversation, and recommends the model and effort for the work at hand, each with the evidence behind it.

`bench/SCOPE.md` scopes the experiment that tests the recommendations. This file scopes the repository.

## Done: 1.3.0, defaults and guards

The pieces ask the user for as little as possible, in this order: a default set once, a warning only when something material is about to happen, and advice on request.

- [x] **Setup.** `/tokenwise:setup` shows the `model`, and the effort level saved for Sonnet 5 under `modelSettings`, in the user's `~/.claude/settings.json`, and recommends Sonnet 5 at medium, with the bench evidence behind it. It writes only after an explicit yes, says how to restore the previous values, and changes nothing when run a second time.
- [x] **Resume guard.** A SessionStart hook shows the re-send size and estimated cost from its input (`context_tokens`, `estimated_cache_write_usd`) and suggests starting fresh. It fires only on a resumed or forked session whose `prompt_cache_likely_expired` is true, and only above the materiality threshold. It returns only `systemMessage`, and a hook message adds no tokens to the conversation: two forks of one conversation, differing only in the size of that message, send first requests within run-to-run noise of each other.
- [x] **Switch figure.** Claude Code's own confirmation for a warm-cache model switch says the history gets re-read, and gives no size or cost. A PreModelSwitch hook shows both above the threshold and returns no decision, so every switch goes ahead or not as it would without the plugin. Claude Code shows the line with the command's result once a switch applies, and not when it is cancelled, so the line gives what the next message will re-send. The hooks reference lists no event for effort changes, so those rely on Claude Code's confirmation.
- [x] **Cost and tests.** Each new piece's idle and per-trigger cost is measured on the shipped `SKILL.md`, identified by its hash rather than by a version number, and published beside the route's. Each hook is tested against the input schema in Claude Code's hooks reference and verified once in a live session.
- [x] The standing criteria below still hold, and `claude plugin tag` tags 1.3.0.

**Later, only if its claim holds: escalation on a failed check.** Before any run, `bench/SCOPE.md` pre-registers a case where Sonnet 5 at medium fails at least one run in three and a check shows the failure. The claim is that escalating on that failure costs less per completed task than starting on Opus 5. The skill advises it only if the claim holds.

## Materiality

A guard fires only when the estimated re-send cost exceeds what a route costs from the session's model, as measured on the shipped skill ($0.04 from Sonnet 5 at medium, $0.12 to $0.13 from Opus 5 on 1.3.2). Below that, Ces judged a warning not worth the interruption. A cost difference under 30%, the noise band C10 and C11 used, does not change a recommendation.

## Standing criteria

Met at 1.0.0, released 9 September 2026 as `tokenwise--v1.0.0`, and required of every release since: the documentation matches the data, and a reader can check every claim.

- [x] Every figure quoted in `README.md`, `SCOPE.md`, `docs/` and `skills/route/` traces to a run in `bench/results/` or to a committed script (`bench/summarize.mjs`, `bench/skill-cost.mjs`, `bench/breakeven.mjs`, `bench/context-profile.mjs`), and the figures quoted in more than one document are held together by `scripts/check-figures.mjs`.
- [x] What the skill itself costs a session is measured on the shipped `SKILL.md` and published beside the task costs, since those runs load no plugins. The measurement is keyed on that file's hash, so a release that leaves it untouched keeps the figures already recorded for it and one that edits it fails `bench/breakeven.mjs --check` until it is re-measured.
- [x] Every routing-table row is marked measured or untested, and no row claims a measurement the bench did not make.
- [x] `SKILL.md`, `docs/guide.md` and `docs/findings.md` name the exact models the published runs used (`node scripts/check-models.mjs`), and `node scripts/check-models.mjs --live` shows every alias the bench uses still resolving to its measured model.
- [x] While those models are still served, `node bench/run.mjs --results bench/rerun` runs every published run from a clean checkout, `node scripts/check-matrix.mjs` confirms `bench/matrix.json` names exactly those runs, and `node bench/summarize.mjs` regenerates `bench/RESULTS.md` with the same verdicts.
- [x] `claude plugin validate .` passes, the plugin installs from its marketplace entry, and `/tokenwise:route` answers in the block `SKILL.md` documents.
- [x] `node --test` green on `bench/fixture`, and `markdownlint *.md docs/*.md bench/*.md skills/*/*.md --config .markdownlint.json` clean.
- [x] Every URL cited in `skills/route/reference.md` resolves.
- [x] Tagged `tokenwise--v1.0.0` with `claude plugin tag`, `plugin.json` and the marketplace entry agreeing.

`.github/workflows/checks.yml` runs the mechanical part of this list on every pull request: the fixture, grader and matrix tests, the lint, `claude plugin validate`, the manifest check, and checks that `bench/RESULTS.md` still follows from the run data, that `bench/matrix.json` still names exactly the published runs, that the docs name the models those runs used, that the README and the skill quote `reference.md`'s token profile, and that the guide's routing table still matches the skill's. What it cannot check is the first criterion, which is a reading of the prose against the runs, or whether Anthropic has since moved an alias, which takes the paid `--live` check.

## Out of scope

- **Measuring spend.** `/usage`, `session-report` and ccusage report usage over time; this plugin does not.
- **Switching anything.** Inside Claude Code, only the user changes a running session's model or effort, with `/model` and `/effort`. The plugin recommends and warns.
- **An SDK host.** An Agent SDK program can switch a session's model itself, but a tokenwise host would take users out of Claude Code's terminal and editor.
- **Silent defaults.** A plugin's own `settings.json` accepts only `agent` and `subagentStatusLine`. Defaults reach user settings through setup, with the user's yes, never on install.
- **Shipping a status line.** A plugin cannot provide one. The guide points to `/statusline` for showing context size.
- **Rebuilding what Claude Code already does.** It confirms a model or effort change while the prompt cache is warm, so a guard adds the figure that confirmation lacks and leaves the decision to it.
- **Resource and availability claims.** Anthropic doesn't publish energy or water per model, and list price is not a measure of compute. The docs describe work per subscription, and nothing here claims savings in data-centre resources or model availability.
- **Subscription accounting.** Costs quoted anywhere here are API list prices, useful as weights for comparison. How usage draws down against a Pro or Max plan is not published and is not modelled.
- **Filling the untested rows.** Planning, no-spec implementation, no-reproduction debugging, commits and bulk extraction stay marked untested until someone builds graders for them. They are not presented as measured in the meantime.
- **A second fixture, another language, or the long-context regime.** `bench/SCOPE.md`'s own exclusions still govern the experiment.
- **Judging prose.** Plan quality, code style and which answer reads better are not graded.

## Bar

Library-grade published plugin.

Semver applies to the skill's behaviour: a changed recommendation is a minor bump, a changed answer format or a removed section is a major one. The README, guide, findings, methodology and reference change in the same commit as the data they describe. No claim ships without a way for a reader to check it, and a figure that cannot be recomputed comes out rather than being softened.

Anthropic moves aliases to new models and retires old ones. A routing row measured on a model users no longer get is stale, so keeping the evidence tied to current models is ongoing maintenance. `CONTRIBUTING.md` sets out the procedure for a model release and for a retirement.

## Decision

Ces. A routing row changes only when a graded run says so. A falsified claim changes `SKILL.md`. A guard ships only once its trigger and its cost are measured.

## Revision history

- 2026-09-15, building the switch figure: **the figure is a separate line, since Claude Code's confirmation shows none.** In Claude Code 2.1.272, the confirmation reads "This conversation is cached for the current model. Switching to X means the full history gets re-read on your next message", from reading the client itself because the docs do not quote it. A hook returning `ask` replaces that text with its own. Outside an interactive `/model`, though, the hooks reference says Claude Code treats `ask` as a refusal. The hook's `source` is `"command"` for `/model`, `/config` and turning on fast mode alike, so an `ask` guard would block those switches. Ces chose a `systemMessage` line with no decision. Two live checks followed.
  - A `/model opus` in a conversation Opus had written: Claude Code ran the hook with a $4.84 estimate although no re-send was due, because it confirms only when the target did not write the last response. The figure applies the same rule.
  - In that check, the line appeared in the command's output, after the switch had applied. So it describes the next message, which is when the re-send happens.
  - A second live check covered a switch that brings up the confirmation, from Sonnet to Opus in a fresh session. The confirmation showed no line. Choosing "No, go back" showed none either. Choosing "Yes" showed "on claude-opus-5, your next message re-sends 88K tokens, about $0.88 at list price" under the switch result.

- 2026-09-15, building the resume guard: **its no-tokens check compares two forks.** `bench/skill-cost.mjs` has no resumed session. Comparing a resumed first request with `context_tokens` cannot isolate a one-line message either, because Claude Code re-injects its environment, tool, skill and instruction listings on resume, about 23K tokens in the session checked. Two `--fork-session` resumes of one conversation did isolate it. They differed only in the hook's message, one character against 40,000, which Claude Code recorded as a 2,281-character preview. Their first requests were 63,485 and 63,454 tokens. The resume checked in a live session, of a 130K-token Opus 5 conversation on Claude Code 2.1.272, sent the hook `context_tokens`, `prompt_cache_likely_expired` and `estimated_cache_write_usd` but no `model` or `effort`, so the threshold fell back to the cheapest route. The hooks reference sends `effort` only on events inside a tool-use context and gives the level to hook commands as `$CLAUDE_EFFORT`, which both hooks read. The threshold is written to `hooks/route-costs.json` by `bench/breakeven.mjs` from the measured routes, so `--check` covers it.

- 2026-09-15, building setup: **the setup criterion names the key Claude Code reads.** A level saved for a model under `modelSettings` takes precedence over the top-level `effortLevel` in the same file, and `/effort` saves there. Writing `effortLevel` would not change a user who had ever saved a level for Sonnet 5. The lint criterion covers every skill directory.

- 2026-09-15: the purpose widens from routing to defaults and guards. C10 and C11 in `bench/SCOPE.md` showed that sending each job in a prompt to its own setting did not reach the 0.7 bar, and both multi-job cases were cheapest on Sonnet 5 at medium without the keyword. So the first piece is a better starting default. Claude Code's docs set the form of each piece:
  - a plugin cannot write settings, so defaults go through a setup skill
  - SessionStart and PreModelSwitch hooks receive the re-send size and estimated cost, so a guard needs no transcript parsing
  - Claude Code already confirms warm-cache switches, so the switch figure is conditional
  - only the user or an SDK host can switch a model, and an SDK host was ruled out to keep users in Claude Code

  Ces chose the materiality threshold, the Sonnet 5 at medium default, and one release. The 1.0 criteria move under Standing criteria unchanged.

- 2026-09-11: the skill's own cost measured and cut. The bench's task runs load no plugins, so their savings never counted what asking for a route costs. `bench/skill-cost.mjs` measures it: in 1.0.1 a route on Opus 5 at xhigh left 9.6K tokens behind for every later call, mostly its answer and thinking, and a route could cost about what a small chore saves. 1.1.0 runs the skill forked, routes without reading files or running commands, and routes just before `/clear` in the phase-boundary protocol; a route now leaves 876 tokens behind. A new Done criterion requires the skill's cost to be measured on the shipped `SKILL.md`.
- 2026-09-11: evidence tied to the models it was measured on. The routing table advises in aliases, and nothing recorded which models its evidence came from or noticed an alias moving. The skill, guide and findings now name `claude-haiku-4-5-20251001`, `claude-sonnet-5`, `claude-opus-5` and `claude-fable-5-1`, and `scripts/check-models.mjs` checks that in CI. Its `--live` mode compares what each alias resolves to today, and all four still resolved to their measured models on 11 September 2026. `CONTRIBUTING.md` gains the procedure for a model release or retirement, and `bench/run.mjs --models` re-runs what an alias change affects. The reproduction criterion now holds only while the measured models are served.
- 2026-09-11: the reproduction criterion reworded to match the runner, and checked with a dry run of the full matrix. Two published runs, `implement-opus-xhigh#2` and `#3`, could not be produced by the committed runner, which refused to replicate any run another run resumed from. On a clean clone `node bench/run.mjs` also ran nothing, because the result files it skips are committed. `bench/matrix.json` now records each cell's size, the runner replicates a resumed run, `--results` sends a re-run to a fresh directory, and `scripts/check-matrix.mjs` fails if the matrix and the published runs diverge. No run, grade or verdict changed.
- 2026-09-09: 1.0.0 released. Every criterion above verified, one of them twice: the first release commit announced the version bump without containing it, so the changelog shipped against a plugin.json a version behind. check-manifests.mjs now compares the two.
- 2026-09-09: initial scope, written after the first documentation audit against the bench data.
