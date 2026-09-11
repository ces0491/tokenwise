# What the bench found

Fifty-two graded runs across five task types, plus five ungraded session resumes, on Claude Code 2.1.263, 8 September 2026, against `claude-haiku-4-5-20251001`, `claude-sonnet-5`, `claude-opus-5` and `claude-fable-5-1`. `methodology.md` describes how the tasks and graders were built, `../bench/RESULTS.md` holds the generated tables, and `../bench/SCOPE.md` the criteria fixed before the results were read.

## The short version

On a small, well-specified codebase, every model and effort level tested passed every graded run, and on the implement task the cost of doing so varied nearly sixteen-fold. Four of the skill's eight claims were wrong, in three different ways: two named a more expensive setting than the work required, one saved less than the bench's pass mark, and one recommended a split that cost more than not splitting.

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

## Review: high effort found nothing low effort missed

The review case gave each run an uncommitted six-file diff carrying five planted defects among benign refactors, with all 29 visible tests passing.

| Review a diff | Recall | False positives | Turns | Cost |
| --- | --- | --- | --- | --- |
| sonnet, high (n=3) | 4, 4, 5 of 5 | 0 | 11 | $0.24 |
| opus, low (n=3) | 5 of 5 every run | 0 | 3 | $0.25 |
| fable, high | 5 of 5 | 0 | 5 | $0.79 |
| opus, high (n=3) | 5 of 5 every run | 0 | 13 | $0.82 |

Opus at low effort found all five defects in three turns. Opus at high effort found the same five in thirteen turns for 3.3 times the cost. The extra ten turns went into reading the diff and turned up nothing further. Sonnet at high effort was the cheapest cell but missed the in-place array sort in two runs of three, which is the defect that requires noticing a side effect rather than comparing code against a documented rule.

The planted defects were: a strict `<` where the documentation says `<=`; a `sort()` mutating its caller's array; `Math.round` substituted for half-away-from-zero rounding, which only diverges on negative values; a CSV quoting regex narrowed so newlines break the round-trip; and a `monthKey` rewritten to parse through `Date`, which shifts the month in any timezone behind UTC. The CSV defect ships with a deleted test assertion and a trimmed round-trip test that used to catch it, so the suite passes with the bug in place. A sixth change, a `sign()` helper extracted in `money.js`, is behaviour-preserving and is there to be left alone.

## What routing itself costs

The task runs above load no plugins, so none of their costs include the skill. `../bench/skill-cost.mjs` measures it in separate sessions on the same fixture with the plugin loaded. The table compares versions on Opus 5 at xhigh effort, one session per case; other settings follow under "By the setting you ask from". It comes from `node bench/skill-cost.mjs --compare 1.0.1,1.1.0-inline@1.0.1,1.1.2`, which reads the saved transcripts and spends nothing.

| | 1.0.1 | 1.1.0 draft without the fork | 1.1.2 |
| --- | --- | --- | --- |
| Context the plugin adds while never used | 122 tokens | 122 tokens | 131 tokens |
| A route in a session already under way | $0.165 | $0.114 | $0.137 |
| Context every later call carries after one route | 9.6K | 6.8K | 828 |
| The next reply after that route (a session never routed: $0.023) | $0.072 | $0.050 | $0.031 |
| A route as a session's first message, plus the reply after it | $0.441 | $0.321 | $0.439 |
| "Which model and effort should I use?" in plain words: turn cost, then context carried | $0.309, 7.8K | $0.246, 5.3K | $0.331, 1.6K |

In 1.0.1 most of what a route left behind was its answer and the thinking behind it, not the skill's text. The skill added about 3K tokens; the routing turn wrote 6,447 tokens of output, 5,368 of them thinking. It also ran a shell command to check the subagent environment variables.

Version 1.1 makes two changes. The skill tells the model to route from its own text and the user's description, without reading files, running commands or checking settings, and to keep its reasoning short. In a draft of 1.1.0 run without the fork, whose `SKILL.md` is saved beside its transcripts in `../bench/results/skill-cost/1.1.0-inline/`, that cut a warm routing turn's output from 4,361 tokens to 2,293. And the skill runs in a forked subagent (`context: fork`), so its text and reasoning stay in the subagent and only the answer returns: 828 tokens.

The fork costs more on a session's first message, because the subagent builds its own context: $0.439 against $0.321 without it. The API pricing page puts an Opus 5 cache read at $0.50 per million tokens, so carrying 6.0K fewer tokens saves $0.003 on each later call, and the difference is repaid on the 40th. In a session already under way, a route and the reply after it cost $0.167 against $0.164 without the fork, repaid on the second later call.

Single runs of the same text vary. The 1.1.1 routing session ran twice on an identical `SKILL.md` and Claude Code version (`--compare 1.1.1@1.0.1,1.1.1-r2@1.0.1`), and a route in a session already under way cost $0.155 and $0.129, $0.025 apart. The 1.1.2 route at xhigh cost $0.137, between those two.

The forked skill cannot see the conversation. It routes from the description typed after `/tokenwise:route`, answers a bare `/tokenwise:route` by asking for one (`--report 1.1.0@1.0.1`), and points to `/context` for the context size a switch would re-process. Claude invoked it unprompted when asked in plain words which model and effort to use, and did not invoke it in the session that asked how many tokens had been used.

### By the setting you ask from

A route runs on the session's own model and effort, so its cost depends on the setting you ask from. The routing session ran once on each of three settings against the 1.1.2 `SKILL.md`, from `node bench/skill-cost.mjs --compare 1.1.2,1.1.2-opus-high@1.1.2,1.1.2-sonnet-medium@1.1.2`.

| Asking from | A route in a session already under way | Context carried after one route | A route as a session's first message, plus the reply after it |
| --- | --- | --- | --- |
| Opus 5, xhigh | $0.137 | 828 | $0.439 |
| Opus 5, high | $0.105 | 622 | $0.249 |
| Sonnet 5, medium | $0.040 | 689 | $0.163 |

Claude Code's model configuration docs give `high` as the default effort on every model except Opus 4.7, and Opus 5 as the default model on Max, Team Premium, Enterprise and the API, so the Opus 5 at high row is where those plans start. Pro and Team Standard default to Sonnet 5 at high, which was not measured.

All three routing sessions recommended the same model and effort for both tasks, and each said in at least one of its two answers that changing model or effort on a warm context re-processes it. Sonnet 5 at medium wrote the shortest answers, 178 and 200 words against 263 to 360 for Opus.

### Where a route pays for itself

![What each setting cost on the bench's tasks, what a route costs from three settings, and the task sizes where a route pays for itself](breakeven.svg)

`node bench/breakeven.mjs` draws the chart from the published runs and prints every figure in it. A route pays when the task saves more than the route cost. Across the four tasks, the recommended setting cost a median 70% less than the setting it moved from.

| Task | Moved from | Recommended | Saved | Share saved |
| --- | --- | --- | --- | --- |
| implement | Opus 5, xhigh: $1.65 | Sonnet 5, medium: $0.28 | $1.36 | 83% |
| chore | Opus 5, xhigh: $0.25 | Sonnet 5, low: $0.08 | $0.17 | 67% |
| debug | Opus 5, high: $0.41 | Sonnet 5, medium: $0.12 | $0.29 | 70% |
| review | Opus 5, high: $0.82 | Opus 5, low: $0.25 | $0.57 | 70% |

With that share held fixed, a route costs more than it saves on a task that would cost less than the route's cost divided by 0.70 on the setting you are on, and saves less than twice its cost up to double that.

| Asking from | Costs more than it saves below | Saves less than twice its cost below |
| --- | --- | --- |
| Sonnet 5, medium | $0.06 | $0.12 |
| Opus 5, high | $0.15 | $0.30 |
| Opus 5, xhigh | $0.20 | $0.39 |

The bench's rename falls in the middle band for Opus 5 at xhigh: moving it to Sonnet 5 at low saved $0.171, and asking cost $0.137. That $0.034 margin is not much larger than the $0.025 between two runs of the same route. The other three tasks land where a route saves more than twice its cost. On a session already running the setting a route recommends, a route saves nothing, whatever the task size.

The 70% was measured on small tasks. Whether a larger task saves the same share on the cheaper setting is untested, so the bands extend the measurements to sizes the bench did not run.

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

**The review recall figures come from a grader that was corrected four times.** It charged false positives for a defect explained across several paragraphs, and it scored a correct answer one of five because that answer put the file name and the keyword in different markdown blocks. After publication, the patterns for the CSV defect were narrowed to its mechanism, since words like "test" and "deleted" appear in any mention of that file. Later it turned out to pass a one-line answer that described no defect, and to miss invented findings. It now grades each finding, led by its file:line reference, against the mechanism of each defect. Every saved answer keeps the grade it was published with, it agrees with every hand grade on record, and `../bench/results/hand-grades.json` decides pass or fail for the runs it covers. The C5 verdict rests on those figures.

## What this does not tell you

- **Nothing about large contexts.** No graded run averaged more than 52K tokens of context per turn. Sessions over 100K tokens per call are covered by the observational measurements in `../skills/route/reference.md`.
- **Nothing about where expensive settings pay off.** All 52 graded runs passed, so the ceiling was never reached.
- **Nothing about `max` effort or ultracode.** No run used either, so the skill's effort ladder carries no measurement for them.
- **Little about how much a route's cost varies.** Each setting's route ran once on the shipped text, and Sonnet 5 at high, the default on Pro and Team Standard, did not run.
- **Nothing about other codebases.** A single small JavaScript library, five tasks, run on one machine over a day.
- **Nothing about subscription quota.** Costs are Claude Code's list-price figures. How usage draws down against a Pro or Max plan is not published.
