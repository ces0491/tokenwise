# Bench results

Generated 2026-09-23 09:01 UTC from 116 runs (111 graded, the rest session resumes with no grader) recorded 2026-09-08 to 2026-09-23 on Claude Code 2.1.263 and 2.1.270 and 2.1.280. Together they cost $79.69 at list price, across 212 minutes of session time.

## How to read this

- **Pass** means the grader for that case said so, nothing softer: all original tests (restored first, so edits to them do not count) plus all hidden tests green for implement and debug; for the chore, the original tests with the rename applied green against the model's code, no original test file deleted and no old name left; the required files named for explore; at least ${PASS_FOUND} of ${DEFECTS} planted defects found with at most 2 findings that match no planted defect for review. A run killed at the timeout or stopped by its budget cap fails.
- **Cost** is the list-price figure Claude Code reports for the run. On a subscription it is a weighting, not a bill.
- **n** is the number of runs in a cell. With n = 1 a result shows a setting can pass; it gives no rate. A verdict that would flip if one run flipped rests on cells of n = 3, and is marked provisional while it does not. C7 is deterministic and C8's cost gap is wide, so both rest on single runs (see SCOPE.md).
- **Cost per completed task** is mean cost divided by pass rate, so a setting that fails one run in three is charged for the retry.
- **turns** is Claude Code's `num_turns` for the run, and **ctx/turn** divides the run's total context by it. A turn tracks an API call closely without being the same count, so read these columns as how much work the setting did, not as a request tally.
- Differences under about 30% between single runs are noise.
- Review pass/fail uses the hand reading in results/hand-grades.json where one exists; the keyword grader's figure is shown beside it. Token columns cover the main session; cost includes subagents and workflow agents.
- The fixture is small (no graded run averaged more than 72K of context per turn) and every graded run passed, so these runs measure cost at equal outcomes. They cannot show where the top model earns its price; the long-context regime, over 100K tokens per call, is not measured here either. See skills/route/reference.md for that.

## Runs excluded

None. A run that hits a usage limit or an API error never attempted its task, so the runner marks it invalid and deletes its result file; the next invocation retries it. A run killed at the timeout or stopped by its budget cap did attempt its task, so it is not excluded: it counts as a failure.

## Verdicts on the claims in SCOPE.md

| claim | verdict | evidence |
| --- | --- | --- |
| C1 chores on sonnet at low, or haiku | holds | sonnet-low 3/3 at 33% of opus-xhigh; haiku 3/3 at 23% |
| C2 implement from a spec on sonnet medium | holds | sonnet-medium 3/3 at 17% of opus-xhigh (3/3) |
| C3 effort before model | criterion as written: falsified; claim as named: supported | cost per completed task, both cells passing every run: raise effort (sonnet xhigh) $0.59 vs upgrade the model (opus medium) $0.82 |
| C4 debug on the top model | falsified (row becomes "sonnet first, escalate on failure") | sonnet-medium 3/3; opus-high 3/3; opus-xhigh 3/3 |
| C5 review: keep effort high | falsified (low effort allowed for reviews of this size) | opus-high recall 100% (FP 0) vs opus-low 100% (FP 0); sonnet-high 80% (FP 0) |
| C6 force subagents onto haiku | falsified | haiku-forced 3/3, subagent on haiku: true (haiku output plus cache traffic, median 247K per run against 16 on inherit), cost 70% of inherit (3/3) |
| C7 the prompt cache is per model | not testable here (documented behaviour, unmeasurable through --resume) | the first resume on the same model already rewrote the prefix: read 15K, wrote 65K, versus switched read 15K, wrote 54K; a later opus resume read 89K and a sonnet resume after it read 70K, but sonnet had already cached this conversation in the earlier switch run |
| C8 plan on opus, implement on sonnet | falsified on cost (cache-boundary justification stands, cost claim dropped) | split $2.50 (1/1) vs opus one-shot $1.65 (3/3) |
| C9 ultracode on tasks this size | not testable here on debug (no workflow); holds on review | review: ultracode 3/3 at 9.47x the median cost of xhigh (3/3), workflow called in 3 of 3; debug: ultracode 3/3 at 1.26x the median cost of xhigh (3/3), workflow called in 0 of 3 |
| C10 ultratoken on small jobs | falsified from opus at xhigh; falsified from sonnet at medium | from opus at xhigh: ultratoken 3/3 at $0.89 per completed task, plain 3/3 at $0.71, routed in 3 of 3; from sonnet at medium: ultratoken 3/3 at $0.77 per completed task, plain 3/3 at $0.42, routed in 3 of 3 |
| C11 ultratoken with a large job | falsified from opus at xhigh; falsified from sonnet at medium | from opus at xhigh: ultratoken 3/3 at $1.29 per completed task, plain 3/3 at $1.30, routed in 3 of 3; from sonnet at medium: ultratoken 3/3 at $0.76 per completed task, plain 3/3 at $0.65, routed in 3 of 3 |
| C10 and C11 by job size | pays at neither size from opus at xhigh; pays at neither size from sonnet at medium | from opus at xhigh: ultratoken at 1.25x of the plain cost per completed task on small jobs, 0.99x with a large job; from sonnet at medium: ultratoken at 1.85x of the plain cost per completed task on small jobs, 1.17x with a large job |
| C12 Sonnet 5 at medium against Opus 5.5 at medium | falsified | implement: Sonnet saves, 3/3 at $0.41 per completed task against Opus 5.5 3/3 at $0.61 (0.67x); debug: Sonnet tie, 3/3 at $0.19 per completed task against Opus 5.5 3/3 at $0.21 (0.87x); multi: Sonnet tie, 3/3 at $0.44 per completed task against Opus 5.5 3/3 at $0.40 (1.09x); multi-large: Sonnet tie, 3/3 at $0.70 per completed task against Opus 5.5 3/3 at $0.77 (0.90x) |

## Cells

| cell | n | passed | median cost | cost per completed task | median turns |
| --- | --- | --- | --- | --- | --- |
| implement-fable-xhigh | 1 | 1/1 | $2.63 | $2.63 | 14 |
| implement-haiku | 1 | 1/1 | $0.17 | $0.17 | 19 |
| implement-opus-medium | 3 | 3/3 | $0.86 | $0.82 | 11 |
| implement-opus-xhigh | 3 | 3/3 | $1.65 | $1.62 | 16 |
| implement-opus55-medium | 3 | 3/3 | $0.59 | $0.61 | 11 |
| implement-sonnet-high | 1 | 1/1 | $0.42 | $0.42 | 21 |
| implement-sonnet-low | 1 | 1/1 | $0.24 | $0.24 | 15 |
| implement-sonnet-medium | 3 | 3/3 | $0.28 | $0.30 | 17 |
| implement-sonnet-medium-c12 | 3 | 3/3 | $0.39 | $0.41 | 19 |
| implement-sonnet-xhigh | 3 | 3/3 | $0.62 | $0.59 | 25 |
| debug-haiku | 1 | 1/1 | $0.06 | $0.06 | 8 |
| debug-opus-high | 3 | 3/3 | $0.41 | $0.40 | 9 |
| debug-opus-ultracode | 3 | 3/3 | $0.45 | $0.51 | 8 |
| debug-opus-xhigh | 3 | 3/3 | $0.35 | $0.36 | 9 |
| debug-opus55-medium | 3 | 3/3 | $0.21 | $0.21 | 5 |
| debug-sonnet-medium | 3 | 3/3 | $0.12 | $0.12 | 7 |
| debug-sonnet-medium-c12 | 3 | 3/3 | $0.19 | $0.19 | 8 |
| debug-sonnet-xhigh | 1 | 1/1 | $0.16 | $0.16 | 11 |
| review-fable-high | 1 | 1/1 | $0.79 | $0.79 | 5 |
| review-opus-high | 3 | 3/3 | $0.82 | $0.83 | 13 |
| review-opus-low | 3 | 3/3 | $0.25 | $0.25 | 3 |
| review-opus-ultracode | 3 | 3/3 | $4.75 | $5.28 | 7 |
| review-opus-xhigh | 3 | 3/3 | $0.50 | $0.53 | 6 |
| review-sonnet-high | 3 | 3/3 | $0.24 | $0.22 | 11 |
| chore-haiku | 3 | 3/3 | $0.06 | $0.06 | 16 |
| chore-opus-xhigh | 3 | 3/3 | $0.25 | $0.25 | 5 |
| chore-sonnet-low | 3 | 3/3 | $0.08 | $0.08 | 5 |
| explore-opus-haiku-sub | 3 | 3/3 | $0.44 | $0.43 | 2 |
| explore-opus-inherit | 3 | 3/3 | $0.63 | $0.65 | 2 |
| multi-large-opus-xhigh | 3 | 3/3 | $1.25 | $1.30 | 19 |
| multi-large-opus-xhigh-ultratoken | 3 | 3/3 | $1.32 | $1.29 | 4 |
| multi-large-opus55-medium | 3 | 3/3 | $0.86 | $0.77 | 15 |
| multi-large-sonnet-medium | 3 | 3/3 | $0.64 | $0.65 | 23 |
| multi-large-sonnet-medium-c12 | 3 | 3/3 | $0.62 | $0.70 | 24 |
| multi-large-sonnet-medium-ultratoken | 3 | 3/3 | $0.75 | $0.76 | 3 |
| multi-opus-xhigh | 3 | 3/3 | $0.70 | $0.71 | 9 |
| multi-opus-xhigh-ultratoken | 3 | 3/3 | $0.89 | $0.89 | 4 |
| multi-opus55-medium | 3 | 3/3 | $0.41 | $0.40 | 6 |
| multi-sonnet-medium | 3 | 3/3 | $0.43 | $0.42 | 23 |
| multi-sonnet-medium-c12 | 3 | 3/3 | $0.40 | $0.44 | 19 |
| multi-sonnet-medium-ultratoken | 3 | 3/3 | $0.60 | $0.77 | 2 |
| split-impl-sonnet-medium | 1 | 1/1 | $0.51 | $0.51 | 31 |
| split-plan-opus-xhigh | 1 | 1/1 | $1.99 | $1.99 | 13 |

## implement: every run

| run | model | effort | turns | ctx/turn | cache_w | cache_r | out | think | cost | min | result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| implement-fable-xhigh | fable | xhigh | 14 | 49K | 49K | 635K | 30K | 10K | $2.63 | 5.4 | pass (53/53) |
| implement-haiku | haiku | - | 19 | 25K | 30K | 438K | 12K | 2K | $0.17 | 2.1 | pass (59/59) |
| implement-opus-medium | opus | medium | 11 | 40K | 34K | 407K | 13K | 674 | $0.86 | 2.1 | pass (60/60) |
| implement-opus-medium#2 | opus | medium | 8 | 36K | 29K | 263K | 8K | 1K | $0.62 | 1.5 | pass (50/50) |
| implement-opus-medium#3 | opus | medium | 14 | 40K | 36K | 519K | 14K | 1K | $0.98 | 2.5 | pass (48/48) |
| implement-opus-xhigh | opus | xhigh | 14 | 51K | 60K | 651K | 30K | 15K | $1.67 | 5.5 | pass (51/51) |
| implement-opus-xhigh#2 | opus | xhigh | 18 | 49K | 51K | 825K | 25K | 10K | $1.55 | 4.6 | pass (47/47) |
| implement-opus-xhigh#3 | opus | xhigh | 16 | 52K | 56K | 775K | 28K | 13K | $1.65 | 5.2 | pass (48/48) |
| implement-opus55-medium | claude-opus-5-5 | medium | 9 | 44K | 34K | 364K | 12K | 2K | $0.59 | 1.6 | pass (51/51) |
| implement-opus55-medium#2 | claude-opus-5-5 | medium | 12 | 47K | 37K | 525K | 14K | 2K | $0.68 | 2.0 | pass (52/52) |
| implement-opus55-medium#3 | claude-opus-5-5 | medium | 11 | 40K | 32K | 406K | 10K | 2K | $0.54 | 1.5 | pass (53/53) |
| implement-sonnet-high | sonnet | high | 21 | 28K | 39K | 552K | 16K | 8K | $0.42 | 2.4 | pass (46/46) |
| implement-sonnet-low | sonnet | low | 15 | 25K | 26K | 347K | 7K | 409 | $0.24 | 1.1 | pass (52/52) |
| implement-sonnet-medium | sonnet | medium | 17 | 21K | 29K | 336K | 7K | 1K | $0.26 | 1.2 | pass (46/46) |
| implement-sonnet-medium#2 | sonnet | medium | 17 | 22K | 30K | 346K | 9K | 3K | $0.28 | 1.5 | pass (46/46) |
| implement-sonnet-medium#3 | sonnet | medium | 20 | 27K | 35K | 507K | 12K | 4K | $0.37 | 2.4 | pass (53/53) |
| implement-sonnet-medium-c12 | sonnet | medium | 21 | 46K | 39K | 923K | 12K | 4K | $0.46 | 1.7 | pass (46/46) |
| implement-sonnet-medium-c12#2 | sonnet | medium | 19 | 36K | 38K | 645K | 11K | 3K | $0.39 | 1.4 | pass (49/49) |
| implement-sonnet-medium-c12#3 | sonnet | medium | 18 | 38K | 36K | 641K | 10K | 3K | $0.37 | 1.6 | pass (49/49) |
| implement-sonnet-xhigh | sonnet | xhigh | 20 | 24K | 39K | 448K | 16K | 8K | $0.40 | 2.4 | pass (45/45) |
| implement-sonnet-xhigh#2 | sonnet | xhigh | 29 | 34K | 61K | 926K | 31K | 18K | $0.74 | 4.7 | pass (55/55) |
| implement-sonnet-xhigh#3 | sonnet | xhigh | 25 | 31K | 52K | 733K | 27K | 16K | $0.62 | 3.8 | pass (52/52) |
| split-impl-sonnet-medium | sonnet | medium | 31 | 30K | 49K | 894K | 14K | 1K | $0.51 | 2.4 | pass (50/50) |
| split-plan-opus-xhigh | opus | xhigh | 13 | 50K | 67K | 581K | 41K | 20K | $1.99 | 7.4 | plan 21KB |

## debug: every run

| run | model | effort | turns | ctx/turn | cache_w | cache_r | out | think | cost | min | result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| debug-haiku | haiku | - | 8 | 24K | 16K | 174K | 2K | 1K | $0.06 | 0.5 | pass (34/34) |
| debug-opus-high | opus | high | 8 | 34K | 24K | 245K | 2K | 510 | $0.41 | 0.6 | pass (34/34) |
| debug-opus-high#2 | opus | high | 9 | 32K | 22K | 267K | 2K | 761 | $0.41 | 0.7 | pass (34/34) |
| debug-opus-high#3 | opus | high | 9 | 25K | 22K | 205K | 2K | 587 | $0.38 | 0.6 | pass (34/34) |
| debug-opus-ultracode | opus | ultracode | 8 | 32K | 51K | 205K | 3K | 924 | $0.69 | 0.7 | pass (34/34) |
| debug-opus-ultracode#2 | opus | ultracode | 8 | 34K | 28K | 245K | 2K | 454 | $0.45 | 0.6 | pass (34/34) |
| debug-opus-ultracode#3 | opus | ultracode | 6 | 32K | 28K | 164K | 2K | 390 | $0.40 | 0.5 | pass (34/34) |
| debug-opus-xhigh | opus | xhigh | 9 | 33K | 23K | 270K | 3K | 1K | $0.44 | 0.8 | pass (34/34) |
| debug-opus-xhigh#2 | opus | xhigh | 10 | 20K | 22K | 176K | 2K | 349 | $0.35 | 0.5 | pass (34/34) |
| debug-opus-xhigh#3 | opus | xhigh | 9 | 17K | 19K | 136K | 2K | 259 | $0.30 | 0.5 | pass (34/34) |
| debug-opus55-medium | claude-opus-5-5 | medium | 5 | 42K | 19K | 192K | 1K | 91 | $0.21 | 0.3 | pass (34/34) |
| debug-opus55-medium#2 | claude-opus-5-5 | medium | 6 | 43K | 20K | 240K | 1K | 126 | $0.23 | 0.4 | pass (34/34) |
| debug-opus55-medium#3 | claude-opus-5-5 | medium | 5 | 42K | 18K | 191K | 816 | 38 | $0.20 | 0.4 | pass (34/34) |
| debug-sonnet-medium | sonnet | medium | 7 | 30K | 17K | 192K | 1K | 218 | $0.12 | 0.4 | pass (34/34) |
| debug-sonnet-medium#2 | sonnet | medium | 8 | 30K | 18K | 220K | 2K | 404 | $0.13 | 0.6 | pass (34/34) |
| debug-sonnet-medium#3 | sonnet | medium | 7 | 30K | 17K | 193K | 1K | 279 | $0.12 | 0.4 | pass (34/34) |
| debug-sonnet-medium-c12 | sonnet | medium | 6 | 54K | 22K | 304K | 1K | 182 | $0.16 | 0.3 | pass (34/34) |
| debug-sonnet-medium-c12#2 | sonnet | medium | 8 | 55K | 23K | 414K | 2K | 217 | $0.19 | 0.5 | pass (34/34) |
| debug-sonnet-medium-c12#3 | sonnet | medium | 9 | 55K | 23K | 473K | 2K | 351 | $0.21 | 0.4 | pass (34/34) |
| debug-sonnet-xhigh | sonnet | xhigh | 11 | 24K | 22K | 238K | 2K | 618 | $0.16 | 0.5 | pass (34/34) |

## review: every run

| run | model | effort | turns | ctx/turn | cache_w | cache_r | out | think | cost | min | result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| review-fable-high | fable | high | 5 | 36K | 27K | 153K | 4K | 1K | $0.79 | 1.0 | grader: recall 5/5, FP 0; hand: recall 5/5, FP 0 |
| review-opus-high | opus | high | 12 | 40K | 34K | 449K | 10K | 4K | $0.82 | 2.2 | grader: recall 5/5, FP 0; hand: recall 5/5, FP 0 |
| review-opus-high#2 | opus | high | 13 | 40K | 32K | 484K | 8K | 4K | $0.77 | 1.9 | grader: recall 5/5, FP 0 |
| review-opus-high#3 | opus | high | 13 | 42K | 37K | 512K | 11K | 4K | $0.91 | 2.4 | grader: recall 5/5, FP 0 |
| review-opus-low | opus | low | 3 | 30K | 16K | 72K | 2K | 612 | $0.25 | 0.5 | grader: recall 5/5, FP 0; hand: recall 5/5, FP 0 |
| review-opus-low#2 | opus | low | 3 | 29K | 16K | 73K | 2K | 535 | $0.25 | 0.5 | grader: recall 5/5, FP 0 |
| review-opus-low#3 | opus | low | 3 | 30K | 17K | 72K | 2K | 687 | $0.25 | 0.5 | grader: recall 5/5, FP 0 |
| review-opus-ultracode | opus | ultracode | 7 | 71K | 24K | 473K | 6K | 1K | $7.92 | 8.6 | grader: recall 5/5, FP 0 |
| review-opus-ultracode#2 | opus | ultracode | 4 | 72K | 12K | 275K | 3K | 125 | $3.18 | 5.6 | grader: recall 5/5, FP 0 |
| review-opus-ultracode#3 | opus | ultracode | 7 | 71K | 24K | 476K | 5K | 520 | $4.75 | 4.6 | grader: recall 5/5, FP 0 |
| review-opus-xhigh | opus | xhigh | 6 | 30K | 40K | 141K | 6K | 3K | $0.62 | 1.2 | grader: recall 5/5, FP 0 |
| review-opus-xhigh#2 | opus | xhigh | 5 | 35K | 25K | 148K | 5K | 2K | $0.46 | 1.2 | grader: recall 5/5, FP 0 |
| review-opus-xhigh#3 | opus | xhigh | 6 | 36K | 26K | 191K | 6K | 3K | $0.50 | 1.3 | grader: recall 5/5, FP 0 |
| review-sonnet-high | sonnet | high | 7 | 18K | 22K | 105K | 6K | 4K | $0.17 | 1.1 | grader: recall 4/5, FP 0; hand: recall 4/5, FP 0 |
| review-sonnet-high#2 | sonnet | high | 11 | 23K | 29K | 224K | 8K | 6K | $0.24 | 1.5 | grader: recall 4/5, FP 0; hand: recall 4/5, FP 0 |
| review-sonnet-high#3 | sonnet | high | 11 | 23K | 29K | 221K | 8K | 5K | $0.24 | 1.4 | grader: recall 5/5, FP 0 |

## chore: every run

| run | model | effort | turns | ctx/turn | cache_w | cache_r | out | think | cost | min | result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| chore-haiku | haiku | - | 16 | 7K | 15K | 99K | 3K | 467 | $0.06 | 0.5 | pass (29/29) |
| chore-haiku#2 | haiku | - | 17 | 8K | 16K | 126K | 3K | 826 | $0.06 | 0.6 | pass (29/29) |
| chore-haiku#3 | haiku | - | 16 | 7K | 15K | 99K | 3K | 642 | $0.06 | 0.6 | pass (29/29) |
| chore-opus-xhigh | opus | xhigh | 5 | 29K | 16K | 130K | 1K | 146 | $0.25 | 0.4 | pass (29/29) |
| chore-opus-xhigh#2 | opus | xhigh | 5 | 29K | 15K | 128K | 1K | 209 | $0.25 | 0.7 | pass (29/29) |
| chore-opus-xhigh#3 | opus | xhigh | 5 | 29K | 15K | 128K | 1K | 100 | $0.24 | 0.7 | pass (29/29) |
| chore-sonnet-low | sonnet | low | 5 | 27K | 13K | 122K | 547 | 0 | $0.08 | 0.2 | pass (29/29) |
| chore-sonnet-low#2 | sonnet | low | 6 | 22K | 13K | 121K | 664 | 0 | $0.08 | 0.2 | pass (29/29) |
| chore-sonnet-low#3 | sonnet | low | 5 | 27K | 13K | 122K | 574 | 0 | $0.08 | 0.5 | pass (29/29) |

## explore: every run

| run | model | effort | turns | ctx/turn | cache_w | cache_r | out | think | cost | min | result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| explore-opus-haiku-sub | opus | xhigh | 2 | 28K | 29K | 27K | 1K | 0 | $0.39 | 1.1 | pass |
| explore-opus-haiku-sub#2 | opus | xhigh | 2 | 28K | 29K | 27K | 1K | 0 | $0.45 | 1.7 | pass |
| explore-opus-haiku-sub#3 | opus | xhigh | 3 | 29K | 30K | 56K | 1K | 43 | $0.44 | 1.3 | pass |
| explore-opus-inherit | opus | xhigh | 2 | 29K | 16K | 42K | 1K | 0 | $0.63 | 1.9 | pass |
| explore-opus-inherit#2 | opus | xhigh | 2 | 29K | 16K | 42K | 1K | 0 | $0.86 | 3.0 | pass |
| explore-opus-inherit#3 | opus | xhigh | 2 | 28K | 14K | 42K | 1K | 0 | $0.47 | 1.4 | pass |

## multi: every run

| run | model | effort | turns | ctx/turn | cache_w | cache_r | out | think | cost | min | result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| multi-opus-xhigh | opus | xhigh | 9 | 36K | 34K | 288K | 8K | 4K | $0.70 | 1.8 | fix pass, review pass, rounding pass |
| multi-opus-xhigh#2 | opus | xhigh | 12 | 40K | 36K | 442K | 8K | 3K | $0.78 | 1.8 | fix pass, review pass, rounding pass |
| multi-opus-xhigh#3 | opus | xhigh | 9 | 35K | 33K | 285K | 8K | 3K | $0.66 | 1.7 | fix pass, review pass, rounding pass |
| multi-opus-xhigh-ultratoken | opus | xhigh | 3 | 42K | 5K | 121K | 2K | 374 | $1.02 | 1.5 | fix pass, review pass, rounding pass |
| multi-opus-xhigh-ultratoken#2 | opus | xhigh | 6 | 18K | 8K | 98K | 4K | 1K | $0.77 | 1.6 | fix pass, review pass, rounding pass |
| multi-opus-xhigh-ultratoken#3 | opus | xhigh | 4 | 30K | 6K | 114K | 4K | 2K | $0.89 | 1.8 | fix pass, review pass, rounding pass |
| multi-opus55-medium | claude-opus-5-5 | medium | 6 | 49K | 26K | 266K | 4K | 923 | $0.34 | 0.7 | fix pass, review pass, rounding pass |
| multi-opus55-medium#2 | claude-opus-5-5 | medium | 8 | 47K | 36K | 343K | 5K | 1K | $0.45 | 0.8 | fix pass, review pass, rounding pass |
| multi-opus55-medium#3 | claude-opus-5-5 | medium | 6 | 53K | 35K | 281K | 4K | 1K | $0.41 | 0.7 | fix pass, review pass, rounding pass |
| multi-sonnet-medium | sonnet | medium | 23 | 32K | 44K | 702K | 11K | 6K | $0.43 | 2.0 | fix pass, review pass, rounding pass |
| multi-sonnet-medium#2 | sonnet | medium | 25 | 32K | 43K | 762K | 13K | 8K | $0.46 | 2.5 | fix pass, review pass, rounding pass |
| multi-sonnet-medium#3 | sonnet | medium | 19 | 32K | 38K | 572K | 9K | 6K | $0.36 | 1.7 | fix pass, review pass, rounding pass |
| multi-sonnet-medium-c12 | sonnet | medium | 19 | 36K | 40K | 650K | 9K | 5K | $0.38 | 1.4 | fix pass, review pass, rounding pass |
| multi-sonnet-medium-c12#2 | sonnet | medium | 26 | 49K | 44K | 1.2M | 11K | 6K | $0.53 | 2.0 | fix pass, review pass, rounding pass |
| multi-sonnet-medium-c12#3 | sonnet | medium | 18 | 52K | 36K | 904K | 7K | 3K | $0.40 | 1.2 | fix pass, review pass, rounding pass |
| multi-sonnet-medium-ultratoken | sonnet | medium | 2 | 51K | 3K | 99K | 2K | 79 | $0.59 | 1.3 | fix pass, review pass, rounding pass |
| multi-sonnet-medium-ultratoken#2 | sonnet | medium | 2 | 54K | 4K | 103K | 2K | 51 | $1.13 | 3.0 | fix pass, review pass, rounding pass |
| multi-sonnet-medium-ultratoken#3 | sonnet | medium | 2 | 54K | 3K | 104K | 2K | 51 | $0.60 | 1.3 | fix pass, review pass, rounding pass |

## multi-large: every run

| run | model | effort | turns | ctx/turn | cache_w | cache_r | out | think | cost | min | result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| multi-large-opus-xhigh | opus | xhigh | 19 | 28K | 47K | 490K | 21K | 9K | $1.25 | 4.2 | implement pass, review pass, rounding pass |
| multi-large-opus-xhigh#2 | opus | xhigh | 19 | 25K | 49K | 430K | 19K | 7K | $1.19 | 3.7 | implement pass, review pass, rounding pass |
| multi-large-opus-xhigh#3 | opus | xhigh | 25 | 28K | 57K | 639K | 23K | 10K | $1.47 | 4.3 | implement pass, review pass, rounding pass |
| multi-large-opus-xhigh-ultratoken | opus | xhigh | 8 | 38K | 7K | 300K | 4K | 1K | $1.34 | 3.8 | implement pass, review pass, rounding pass |
| multi-large-opus-xhigh-ultratoken#2 | opus | xhigh | 4 | 44K | 7K | 168K | 4K | 2K | $1.32 | 3.5 | implement pass, review pass, rounding pass |
| multi-large-opus-xhigh-ultratoken#3 | opus | xhigh | 3 | 45K | 5K | 130K | 3K | 2K | $1.23 | 3.1 | implement pass, review pass, rounding pass |
| multi-large-opus55-medium | claude-opus-5-5 | medium | 18 | 58K | 47K | 989K | 15K | 4K | $0.87 | 4.3 | implement pass, review pass, rounding pass |
| multi-large-opus55-medium#2 | claude-opus-5-5 | medium | 15 | 52K | 48K | 733K | 17K | 3K | $0.86 | 2.3 | implement pass, review pass, rounding pass |
| multi-large-opus55-medium#3 | claude-opus-5-5 | medium | 9 | 52K | 36K | 436K | 10K | 2K | $0.58 | 1.5 | implement pass, review pass, rounding pass |
| multi-large-sonnet-medium | sonnet | medium | 23 | 38K | 43K | 833K | 13K | 3K | $0.64 | 2.5 | implement pass, review pass, rounding pass |
| multi-large-sonnet-medium#2 | sonnet | medium | 23 | 43K | 50K | 928K | 19K | 9K | $0.57 | 2.9 | implement pass, review pass, rounding pass |
| multi-large-sonnet-medium#3 | sonnet | medium | 3 | 71K | 5K | 207K | 2K | 105 | $0.75 | 3.7 | implement pass, review pass, rounding pass |
| multi-large-sonnet-medium-c12 | sonnet | medium | 24 | 49K | 52K | 1.1M | 19K | 9K | $0.62 | 2.8 | implement pass, review pass, rounding pass |
| multi-large-sonnet-medium-c12#2 | sonnet | medium | 22 | 44K | 48K | 912K | 17K | 9K | $0.55 | 2.5 | implement pass, review pass, rounding pass |
| multi-large-sonnet-medium-c12#3 | sonnet | medium | 30 | 48K | 49K | 1.4M | 14K | 3K | $0.92 | 2.2 | implement pass, review pass, rounding pass |
| multi-large-sonnet-medium-ultratoken | sonnet | medium | 3 | 51K | 4K | 149K | 2K | 47 | $0.75 | 2.7 | implement pass, review pass (grader: recall 0/5, FP 0; hand: recall 5/5, FP 0), rounding pass |
| multi-large-sonnet-medium-ultratoken#2 | sonnet | medium | 2 | 50K | 3K | 97K | 2K | 74 | $0.71 | 2.3 | implement pass, review pass, rounding pass |
| multi-large-sonnet-medium-ultratoken#3 | sonnet | medium | 3 | 54K | 3K | 160K | 2K | 329 | $0.84 | 2.2 | implement pass, review pass, rounding pass |

## Resuming a session: same model versus switched model

One extra one-line question on the finished implement-opus-xhigh session.

| run | model | uncached input | cache write | cache read | cost |
| --- | --- | --- | --- | --- | --- |
| cache-resume-same-model | opus | 2 | 65K | 15K | $0.66 |
| cache-resume-switch-model | sonnet | 2 | 54K | 15K | $0.22 |
| cache-resume-same-model-2 | opus | 2 | 9K | 80K | $0.13 |
| cache-resume-same-model-3 | opus | 2 | 4K | 89K | $0.09 |
| cache-resume-switch-model-2 | sonnet | 2 | 13K | 70K | $0.07 |

## Ultracode: workflows and work outside the main loop

Read from each run's stream (`results/<id>.stream.jsonl`). **Outside main** is the run's per-model usage less the main loop's own usage: workflow agents, subagents and Claude Code's internal calls, which one model's usage cannot tell apart.

| run | workflow calls | outside main: output | outside main: cache read | outside main: cache write | cost |
| --- | --- | --- | --- | --- | --- |
| debug-opus-ultracode | 0 | 13 | 0 | 0 | $0.69 |
| debug-opus-ultracode#2 | 0 | 11 | 0 | 0 | $0.45 |
| debug-opus-ultracode#3 | 0 | 11 | 0 | 0 | $0.40 |
| review-opus-ultracode | 1 | 94K | 2.9M | 536K | $7.92 |
| review-opus-ultracode#2 | 1 | 38K | 1.1M | 189K | $3.18 |
| review-opus-ultracode#3 | 1 | 55K | 1.7M | 282K | $4.75 |

## ultratoken: where each run sent its jobs

Each subagent the main loop started, with the model the call asked for, read from `results/<id>.stream.jsonl`. A worker with no model runs on the session model.

| run | subagents started | cost | result |
| --- | --- | --- | --- |
| multi-large-opus-xhigh-ultratoken | tokenwise:work-medium on sonnet, tokenwise:work-low on opus | $1.34 | implement pass, review pass, rounding pass |
| multi-large-opus-xhigh-ultratoken#2 | tokenwise:work-medium on sonnet, tokenwise:work-low on opus | $1.32 | implement pass, review pass, rounding pass |
| multi-large-opus-xhigh-ultratoken#3 | tokenwise:work-medium on sonnet, tokenwise:work-low on opus | $1.23 | implement pass, review pass, rounding pass |
| multi-large-sonnet-medium-ultratoken | tokenwise:work-medium on sonnet, tokenwise:work-low on opus | $0.75 | implement pass, review pass (grader: recall 0/5, FP 0; hand: recall 5/5, FP 0), rounding pass |
| multi-large-sonnet-medium-ultratoken#2 | tokenwise:work-medium on sonnet, tokenwise:work-low on opus | $0.71 | implement pass, review pass, rounding pass |
| multi-large-sonnet-medium-ultratoken#3 | tokenwise:work-medium on sonnet, tokenwise:work-low on opus | $0.84 | implement pass, review pass, rounding pass |
| multi-opus-xhigh-ultratoken | tokenwise:work-medium on sonnet, tokenwise:work-low on opus | $1.02 | fix pass, review pass, rounding pass |
| multi-opus-xhigh-ultratoken#2 | tokenwise:work-medium on sonnet, tokenwise:work-low on opus | $0.77 | fix pass, review pass, rounding pass |
| multi-opus-xhigh-ultratoken#3 | tokenwise:work-medium on sonnet, tokenwise:work-low on opus, tokenwise:work-low on haiku | $0.89 | fix pass, review pass, rounding pass |
| multi-sonnet-medium-ultratoken | tokenwise:work-medium on sonnet, tokenwise:work-low on opus | $0.59 | fix pass, review pass, rounding pass |
| multi-sonnet-medium-ultratoken#2 | tokenwise:work-medium on sonnet, tokenwise:work-low on opus | $1.13 | fix pass, review pass, rounding pass |
| multi-sonnet-medium-ultratoken#3 | tokenwise:work-medium on sonnet, tokenwise:work-low on opus | $0.60 | fix pass, review pass, rounding pass |

## Explore: per-model usage including subagents

| run | env | model | cache write | cache read | output | cost |
| --- | --- | --- | --- | --- | --- | --- |
| explore-opus-haiku-sub | CLAUDE_CODE_SUBAGENT_MODEL=haiku CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1 | claude-haiku-4-5-20251001 | 23K | 147K | 4K | $0.07 |
| explore-opus-haiku-sub | CLAUDE_CODE_SUBAGENT_MODEL=haiku CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1 | claude-opus-5 | 29K | 27K | 1K | $0.33 |
| explore-opus-inherit | - | claude-haiku-4-5-20251001 | 0 | 0 | 16 | $0.00 |
| explore-opus-inherit | - | claude-opus-5 | 48K | 119K | 8K | $0.63 |
| explore-opus-inherit#2 | - | claude-haiku-4-5-20251001 | 0 | 0 | 16 | $0.00 |
| explore-opus-inherit#2 | - | claude-opus-5 | 55K | 270K | 13K | $0.86 |
| explore-opus-haiku-sub#2 | CLAUDE_CODE_SUBAGENT_MODEL=haiku CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1 | claude-haiku-4-5-20251001 | 31K | 489K | 6K | $0.12 |
| explore-opus-haiku-sub#2 | CLAUDE_CODE_SUBAGENT_MODEL=haiku CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1 | claude-opus-5 | 29K | 27K | 1K | $0.33 |
| explore-opus-haiku-sub#3 | CLAUDE_CODE_SUBAGENT_MODEL=haiku CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1 | claude-haiku-4-5-20251001 | 30K | 212K | 5K | $0.08 |
| explore-opus-haiku-sub#3 | CLAUDE_CODE_SUBAGENT_MODEL=haiku CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1 | claude-opus-5 | 30K | 56K | 1K | $0.36 |
| explore-opus-inherit#3 | - | claude-haiku-4-5-20251001 | 0 | 0 | 15 | $0.00 |
| explore-opus-inherit#3 | - | claude-opus-5 | 31K | 121K | 6K | $0.47 |
