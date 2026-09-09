# SCOPE — tokenwise bench

## Purpose

Test whether each recommendation in `skills/route/SKILL.md` holds on verifiable tasks: does the cheaper model or effort it names still complete the task, and at what fraction of the top setting's cost.

Written 2026-09-08 12:45 UTC while the first matrix was running. Results seen at that point: the pilot (`chore-haiku`), `chore-sonnet-low` and `chore-opus-xhigh`. Every other criterion below was fixed before its data was read.

## Definitions

- A run **passes** when its grader says so: all restored original tests plus all hidden tests green (`implement`, `debug`); tests green and no old name left (`chore`); the required mentions present (`explore`); recall of at least 4 of 5 planted defects with at most 2 false-positive blocks (`review`).
- **Cost** is Claude Code's list-price figure from the run's JSON result.
- **Cost per completed task** is cost divided by pass rate. A cell that never passes has no finite cost per completed task.
- **Replication rule.** The first matrix is one run per cell. Any verdict below that would flip if one run flipped is re-run until both cells being compared have n = 3, and the verdict uses pass counts and median cost. Verdicts on deterministic mechanisms (C7) need no replication.
- Differences in cost under 30% between single runs are treated as noise, never as evidence.

## Done

Each claim gets a recorded verdict of **holds**, **falsified**, or **not testable here**, and `SKILL.md` is edited to match every falsified claim before the results are published.

- [ ] **C1 Chores: sonnet or haiku at low.** Holds if `chore-sonnet-low` and `chore-haiku` pass and each costs at most 50% of `chore-opus-xhigh`.
- [ ] **C2 Implement from a written spec: sonnet at medium.** Holds if `implement-sonnet-medium` passes in at least 2 of 3 runs and its median cost is at most 50% of `implement-opus-xhigh`. If it passes in 0 or 1 of 3, the row moves to opus. If it passes but costs more than 50%, the row keeps sonnet and drops the cost claim.
- [ ] **C3 Effort before model.** Holds if `implement-opus-medium` has a cost per completed task at most that of `implement-sonnet-xhigh`. Otherwise the sentence "try effort before model" is removed from the skill.
- [ ] **C4 Debug a subtle failure: top model at high or xhigh.** Holds if `debug-opus-high` or `debug-opus-xhigh` passes and `debug-sonnet-medium` fails in at least 2 of 3 runs. If sonnet at medium passes as often as opus, the row becomes "sonnet first, escalate on failure" with a note that the tested bug fits in a small context.
- [ ] **C5 Review: lower the reading, not the effort.** Holds if `review-opus-high` recalls at least one more planted defect than `review-opus-low` (median of 3). If recall is equal or reversed, the row changes to allow low effort for reviews of this size. Separately, if `review-sonnet-high` matches `review-opus-high` on recall with no more false positives, the row's model recommendation is softened to "sonnet or above".
- [ ] **C6 Force subagents onto haiku.** Holds if `explore-opus-haiku-sub` passes, its per-model usage shows the subagent ran on haiku, and its total cost is at most 60% of `explore-opus-inherit`.
- [ ] **C7 The prompt cache is per model.** Holds if resuming on the switched model (`cache-resume-switch-model`) reads under 10% of the cached tokens that the same-model resume (`cache-resume-same-model`) reads, and writes at least 80% of that amount back to cache. Deterministic; one run each.
- [ ] **C8 Plan on the top model, implement on sonnet.** Holds if `split-impl-sonnet-medium` passes and the two split runs together cost at most `implement-opus-xhigh`. If the split costs more, the protocol keeps its cache-boundary justification (C7) and the skill drops any implied cost saving for small tasks.
- [ ] **Grader check.** Four review answers read by hand against the grader's verdicts. If the grader disagrees with the hand read on more than one defect across the four, every review run is re-graded by hand and the keyword grader is marked unreliable in `RESULTS.md`.
- [ ] `RESULTS.md` published with n per cell, the verdict per claim, and the raw JSON for every run in `results/`.

## Out of scope

- Judging prose, plan quality or code style. Only the graders count.
- The long-context regime (over 100K tokens per call). The fixture stays under 50K per call; the observational measurements in `skills/route/reference.md` cover the rest.
- Latency as a criterion. Wall time is recorded, not judged.
- Statistical tests beyond the replication rule.
- Languages, repositories or task sizes other than this fixture.
- Fable on every cell. It runs on `implement` and `review` only, to bound spend.

## Bar

Research experiment. Correct on this fixture, reproducible from the repo with `node bench/run.mjs`, results published whatever they show. Not a general benchmark of the models.

## Decision

Ces, after reading `RESULTS.md` and the per-claim verdicts. A falsified claim changes `SKILL.md`; it does not get argued around.

## Revision history

- 2026-09-09, after publication: **two instruments tightened, neither changing a verdict.** The review grader credited the `csv-newline` defect on the words "test", "assert", "removed", "deleted", "dropped" and "weaken", which the defect's own cover story makes common in any answer that mentions the file at all; the patterns now name the mechanism (newline, line break, round-trip) only. All ten review answers were re-graded and every recall and false-positive figure is unchanged. Separately, C6's automated check credited "the subagent ran on haiku" whenever a haiku key appeared in the run's per-model usage, which is true of both arms because Claude Code makes its own small haiku calls; it now requires haiku output and cache traffic above 10K tokens, which separates the arms by 175K-527K against 15-16. C6's verdict is unchanged: it fails on cost, not on the mechanism.
- 2026-09-09: two figures in the surrounding docs corrected against the data. Context per turn on this fixture peaks at 52K, not under 50K as the out-of-scope section below says, and the fixed per-call overhead is 19K to 28K tokens rather than a flat 19K. Neither is a threshold and no verdict depends on either.
- 2026-09-08: initial scope, written mid-run with three chore results already seen.
- 2026-09-08 18:50 UTC, after replication: **the review grader now matches by proximity, not by markdown block.** A replicate that formatted each finding as `**File**:` / `**Defect**:` / `**Concrete input**:` on separate lines scored 1 of 5 from the block-based grader, because the file name and the keyword landed in different blocks. Hand reading showed it had found four of the five. A defect now counts as found when a mention of its file has one of its keywords within 700 characters, and a false positive is a file mention with no planted defect explained near it. All ten review answers were re-graded and the result agrees with every hand grade on record. The keyword thresholds themselves did not change.
- 2026-09-08 18:40 UTC, after replication: **C3's test was written backwards relative to the claim it names.** The claim "effort before model" advises raising effort on the current model before upgrading the model. The correct comparison is therefore whether `implement-sonnet-xhigh` (raise effort, keep the cheap model) beats `implement-opus-medium` (upgrade the model, keep effort low) on cost per completed task. The criterion as written asked the opposite, holding only if opus-medium was the cheaper of the two. The error is left in the text above rather than edited out, and both readings are reported: under the criterion as written C3 is falsified; under the claim as named the data supports it. No threshold was changed after seeing data.
- 2026-09-08 13:05 UTC, after the first matrix: two changes, both made before the replication runs.
  - **C7 redesigned.** The same-model control resume also re-wrote the whole conversation to cache (read 15K, wrote 65K), so the first design could not separate "resuming rebuilds the prefix" from "the cache is per model". New design: after the two first-pass resumes, two more resumes on opus back to back (`-2`, `-3`), then one on sonnet (`switch-model-2`). C7 holds if `cache-resume-switch-model-2` reads under 25% of what `cache-resume-same-model-3` reads and writes at least 80% of that amount. Holds only if `-3` itself reads more than it writes; otherwise the mechanism is not testable through `--resume` and the verdict is "not testable here".
  - **C7 is not testable through this harness.** The redesign did not work either. The first resume on the *same* model already rewrote the whole prefix to cache (read 15K, wrote 65K), because `claude -p --resume` starts a new process rather than continuing a warm session, and by the time the later sonnet resume ran, sonnet had cached this conversation in the earlier switch run. Verdict is "not testable here": the per-model cache stays in the skill on the documentation's authority, cited as documentation rather than as a bench measurement.
  - **Usage-limit runs are excluded, not failed.** The first replication attempt hit the session limit and 23 runs returned HTTP 429 without attempting their task. The runner now marks such runs invalid, deletes their result file so they are retried, and the report lists them in a "Runs excluded" table. They never count as failures.
  - **Grader check failed on false positives, not recall.** Hand reading of the four review answers agreed with the keyword grader on every defect found and missed, but the grader charged 8, 2, 1 and 2 false positives where the hand count was 0 in all four, because a defect explained across several paragraphs was counted once per paragraph. The false-positive rule now checks every planted defect against each block. Hand grades are recorded in `results/hand-grades.json` and shown next to the grader's in `RESULTS.md`; the hand count decides pass/fail for those four runs.
