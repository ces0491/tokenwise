# Changelog

Versions follow the bar in `SCOPE.md`: a changed recommendation is a minor bump, a changed answer format or a removed section is a major one.

## Unreleased

No routing recommendation changed.

- **The bench reproduces.** `bench/matrix.json` sets each cell's size, so it expands to exactly the 57 published runs. `node bench/run.mjs --results bench/rerun` runs all of them into a fresh directory, and `scripts/check-matrix.mjs` fails in CI if the matrix and the published runs diverge. Before this, the committed runner could not produce two of the published replicates, and on a clean clone it ran nothing.

## 1.0.0 — 2026-09-09

The routing table is now backed by a published benchmark, and every figure in the plugin traces to a run or to a script in the repository.

### The bench

52 graded runs across five task types, plus five session resumes, on Claude Code 2.1.263. Thresholds were fixed in `bench/SCOPE.md` before the results were read, and `bench/summarize.mjs` computes the verdicts from them. The raw JSON for every run is in `bench/results/`.

Four of the eight claims the table made were falsified, and the table changed to match:

- **Debugging a reproducible failure** starts on Sonnet at medium, not the top model at high. Sonnet fixed the planted bug in all three runs for a third of Opus's cost.
- **Reviewing a diff** starts on Opus at low effort, not high. Low found all five planted defects in three turns; high found the same five in thirteen, for 3.3 times the cost.
- **Forcing subagents onto Haiku** saves 30%, where the table had claimed 40%.
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
