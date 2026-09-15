# Contributing

`SCOPE.md` sets the bar and says what this project is for. The routing table is advice with evidence behind it, and every figure in the repository has to be one a reader can recompute.

## Before you open a pull request

Everything below runs offline against committed files, needs only Node, and spends nothing.

```sh
cd bench/fixture && node --test 'test/**/*.test.js' && cd ../..
node --test bench/graders.test.mjs bench/matrix.test.mjs bench/breakeven.test.mjs bench/stream.test.mjs experiments/doc-format/measure.test.mjs experiments/ultratoken/ultratoken.test.mjs skills/setup/setup.test.mjs hooks/resume-guard.test.mjs   # graders, matrix expansion, the chart's helpers, the stream reader, the document-format reader, the ultratoken experiment, the setup script, the resume guard
npx markdownlint-cli@0.49.1 '*.md' 'docs/*.md' 'bench/*.md' 'skills/*/*.md' 'experiments/*/*.md' --config .markdownlint.json
node bench/summarize.mjs --check       # RESULTS.md still follows from results/runs.jsonl
node bench/breakeven.mjs --check       # docs/breakeven.svg and hooks/route-costs.json still follow from the saved runs and SKILL.md
node scripts/check-matrix.mjs          # matrix.json expands to exactly the published runs
node scripts/check-models.mjs          # the docs name exactly the models the published runs used
node scripts/check-manifests.mjs       # manifests agree, changelog matches plugin.json
node scripts/sync-routing-table.mjs --check
claude plugin validate .
```

`.github/workflows/checks.yml` runs all of these on every pull request, so a green build means you have not broken any of them. What it cannot check is whether the prose still matches the runs. That needs someone to read the docs against `bench/RESULTS.md`.

`main` is protected: it takes a pull request with those checks green, and no direct pushes.

## Changing a routing row

A row changes when a graded run says so. `bench/SCOPE.md` records the pass mark for each claim, fixed before the results were read, and a falsified claim changes `skills/route/SKILL.md`.

`SKILL.md` is the source for the routing table. `docs/guide.md` carries a generated copy — edit the skill, then run `node scripts/sync-routing-table.mjs` and commit both. A row counts as measured unless its Measured cell opens with "Untested", "Not separated" or "Not measured" (any case, ignoring markdown emphasis), so evidence written into that cell for a row the bench does not cover flips the guide's flag to yes.

Five of the nine rows carry no measurement. Evidence for one of them needs a new bench case.

## Changing the skill's text

What a route costs depends on `SKILL.md`: how much the model thinks, what it reads, and what the answer leaves in the user's context. Any change to `SKILL.md` fails `bench/breakeven.mjs --check` until the skill is measured again, since each transcript records a hash of the text it ran against. Label the runs with the new version from `plugin.json`:

```sh
node bench/skill-cost.mjs --label <version> --sessions idle,invoked,unprompted   # add no-plugin when claude --version differs from the last label's
node bench/skill-cost.mjs --label <version>-opus-high --sessions invoked --model opus --effort high
node bench/skill-cost.mjs --label <version>-sonnet-medium --sessions invoked --model sonnet --effort medium
node bench/breakeven.mjs
node bench/skill-cost.mjs --compare <previous>,<version>
```

Add `mention` to the first command when the skill's name or description changes, since those are all that loads until the skill fires. The chart reads the xhigh route and the idle session from the bare version label and the other two routes from the suffixed ones. `bench/breakeven.mjs` also writes those route costs to `hooks/route-costs.json`, which sets the resume guard's threshold, so re-measuring moves the threshold with the chart. With `mention`, the six sessions cost $1.95 at list price on 11 September 2026. Then update the figures in `docs/findings.md`, `docs/guide.md` and the README.

## Adding a bench case

A case is a task with a grader that checks a fact. No grader reads for quality.

1. Add a directory under `bench/cases/<name>/` with `prompt.md`, and whichever of `overlay/` (files copied over the fixture), `hidden/` (tests copied in after the run) and `expected.json` the grader needs.
2. Register it in `bench/matrix.json` under `cases`, with the grader it uses, then add runs to the `runs` array. Give a run `"repeat": 3` when its cell decides a verdict, so the matrix records the cell's size and a re-run reproduces it.
3. If it needs a grader that does not exist, add one to `bench/graders.mjs` and dispatch it from `grade()`. A grader that reads the working copy cannot be re-graded later, since the copy is not kept; one that reads the saved answer can.
4. Validate the grader before running the matrix: confirm a reference solution passes, and that the planted defect actually fails the tests you expect it to fail. Then add cases to `bench/graders.test.mjs` for the ways a run could pass without doing the task.
5. Write the pass mark into `bench/SCOPE.md` **before** looking at results, along with what changes in the skill if the claim fails.

```sh
node bench/run.mjs --only <id>     # one cell, with the replicates its repeat sets
node bench/summarize.mjs           # rebuild RESULTS.md
node scripts/check-matrix.mjs      # the matrix still names exactly the published runs
```

Runs draw on your own Claude account. The published runs come to $68.52 at list price.

## Changing an instrument after seeing data

Graders and criteria can change after data has been seen, and several have.

Record the change in `bench/SCOPE.md`'s revision history with the date, what changed, why, and what it did to the verdicts. Then re-grade and say whether any verdict moved:

```sh
node bench/run.mjs --regrade && node bench/summarize.mjs
```

`--regrade` reaches the review and explore graders, which read saved answers. A change to the tests, chore or plan grader cannot be re-applied to published runs, so the revision history has to say what evidence there is instead, or that there is none.

If a change moves a verdict, state the move in `docs/findings.md` as well as the revision history.

## When Anthropic releases or retires a model

The routing table gives its advice in aliases: `haiku`, `sonnet`, `opus`, `fable`. Its evidence comes from the models those aliases resolved to when the bench ran, which `skills/route/SKILL.md`, `docs/guide.md` and `docs/findings.md` name. When Anthropic points an alias at a new model, the advice follows the alias and the evidence does not. None of the offline checks can see that happen, so it has to be looked for:

```sh
node scripts/check-models.mjs --live   # what each alias resolves to now; $0.21 at list price on 11 September 2026
```

Run it when Anthropic announces a model or a retirement, and before tagging a release. It exits non-zero when an alias resolves to a model other than the one measured, or to none, and lists the routing rows that start or escalate on it. Without `--live` the same script runs in CI, and fails when those three documents name models other than the ones the published runs used.

### An alias points at a newer model

`/model sonnet` still works, so there is no deadline. What has gone stale is "measured" on every row that uses the alias, and the skill tells users as much when their model is newer than the one it names. Re-measure in one pull request:

1. Re-run what the change affects. `--models` selects every run on the alias, every run that forces it through its environment, and the runs those need or feed. Check the selection and its size with `--dry` first.

   ```sh
   node bench/run.mjs --dry --force --models sonnet
   node bench/run.mjs --force --models sonnet
   node bench/summarize.mjs
   ```

   The earlier records stay in `bench/results/runs.jsonl`, the report takes the latest record per run, and git keeps the previous result files.
2. Update the model ids in the three documents. `node scripts/check-models.mjs` fails until they match the new runs.
3. Update the prices and tokenizer notes in `skills/route/reference.md` from the pricing page, with the date.
4. Read the new verdicts. A flipped verdict changes its row as in "Changing a routing row", and that is a minor release. Figures that moved without a verdict flipping are a patch, and every figure the docs quote from the re-run cells gets checked against the new `bench/RESULTS.md`.

Until the bench can be re-run, change the affected Measured cells to name the model they describe, for example "Measured on `claude-sonnet-5`: ...", and leave the model ids alone.

### A new alias or model family

Add it to the alias list in `SKILL.md`. It stays out of every row's Start and Escalate cells until it has cells in `bench/matrix.json`, with pass marks written into `bench/SCOPE.md` before the runs, as in "Adding a bench case".

### A model is retired

This has a deadline. From the retirement date, a row that starts or escalates on the model sends users to a model that no longer exists, or to whatever the alias resolves to by then. Anthropic lists retirement dates on its [model deprecations page](https://platform.claude.com/docs/en/about-claude/model-deprecations). Before the date:

1. Point each affected row at the replacement, and open its Measured cell with "Untested on" the replacement, followed by the retired model it was measured on, until the bench re-runs those cells. The guide then shows the row as unmeasured.
2. Check the settings built on the model as well as the rows. `CLAUDE_CODE_SUBAGENT_MODEL=haiku` is recommended in the README, the guide and `SKILL.md`, and its 30% saving was measured on `claude-haiku-4-5-20251001`.
3. Once the replacement is available, re-measure with `--models` as above.

If the alias itself goes away, its cells need new ids in `bench/matrix.json`, and the pass marks in `bench/SCOPE.md` and the verdict code in `bench/summarize.mjs` refer to cells by id. The published runs on a retired model stay in git as the record of what was measured, but they can no longer be reproduced: the runner asks for the alias, and the alias means something else.

## Figures

No number in this repository should be one a reader cannot recompute. In practice:

- A figure from the bench traces to `bench/results/`, and `summarize.mjs` regenerates the tables that quote it.
- A figure about token usage comes from `bench/context-profile.mjs`, which anyone can run against their own transcripts.
- A figure from someone else's documentation is attributed to them, not stated flat.

If a number cannot be produced either way, it comes out rather than being softened. A specific number invented for emphasis borrows an authority it has not earned, and it breaks the moment anything downstream refers back to it.

The README, guide, findings, methodology and reference move in the same commit as the data they describe.

## Releases

`SCOPE.md` sets what versions mean. A changed recommendation is a minor bump; a changed answer format or a removed section is major.

1. Run `node scripts/check-models.mjs --live`. A release shipped after an alias moved should say so, or re-measure first.
2. Bump `version` in `.claude-plugin/plugin.json`.
3. Add the entry to `CHANGELOG.md`. `check-manifests.mjs` fails if the newest heading and `plugin.json` disagree.
4. Merge, then `claude plugin tag --push -m 'tokenwise %s'` from a clean `main`.

## The demo

`demo/build.mjs` renders the terminal demo from a real captured answer. The MP4 and GIF it produces are not committed: they are large and go stale whenever the skill's answer changes, so the repository carries the generator rather than the output. The capture and render commands are in that file's header. It needs ffmpeg built with libfreetype.

## Reporting something wrong

To report a figure that does not reproduce, include the command you ran and what it printed. A disagreement with a recommendation lands best with a task the bench could grade.
