# SCOPE — tokenwise

## Purpose

A Claude Code plugin that recommends the model and effort level for the phase of work at hand, says what the cheaper choice gives up, and shows the evidence behind each recommendation.

`bench/SCOPE.md` scopes the experiment that tests the recommendations. This file scopes the repository.

## Done

Version 1.0: the documentation matches the data, and a reader can check every claim.

- [ ] Every figure quoted in `README.md`, `SCOPE.md`, `docs/` and `skills/route/` traces to a run in `bench/results/` or to a committed script (`bench/summarize.mjs`, `bench/context-profile.mjs`). No number a reader cannot recompute.
- [ ] Every routing-table row is marked measured or untested, and no row claims a measurement the bench did not make.
- [ ] `node bench/run.mjs` reproduces the matrix from a clean checkout, and `node bench/summarize.mjs` regenerates `bench/RESULTS.md` with the same verdicts.
- [ ] `claude plugin validate .` passes, the plugin installs from its marketplace entry, and `/tokenwise:route` answers in the block `SKILL.md` documents.
- [ ] `node --test` green on `bench/fixture`, and `markdownlint *.md docs/*.md bench/*.md skills/route/*.md --config .markdownlint.json` clean.
- [ ] Every URL cited in `skills/route/reference.md` resolves.
- [ ] Tagged `tokenwise--v1.0.0` with `claude plugin tag`, `plugin.json` and the marketplace entry agreeing.

`.github/workflows/checks.yml` runs the mechanical part of this list on every pull request: the tests, the lint, `claude plugin validate`, and checks that `bench/RESULTS.md` still follows from the run data and that the guide's routing table still matches the skill's. What it cannot check is the first criterion, which is a reading of the prose against the runs.

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

- 2026-09-09: initial scope, written after the first documentation audit against the bench data.
