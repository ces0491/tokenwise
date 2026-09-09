# Contributing

`SCOPE.md` sets the bar and says what this project is for. The short version: the routing table is advice with evidence behind it, and every figure in the repository has to be one a reader can recompute. Most of what follows exists to keep that true.

## Before you open a pull request

Everything runs offline against committed files. No Claude account, no bench runs, no dependencies beyond Node.

```sh
cd bench/fixture && node --test 'test/**/*.test.js' && cd ../..
npx markdownlint-cli@0.47.0 '*.md' 'docs/*.md' 'bench/*.md' 'skills/route/*.md' --config .markdownlint.json
node bench/summarize.mjs --check       # RESULTS.md still follows from results/runs.jsonl
node scripts/check-manifests.mjs       # manifests agree, changelog matches plugin.json
node scripts/sync-routing-table.mjs --check
claude plugin validate .
```

`.github/workflows/checks.yml` runs all of these on every pull request, so a green build means you have not broken any of them. What it cannot check is whether the prose still matches the runs. That is a reading, and it is the one that has gone wrong before.

`main` is protected: it takes a pull request with those checks green, and no direct pushes.

## Changing a routing row

A row changes when a graded run says so, not when it reads better. `bench/SCOPE.md` records the pass mark for each claim, fixed before the results were read, and a falsified claim edits `skills/route/SKILL.md` rather than being argued around.

`SKILL.md` is the source for the routing table. `docs/guide.md` carries a generated copy — edit the skill, then run `node scripts/sync-routing-table.mjs` and commit both. A row counts as measured unless its Measured cell opens with "Untested" or "Not separated", so that column is load-bearing: putting evidence there when the bench does not cover the row will quietly flip the guide's flag.

Five of the nine rows carry no measurement. Adding evidence for one of them is the most useful contribution available, and it means adding a case rather than editing prose.

## Adding a bench case

A case is a task with a grader that checks a fact. No grader reads for quality.

1. Add a directory under `bench/cases/<name>/` with `prompt.md`, and whichever of `overlay/` (files copied over the fixture), `hidden/` (tests copied in after the run) and `expected.json` the grader needs.
2. Register it in `bench/matrix.json` under `cases`, with the grader it uses, then add runs to the `runs` array.
3. If it needs a grader that does not exist, add one to `grade()` in `bench/run.mjs`.
4. Validate the grader before running the matrix: confirm a reference solution passes, and that the planted defect actually fails the tests you expect it to fail. A grader that passes everything measures nothing.
5. Write the pass mark into `bench/SCOPE.md` **before** looking at results, along with what changes in the skill if the claim fails.

```sh
node bench/run.mjs --only <id>     # one cell
node bench/run.mjs --repeat 3      # three runs per cell, per the replication rule
node bench/summarize.mjs           # rebuild RESULTS.md
```

Runs cost real money on your own account. The published matrix was about $30 and ninety minutes.

## Changing an instrument after seeing data

Sometimes a grader turns out to be wrong. That is allowed, and it has happened repeatedly here. Doing it silently is not.

Record the change in `bench/SCOPE.md`'s revision history with the date, what changed, why, and what it did to the verdicts. Then re-grade and say whether any verdict moved:

```sh
node bench/run.mjs --regrade && node bench/summarize.mjs
```

An instrument tightened after publication that moves no verdict is worth having. One that moves a verdict needs the move stated in `docs/findings.md`, not just in the history.

## Figures

No number in this repository should be one a reader cannot recompute. In practice:

- A figure from the bench traces to `bench/results/`, and `summarize.mjs` regenerates the tables that quote it.
- A figure about token usage comes from `bench/context-profile.mjs`, which anyone can run against their own transcripts.
- A figure from someone else's documentation is attributed to them, not stated flat.

If a number cannot be produced either way, it comes out rather than being softened. A specific number invented for emphasis borrows an authority it has not earned, and it breaks the moment anything downstream refers back to it.

Documentation is part of the change, not a follow-up: the README, guide, findings, methodology and reference move in the same commit as the data they describe.

## Releases

`SCOPE.md` sets what versions mean. A changed recommendation is a minor bump; a changed answer format or a removed section is major.

1. Bump `version` in `.claude-plugin/plugin.json`.
2. Add the entry to `CHANGELOG.md`. `check-manifests.mjs` fails if the newest heading and `plugin.json` disagree, which is a check that exists because they once did.
3. Merge, then `claude plugin tag --push -m 'tokenwise %s'` from a clean `main`.

## The demo

`demo/build.mjs` renders the terminal demo from a real captured answer. The MP4 and GIF it produces are not committed: they are large and go stale whenever the skill's answer changes, so the repository carries the generator rather than the output. The capture and render commands are in that file's header. It needs ffmpeg built with libfreetype.

## Reporting something wrong

A figure that does not reproduce is the most useful bug report this project can get. Include the command you ran and what it printed. A disagreement with a recommendation is more useful with a task the bench could grade than with an argument about it.
