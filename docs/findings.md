# What the bench found

A hundred and eleven graded runs across five task types, alone and three at a time in one prompt, plus five ungraded session resumes, on Claude Code 2.1.263 on 8 September 2026, 2.1.270 on 14 and 15 September and 2.1.280 on 23 September, against `claude-haiku-4-5-20251001`, `claude-sonnet-5`, `claude-opus-5`, `claude-opus-5-5` and `claude-fable-5-1`. `methodology.md` describes how the tasks and graders were built, `../bench/RESULTS.md` holds the generated tables, and `../bench/SCOPE.md` the criteria fixed before the results were read.

## The short version

On a small, well-specified codebase, every model and effort level tested passed every graded run, and on the implement task the cost of doing so varied nearly sixteen-fold. Of the twelve claims in `../bench/SCOPE.md`, seven were falsified:

- two named a more expensive setting than the work required
- one saved less than the bench's pass mark
- three split work in ways that did not pay: planning and implementing separately cost more than one session, and sending each job in a prompt to its own worker missed the bar with small jobs and with a large one
- one found Sonnet 5 at medium, the setting setup recommends, saving materially on only one task of four against Opus 5.5 at medium, the account default from Claude Code 2.1.280

The claim on ultracode held on the review, where a workflow found the same defects as `xhigh` for 9.5 times the cost, and could not be tested on the bug fix, where no workflow started.

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
| opus, xhigh (n=3) | $0.35 |

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
| Fix a reproducible bug, opus | high: 8 or 9 turns, $0.41 median | xhigh (n=3): 9 or 10 turns, $0.35 median | Nothing measurable. The high runs were on Claude Code 2.1.263, and two of the three xhigh runs on 2.1.270, which starts sessions smaller; the one xhigh run on 2.1.263 cost $0.44 |
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

A route runs on the session's own model and effort, so its cost depends on the setting you ask from. The routing session ran once on each of three settings against the 1.5.0 `SKILL.md`, on Claude Code 2.1.280, from `node bench/skill-cost.mjs --compare 1.5.0@1.3.2,1.5.0-opus-high@1.5.0,1.5.0-sonnet-medium@1.5.0`. `opus` resolves to Opus 5.5 on that version, so the Opus sessions were pinned to `claude-opus-5`, the model the task runs below used.

| Asking from | A route in a session already under way | Context carried after one route | A route as a session's first message, plus the reply after it |
| --- | --- | --- | --- |
| Opus 5, xhigh | $0.141 | 910 | $0.423 |
| Opus 5, high | $0.125 | 898 | $0.411 |
| Sonnet 5, medium | $0.045 | 337 | $0.183 |

Loaded and never used, the 1.5.0 plugin adds 152 tokens of context. The route skill's name and description, all that loads, are the same as in 1.3.2 and 1.4.0, whose sessions on the same Claude Code version gave 153 and 148, so that spread is between runs of the same text. Setup's description stays out of context because it runs only when typed, and the hooks write nothing into the conversation. The 1.4.0 route at xhigh cost $0.144 and left 873 tokens, within the $0.025 that two runs of identical text differed by. On Claude Code 2.1.280 a Sonnet 5 session started 11.4K tokens larger than an Opus 5 one, so the Sonnet figures are measured against a Sonnet idle session of their own. `methodology.md` records both.

From Claude Code 2.1.280, Claude Code's model configuration docs give Opus 5.5 at `medium` as the default on Pro, Max, Team, Enterprise and the API. No route has run on it, so the hooks' threshold for a session on Opus 5.5 is the cheapest route, $0.045. Before 2.1.280, Max, Team Premium, Enterprise and the API started on Opus 5 at `high`, the second row, and Pro and Team Standard on Sonnet 5 at `high`, which was not measured.

All three routing sessions recommended the same model and effort for both tasks. Every answer gave the switch for this session only, with `s` in the `/model` picker, and said that changing model or effort on a warm context re-processes it. All four Opus answers ruled ultracode out, because the work does not split into independent parts or because of its measured cost on the review, and two of them suggested `ultrathink` for a single hard turn before changing effort or model. Three of the Opus answers said their evidence came from Opus 5, or quoted C12's comparison with Opus 5.5. Sonnet 5 at medium wrote the shortest answers, 154 and 218 words against 384 to 401 for Opus. Neither suggested `ultrathink`, and one mentioned ultracode only to rule it out.

### Where a route pays for itself

![What each setting cost on the bench's tasks, what a route costs from three settings, and the task sizes where a route pays for itself](breakeven.svg)

`node bench/breakeven.mjs` draws the chart from the published runs and prints every figure in it. A route pays when the task saves more than the route cost. Across the four tasks, the recommended setting cost a median 70% less than the setting it moved from. The task costs come from runs on Claude Code 2.1.263 and 2.1.270, and the route costs from 2.1.280.

| Task | Moved from | Recommended | Saved | Share saved |
| --- | --- | --- | --- | --- |
| implement | Opus 5, xhigh: $1.65 | Sonnet 5, medium: $0.28 | $1.36 | 83% |
| chore | Opus 5, xhigh: $0.25 | Sonnet 5, low: $0.08 | $0.17 | 67% |
| debug | Opus 5, high: $0.41 | Sonnet 5, medium: $0.12 | $0.29 | 70% |
| review | Opus 5, high: $0.82 | Opus 5, low: $0.25 | $0.57 | 70% |

With that share held fixed, a route costs more than it saves on a task that would cost less than the route's cost divided by 0.70 on the setting you are on, and saves less than twice its cost up to double that.

| Asking from | Costs more than it saves below | Saves less than twice its cost below |
| --- | --- | --- |
| Sonnet 5, medium | $0.06 | $0.13 |
| Opus 5, high | $0.18 | $0.36 |
| Opus 5, xhigh | $0.20 | $0.40 |

The bench's rename falls in the middle band for Opus 5 at xhigh: moving it to Sonnet 5 at low saved $0.171, and asking cost $0.141, a margin of $0.030. The other three tasks land where a route saves more than twice its cost. On a session already running the setting a route recommends, a route saves nothing, whatever the task size.

The 70% was measured on small tasks. Whether a larger task saves the same share on the cheaper setting is untested, so the bands extend the measurements to sizes the bench did not run.

## Ultracode on two small tasks

Both cases ran on Opus 5 with ultracode on and at `xhigh`, three runs each (C9 in `../bench/SCOPE.md`).

| Case, opus | xhigh | ultracode | Runs that started a workflow |
| --- | --- | --- | --- |
| Review a diff | 5 of 5 defects every run, $0.50 median | 5 of 5 defects every run, $4.75 median ($3.18 to $7.92) | 3 of 3 |
| Fix a reproducible bug | Passed every run, $0.35 median | Passed every run, $0.45 median | 0 of 3 |

The review workflows reported no false positives, cost 9.5 times the `xhigh` median, and took 4.6 to 8.6 minutes against 1.2 or 1.3. The workflow agents ran on Opus. Beyond the main loop's own usage, each run read 1.1M to 2.9M cached tokens and wrote 38K to 94K output tokens, which the per-model usage cannot split between the agents and Claude Code's internal calls.

On the bug fix, no run started a workflow, so those runs measure `xhigh` with ultracode switched on. Their median cost was 1.26 times the `xhigh` median, and C9 records the case as not testable. One of the three `debug-opus-xhigh` runs predates the others, on Claude Code 2.1.263; against the two on 2.1.270 alone, the ratio is 1.37.

Every run passed, so nothing here shows a workflow finding something `xhigh` missed.

## Three jobs in one prompt, with and without ultratoken

Each prompt carried three independent jobs:

- a bug fix, or in the large case the credit-note feature
- the six-file review, on a branch
- the rounding question

The `ultratoken` keyword added instructions to send each job to a worker agent on the setting the routing table starts that work on (C10 and C11 in `../bench/SCOPE.md`). All 24 runs passed all three jobs, three per cell.

| Jobs | Session setting | Without the keyword | With `ultratoken` | Ratio |
| --- | --- | --- | --- | --- |
| Bug fix, review, rounding | Opus 5, xhigh | $0.71 | $0.89 | 1.25x |
| Bug fix, review, rounding | Sonnet 5, medium | $0.42 | $0.77 | 1.85x |
| Feature, review, rounding | Opus 5, xhigh | $1.30 | $1.29 | 0.99x |
| Feature, review, rounding | Sonnet 5, medium | $0.65 | $0.76 | 1.17x |

Figures are cost per completed task. Every `ultratoken` run sent the bug fix or feature to Sonnet at medium and the review to Opus at low. The rounding question stayed in the session in 11 of 12 runs, and in the other went to a Haiku worker whose answer the session rewrote.

- **From Opus.** The Opus spend fell only with the feature, and the Sonnet worker added most of the saving back.
- **From Sonnet.** Sending the review up to Opus added cost, though Sonnet at medium passed the review in all six runs without the keyword.

`../experiments/ultratoken/README.md` has the per-model spend and the reproduction.

## Sonnet 5 against Opus 5.5, the account default

From Claude Code 2.1.280, an account with no model set starts on Opus 5.5 at medium. Setup had recommended Sonnet 5 at medium on cells compared against Opus 5 at xhigh, so C12 compared the two defaults on the four tasks setup quotes. Opus 5.5 ran by its full id, `claude-opus-5-5`, since `opus` had resolved to Opus 5 for every earlier run. A session with no plugin starts 13.2K tokens larger on 2.1.280 than on 2.1.272, and the published Sonnet cells ran on 2.1.263 and 2.1.270, so Sonnet ran again beside Opus 5.5 on the same version, as `<case>-sonnet-medium-c12`.

| Task | Sonnet 5, medium | Opus 5.5, medium | Sonnet against Opus 5.5 |
| --- | --- | --- | --- |
| Implement a feature from a written spec | $0.41 | $0.61 | 0.67x |
| Fix a bug with a failing test | $0.19 | $0.21 | 0.87x |
| Three jobs in one prompt | $0.44 | $0.40 | 1.09x |
| Three jobs, one of them the feature | $0.70 | $0.77 | 0.90x |

Cost per completed task at list price, three runs per cell. Every run passed. Sonnet saved beyond the 30% noise band only on the implement task, and C12 needed it to on three of the four, so the claim is falsified. At list price Opus 5.5 costs twice as much as Sonnet 5 per token on input and output and the same on cache reads, and it took fewer turns at the median on every task: 11 against 19 on the implement task, and 6 against 19 on three jobs in one prompt.

On 2.1.280 Sonnet's cost per completed task came to $0.41 on the implement task against $0.30 in the published cell, and $0.19 on the bug fix against $0.12. Set beside the published cells, Opus 5.5 would have looked more expensive than it is.

Setup recommends no change on the account default. It offers Sonnet 5 at medium only from a setting where Sonnet cost at most 0.7 times as much on every task the bench ran both: Opus 5 at medium, high or xhigh, and Fable 5.1 at xhigh.

## Claim by claim

| Claim | Verdict |
| --- | --- |
| Chores go to Sonnet at low effort, or Haiku | Holds. Both passed every run at a third and a quarter of the cost of Opus at xhigh. |
| Implementing from a written spec goes to Sonnet at medium | Holds. Passed every run at 17% of the cost of Opus at xhigh. |
| Raise effort before upgrading the model | Supported, though the pre-registered test was written backwards. See below. |
| Debugging goes to the top model at high effort | Falsified. Sonnet at medium fixed the bug in all three runs for a third of Opus's cost. |
| Reviews keep effort high | Falsified. Opus at low matched Opus at high on recall for a third of the cost. |
| Forcing subagents onto Haiku saves at least 40%, the bench's pass mark | Falsified on the threshold. The mechanism works and saved 30%. |
| The prompt cache is per model | Not testable through this harness. Retained as documented behaviour. |
| Planning on Opus then implementing on Sonnet is cheaper | Falsified on cost. The split cost $2.50 against $1.65 for one Opus session. |
| On tasks this size, ultracode costs more than `xhigh` for no better result | Holds on the review, at 9.5 times the cost for the same five defects. Not testable on the bug fix, where no workflow started. |
| Sending each job in a prompt to a worker on its own setting costs at most 0.7 times as much, for the same result | Falsified from Opus at xhigh and from Sonnet at medium, at 1.25 and 1.85 times the cost. |
| The same, with one large job among the three | Falsified from both, at 0.99 and 1.17 times the cost. |
| Sonnet 5 at medium costs materially less than Opus 5.5 at medium, the account default | Falsified. Sonnet cost 0.67 times as much implementing from a spec, and 0.87 to 1.09 times on the other three tasks. |

## Two verdicts that need a caveat

Every change made to a grader or a criterion after runs had been seen is dated in `../bench/SCOPE.md`'s revision history, with what it did to the verdicts. Two of them change how a row above should be read.

**C3's criterion was written backwards.** The claim "raise effort before upgrading the model" is tested by asking whether staying on Sonnet and raising effort beats moving to Opus and keeping effort low. The criterion asked the opposite, and would have counted Opus-at-medium winning as support for effort-first. Under the criterion as written the claim is falsified; under the claim as named the data supports it, with Sonnet at xhigh costing $0.59 per completed task against $0.82 for Opus at medium and both passing every run. Both readings are in the table. No threshold moved after seeing data.

**The review recall figures come from a grader that was corrected five times.** It charged false positives for a defect explained across several paragraphs, and it scored a correct answer one of five because that answer put the file name and the keyword in different markdown blocks. After publication, the patterns for the CSV defect were narrowed to its mechanism, since words like "test" and "deleted" appear in any mention of that file. Later it turned out to pass a one-line answer that described no defect, and to miss invented findings. It now grades each finding, led by its file:line reference, against the mechanism of each defect. Before any C10 or C11 run, a probe showed it starting no finding on a line led by a bold label such as `**File/Line:**`, and it now reads those. Every saved answer keeps the grade it was published with, and `../bench/results/hand-grades.json` decides pass or fail for the runs it covers. The grader agrees with every hand grade but one: a C11 review section that wrote its references as `` `src/discounts.js` line 24 ``, which the grader does not read. Read by hand, it found all five defects. Graded by the grader alone, that cell is 2 of 3 at 1.75 times the cost, and C11 is falsified either way. The C5 verdict rests on these figures.

## What this does not tell you

- **Nothing about large contexts.** No graded run averaged more than 72K tokens of context per turn. Sessions over 100K tokens per call are covered by the observational measurements in `../skills/route/reference.md`.
- **Nothing about where expensive settings pay off.** All 111 graded runs passed, so the ceiling was never reached.
- **Nothing about `max` effort or `ultrathink`, and ultracode only on small tasks.** No run used `max` or `ultrathink`. Ultracode ran on a review and a bug fix, both small enough for one context, so whether it pays on work that splits into context-sized parts is untested.
- **Little about how much a route's cost varies.** Each setting's route ran once on the shipped text, and no route ran on Opus 5.5 at medium, the account default from Claude Code 2.1.280, or on Sonnet 5 at high, the earlier default on Pro and Team Standard.
- **Little about Opus 5.5.** It ran only at medium, on four tasks, against Sonnet 5 at medium. Every Opus cell in the routing table describes Opus 5.
- **Nothing about other codebases.** A single small JavaScript library, five tasks, run on one machine on 8, 14, 15 and 23 September 2026.
- **Nothing about subscription quota.** Costs are Claude Code's list-price figures. How usage draws down against a Pro or Max plan is not published.
