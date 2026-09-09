# What the bench found

Fifty-two graded runs across five task types, plus five ungraded session resumes, on Claude Code 2.1.263, 8 September 2026. `methodology.md` describes how the tasks and graders were built, `../bench/RESULTS.md` holds the generated tables, and `../bench/SCOPE.md` the criteria fixed before the results were read.

## The short version

On a small, well-specified codebase, every model at every effort level passed every graded run, and the cost of doing so varied by fifteen times. Four of the eight claims the routing table made were wrong, in three different ways: two named a more expensive setting than the work required, one overstated a saving, and one recommended a split that cost more than not splitting.

The routing table has been corrected. Its debug and review rows now start on Sonnet and Opus-at-low respectively, rather than the top model at high effort.

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

The spread is the finding. Implementing the credit-note feature cost $0.17 on Haiku and $2.63 on Fable at xhigh, and both produced code that passed the same 37 tests, including 8 hidden ones written from the spec before any run.

This is a measurement of cost at equal outcomes, and that is also its limit. Because everything passed, these runs cannot show where the expensive settings earn their price. The tasks are small, the specs are complete, and the bugs have failing tests pointing at them. A harder task set would separate the models; this one separates their prices.

## Review: more effort made it worse

The review case gave each run an uncommitted six-file diff carrying five planted defects among benign refactors, with all 29 visible tests passing.

| Review a diff | Recall | False positives | Turns | Cost |
| --- | --- | --- | --- | --- |
| sonnet, high (n=3) | 4, 4, 5 of 5 | 0 | 11 | $0.24 |
| opus, low (n=3) | 5 of 5 every run | 0 | 3 | $0.25 |
| fable, high | 5 of 5 | 0 | 5 | $0.79 |
| opus, high (n=3) | 5 of 5 every run | 0 | 13 | $0.82 |

Opus at low effort found all five defects in three turns. Opus at high effort found the same five in thirteen turns for 3.3 times the cost. The extra effort bought reading, not findings. Sonnet at high effort was the cheapest cell but missed the in-place array sort in two runs of three, which is the defect that requires noticing a side effect rather than comparing code against a documented rule.

The planted defects were: a strict `<` where the documentation says `<=`; a `sort()` mutating its caller's array; `Math.round` substituted for half-away-from-zero rounding, which only diverges on negative values; a CSV quoting regex narrowed so newlines break the round-trip; and a `monthKey` rewritten to parse through `Date`, which shifts the month in any timezone behind UTC. The CSV defect ships with a pair of deleted test assertions that used to catch it, so the suite passes with the bug in place. A sixth change, a `sign()` helper extracted in `money.js`, is behaviour-preserving and is there to be left alone.

## Claim by claim

| Claim | Verdict |
| --- | --- |
| Chores go to Sonnet or Haiku at low effort | Holds. Both passed every run at a third and a quarter of the cost of Opus at xhigh. |
| Implementing from a written spec goes to Sonnet at medium | Holds. Passed every run at 17% of the cost of Opus at xhigh. |
| Raise effort before upgrading the model | Supported, though the pre-registered test was written backwards. See below. |
| Debugging goes to the top model at high effort | Falsified. Sonnet at medium fixed the bug in all three runs for a third of Opus's cost. |
| Reviews keep effort high | Falsified. Opus at low matched Opus at high on recall for a third of the cost. |
| Forcing subagents onto Haiku saves 40% | Falsified on the threshold. The mechanism works and saved 30%. |
| The prompt cache is per model | Not testable through this harness. Retained as documented behaviour. |
| Planning on Opus then implementing on Sonnet is cheaper | Falsified on cost. The split cost $2.50 against $1.65 for one Opus session. |

## Where the pre-registration went wrong

Three corrections made while the matrix was running, all recorded in the scope file's revision history rather than edited away.

**One criterion was written backwards.** The claim "raise effort before upgrading the model" should be tested by asking whether staying on Sonnet and raising effort beats moving to Opus and keeping effort low. The criterion asked the opposite, and would have counted Opus-at-medium winning as support for effort-first. Under the criterion as written, the claim is falsified. Under the claim as named, the data supports it: Sonnet at xhigh cost $0.59 per completed task against $0.82 for Opus at medium, with both passing every run. Both readings are reported and no threshold was moved after seeing data.

**The review grader was wrong twice.** First it charged false positives for a defect explained across several paragraphs, counting each paragraph separately; hand reading four answers found zero false positives where the grader counted eight, two, one and two. Then, after that fix, a replicate that formatted findings as `**File**:` and `**Defect**:` on separate lines scored one of five, because the file name and the keyword landed in different blocks. Hand reading showed it had found four. The grader now matches a defect when a mention of its file has one of its keywords within 700 characters, and it agrees with every hand grade on record. Without that check, this report would have claimed Sonnet collapses on review, which is not what happened.

**One claim could not be tested at all.** The per-model prompt cache is unmeasurable through `claude -p --resume`, because resuming starts a new process and the control resume on the *same* model already rewrote the whole prefix, reading 15K tokens and writing 65K. A second design failed too, because the later Sonnet resume could read a cache that an earlier Sonnet run had written. The claim stays in the routing table on the authority of the Claude Code documentation, labelled as documentation rather than as a bench result.

## A usage limit is not a failure

Partway through replication the account hit its session limit and 23 runs returned HTTP 429 without attempting their task. The summariser counted them as failures, which produced zero-dollar medians and flipped several verdicts. Runs that fail this way are now marked invalid and retried, and the report carries a "Runs excluded" table for any that are still excluded when it is generated. All 23 completed on retry, so that table reads "None". Anyone rerunning this bench on a subscription will hit the same wall.

## What this does not tell you

- **Nothing about large contexts.** Context per turn peaks at 52K tokens on this fixture. The regime where cache reads dominate is covered by the observational measurements in `../skills/route/reference.md`, not by this bench.
- **Nothing about where expensive settings pay off.** All 52 graded runs passed, so the ceiling was never reached.
- **Nothing about other codebases.** One small JavaScript library, five tasks, one machine, one day.
- **Nothing about subscription quota.** Costs are Claude Code's list-price figures. How usage draws down against a Pro or Max plan is not published.
