# SCOPE — tokenwise

## Purpose

A Claude Code plugin that recommends the model and effort level for the phase of work at hand, says what the cheaper choice gives up, and shows the evidence behind each recommendation.

`bench/SCOPE.md` scopes the experiment that tests the recommendations. This file scopes the repository.

## Done

Version 1.0, released 9 September 2026 as `tokenwise--v1.0.0`: the documentation matches the data, and a reader can check every claim.

- [x] Every figure quoted in `README.md`, `SCOPE.md`, `docs/` and `skills/route/` traces to a run in `bench/results/` or to a committed script (`bench/summarize.mjs`, `bench/context-profile.mjs`). No number a reader cannot recompute.
- [x] Every routing-table row is marked measured or untested, and no row claims a measurement the bench did not make.
- [x] `node bench/run.mjs --results bench/rerun` runs every published run from a clean checkout, `node scripts/check-matrix.mjs` confirms `bench/matrix.json` names exactly those runs, and `node bench/summarize.mjs` regenerates `bench/RESULTS.md` with the same verdicts.
- [x] `claude plugin validate .` passes, the plugin installs from its marketplace entry, and `/tokenwise:route` answers in the block `SKILL.md` documents.
- [x] `node --test` green on `bench/fixture`, and `markdownlint *.md docs/*.md bench/*.md skills/route/*.md --config .markdownlint.json` clean.
- [x] Every URL cited in `skills/route/reference.md` resolves.
- [x] Tagged `tokenwise--v1.0.0` with `claude plugin tag`, `plugin.json` and the marketplace entry agreeing.

`.github/workflows/checks.yml` runs the mechanical part of this list on every pull request: the fixture and grader tests, the lint, `claude plugin validate`, and checks that `bench/RESULTS.md` still follows from the run data, that `bench/matrix.json` still names exactly the published runs, and that the guide's routing table still matches the skill's. What it cannot check is the first criterion, which is a reading of the prose against the runs.

## Out of scope

- **Measuring spend.** `/usage`, `session-report` and ccusage report usage over time; this plugin does not.
- **Switching anything.** Nothing can change a running session's model or effort. The skill recommends; the user runs `/model` and `/effort`.
- **Subscription accounting.** Costs quoted anywhere here are API list prices, useful as weights for comparison. How usage draws down against a Pro or Max plan is not published and is not modelled.
- **Filling the untested rows.** Planning, no-spec implementation, no-reproduction debugging, commits and bulk extraction stay marked untested until someone builds graders for them. They are not presented as measured in the meantime.
- **A second fixture, another language, or the long-context regime.** `bench/SCOPE.md`'s own exclusions still govern the experiment.
- **Judging prose.** Plan quality, code style and which answer reads better are not graded.

## Bar

Library-grade published plugin.

Semver applies to the skill's behaviour: a changed recommendation is a minor bump, a changed answer format or a removed section is a major one. Documentation is a shipped artifact, not a trailing chore — the README, guide, findings, methodology and reference change in the same commit as the data they describe. No claim ships without a way for a reader to check it, and a figure that cannot be recomputed comes out rather than being softened.

## Decision

Ces. A routing row changes only when a graded run says so. A falsified claim edits `SKILL.md`; it does not get argued around.

## Revision history

- 2026-09-11: the reproduction criterion reworded to match the runner, and checked with a dry run of the full matrix. Two published runs, `implement-opus-xhigh#2` and `#3`, could not be produced by the committed runner, which refused to replicate any run another run resumed from. On a clean clone `node bench/run.mjs` also ran nothing, because the result files it skips are committed. `bench/matrix.json` now records each cell's size, the runner replicates a resumed run, `--results` sends a re-run to a fresh directory, and `scripts/check-matrix.mjs` fails if the matrix and the published runs diverge. No run, grade or verdict changed.
- 2026-09-09: 1.0.0 released. Every criterion above verified, one of them twice: the first release commit announced the version bump without containing it, so the changelog shipped against a plugin.json a version behind. check-manifests.mjs now compares the two.
- 2026-09-09: initial scope, written after the first documentation audit against the bench data.
