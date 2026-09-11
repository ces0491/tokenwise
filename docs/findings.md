# What the bench found

Fifty-two graded runs across five task types, plus five ungraded session resumes, on Claude Code 2.1.263, 8 September 2026. `methodology.md` describes how the tasks and graders were built, `../bench/RESULTS.md` holds the generated tables, and `../bench/SCOPE.md` the criteria fixed before the results were read.

## The short version

On a small, well-specified codebase, every model and effort level tested passed every graded run, and the cost of doing so varied by fifteen times. Four of the skill's eight claims were wrong, in three different ways: two named a more expensive setting than the work required, one saved less than the bench's pass mark, and one recommended a split that cost more than not splitting.

## Cost at equal outcomes

Every cell in these three cases passed every run.

| Implement a feature from a spec | Cost | Turns |
| --- | --- | --- |
| haiku | $0.17 | 19 |
| sonnet, low | $0.24 | 15 |
| sonnet, medium (n=3) | $0.28 | 17 |
| sonnet, high | $0.42 | 21 |
| sonnet, xhigh (n=3) | $0.62 | 25 |
| opus, medium (n=3) | $0.86 | 11 |
| opus, xhigh (n=3) | $1.65 | 16 |
| fable, xhigh | $2.63 | 14 |

| Fix a reproducible bug | Cost |
| --- | --- |
| haiku | $0.06 |
| sonnet, medium (n=3) | $0.12 |
| sonnet, xhigh | $0.16 |
| opus, high (n=3) | $0.41 |
| opus, xhigh | $0.44 |

| Rename a function everywhere | Cost |
| --- | --- |
| haiku (n=3) | $0.06 |
| sonnet, low (n=3) | $0.08 |
| opus, xhigh (n=3) | $0.25 |

Implementing the credit-note feature cost $0.17 on Haiku and $2.63 on Fable at xhigh, and both produced code that passed the same 37 tests, including 8 hidden ones written from the spec before any run. The pass counts in `../bench/RESULTS.md` run higher, such as 53/53 and 59/59, because they also count the tests each model wrote. Restoring the original tests overwrites them without deleting new test files.

Because every run passed, these runs cannot show where the expensive settings earn their price. The tasks are small, the specs are complete, and the bugs have failing tests pointing at them. Separating the models would take a harder task set than this one.

## Where the cost differences come from

Model and effort raise the cost through different mechanisms, and the per-run token columns in `../bench/RESULTS.md` separate them.

**The model sets the price of each token.** On the rename, Opus 5 at xhigh and Sonnet 5 at low both finished in five or six turns over about the same context: 128K to 130K cached tokens read against 121K to 122K. Opus cost $0.25 and Sonnet $0.08. The API pricing page lists Opus 5 at 2.5 times Sonnet 5 on every token class, and the two models share a tokenizer, so the price per token accounts for most of the gap. Opus writing a little more output and cache makes up the rest.

A cheaper model can also take more turns and still cost less. Haiku took 16 or 17 turns on the rename against five for Opus and was the cheapest cell at $0.06. On the implement case it took 19 turns against a median of 11 for Opus at medium, and cost $0.17 against $0.86. Compare Haiku by turns and cost rather than raw token counts: the pricing page says models from Claude 4.7 on use a newer tokenizer that produces about 30% more tokens for the same text, and Haiku 4.5 predates 4.7.

**Effort changes how many tokens get spent.** Effort doesn't appear in the price table. It shows up as more output, most of it thinking, and more turns, each re-reading the context. How much it adds depends on how much room the task leaves for reading and reasoning.

| Task | Lower effort | Higher effort | What grew |
| --- | --- | --- | --- |
| Fix a reproducible bug, opus | high: 8 or 9 turns, $0.41 median | xhigh (n=1): 9 turns, $0.44 | Nothing beyond single-run noise |
| Fix a reproducible bug, sonnet | medium: 7 or 8 turns, $0.12 median | xhigh (n=1): 11 turns, $0.16 | Turns, though the cost difference is within single-run noise |
| Implement from a spec, opus | medium: 8 to 14 turns, 8K to 14K output, 263K to 519K cache read, $0.86 median | xhigh: 14 to 18 turns, 25K to 30K output, 651K to 825K cache read, $1.65 median | Output, most of the increase thinking (674 to 1K rising to 10K to 15K), and context |
| Review a diff, opus | low: 3 turns, 2K output, 72K to 73K cache read, $0.25 | high: 12 or 13 turns, 8K to 11K output, 449K to 512K cache read, $0.82 median | Context, from the extra turns, and output |

On the rename, Opus at xhigh spent 100 to 209 thinking tokens across its five turns, the same turn count as Sonnet at low. The bench has no lower-effort Opus run on that case, but there was little thinking for a lower setting to remove.

## Review: more effort made it worse

The review case gave each run an uncommitted six-file diff carrying five planted defects among benign refactors, with all 29 visible tests passing.

| Review a diff | Recall | False positives | Turns | Cost |
| --- | --- | --- | --- | --- |
| sonnet, high (n=3) | 4, 4, 5 of 5 | 0 | 11 | $0.24 |
| opus, low (n=3) | 5 of 5 every run | 0 | 3 | $0.25 |
| fable, high | 5 of 5 | 0 | 5 | $0.79 |
| opus, high (n=3) | 5 of 5 every run | 0 | 13 | $0.82 |

Opus at low effort found all five defects in three turns. Opus at high effort found the same five in thirteen turns for 3.3 times the cost. The extra ten turns went into reading the diff and turned up nothing further. Sonnet at high effort was the cheapest cell but missed the in-place array sort in two runs of three, which is the defect that requires noticing a side effect rather than comparing code against a documented rule.

The planted defects were: a strict `<` where the documentation says `<=`; a `sort()` mutating its caller's array; `Math.round` substituted for half-away-from-zero rounding, which only diverges on negative values; a CSV quoting regex narrowed so newlines break the round-trip; and a `monthKey` rewritten to parse through `Date`, which shifts the month in any timezone behind UTC. The CSV defect ships with a deleted test assertion and a trimmed round-trip test that used to catch it, so the suite passes with the bug in place. A sixth change, a `sign()` helper extracted in `money.js`, is behaviour-preserving and is there to be left alone.

## Claim by claim

| Claim | Verdict |
| --- | --- |
| Chores go to Sonnet or Haiku at low effort | Holds. Both passed every run at a third and a quarter of the cost of Opus at xhigh. |
| Implementing from a written spec goes to Sonnet at medium | Holds. Passed every run at 17% of the cost of Opus at xhigh. |
| Raise effort before upgrading the model | Supported, though the pre-registered test was written backwards. See below. |
| Debugging goes to the top model at high effort | Falsified. Sonnet at medium fixed the bug in all three runs for a third of Opus's cost. |
| Reviews keep effort high | Falsified. Opus at low matched Opus at high on recall for a third of the cost. |
| Forcing subagents onto Haiku saves at least 40%, the bench's pass mark | Falsified on the threshold. The mechanism works and saved 30%. |
| The prompt cache is per model | Not testable through this harness. Retained as documented behaviour. |
| Planning on Opus then implementing on Sonnet is cheaper | Falsified on cost. The split cost $2.50 against $1.65 for one Opus session. |

## Two verdicts that need a caveat

Every change made to a grader or a criterion after runs had been seen is dated in `../bench/SCOPE.md`'s revision history, with what it did to the verdicts. Two of them change how a row above should be read.

**C3's criterion was written backwards.** The claim "raise effort before upgrading the model" is tested by asking whether staying on Sonnet and raising effort beats moving to Opus and keeping effort low. The criterion asked the opposite, and would have counted Opus-at-medium winning as support for effort-first. Under the criterion as written the claim is falsified; under the claim as named the data supports it, with Sonnet at xhigh costing $0.59 per completed task against $0.82 for Opus at medium and both passing every run. Both readings are in the table. No threshold moved after seeing data.

**The review recall figures come from a grader that was corrected twice.** It charged false positives for a defect explained across several paragraphs, and it scored a correct answer one of five because that answer put the file name and the keyword in different markdown blocks. It now matches by proximity and agrees with every hand grade on record, and `../bench/results/hand-grades.json` decides pass or fail for the runs it covers. The C5 verdict rests on those figures.

## What this does not tell you

- **Nothing about large contexts.** Context per turn peaks at 52K tokens on this fixture. The regime where cache reads dominate is covered by the observational measurements in `../skills/route/reference.md`, not by this bench.
- **Nothing about where expensive settings pay off.** All 52 graded runs passed, so the ceiling was never reached.
- **Nothing about `max` effort or ultracode.** No run used either, so the skill's effort ladder carries no measurement for them.
- **Nothing about other codebases.** A single small JavaScript library, five tasks, run on one machine over a day.
- **Nothing about subscription quota.** Costs are Claude Code's list-price figures. How usage draws down against a Pro or Max plan is not published.
