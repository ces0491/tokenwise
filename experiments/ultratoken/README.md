# ultratoken: each job in a prompt on its own setting

`ultratoken` was a prompt keyword, tested and not shipped. When a prompt contained the word, a UserPromptSubmit hook (`ultratoken.mjs`) added instructions telling Claude to:

- split the request into jobs
- keep the small ones in the session
- send the rest to worker agents (`agents/`) on the model and effort the routing table starts that kind of work on

From both starting settings the bench ran, with small jobs and with a large one, it cost 0.99 to 1.85 times the same prompt without the keyword, against a 0.7 bar. C10 and C11 in `../../bench/SCOPE.md` set the bar before any run.

## Result

Each prompt carried three independent jobs:

- fix a planted bug, or implement a credit-note feature from a spec
- review a six-file diff on another branch
- say where monetary rounding is decided

Every run loaded the plugin with this directory's hook and agents, so the two arms differ only in whether the prompt starts with `ultratoken`. There were three runs per cell, on Claude Code 2.1.270 on 15 September 2026, and all 24 passed all three jobs.

| Jobs | Session setting | Without the keyword | With `ultratoken` | Ratio |
| --- | --- | --- | --- | --- |
| Bug fix, review, rounding | Opus 5, xhigh | $0.71 | $0.89 | 1.25x |
| Bug fix, review, rounding | Sonnet 5, medium | $0.42 | $0.77 | 1.85x |
| Feature, review, rounding | Opus 5, xhigh | $1.30 | $1.29 | 0.99x |
| Feature, review, rounding | Sonnet 5, medium | $0.65 | $0.76 | 1.17x |

Figures are cost per completed task at list price. A claim needed 0.7x or lower to hold, because the bench counts differences under 30% as noise.

## What it shows

- **Routing barely varied.** In every run the bug fix or feature went to a Sonnet 5 worker at medium and the review to an Opus 5 worker at low. The rounding question stayed in the session in 11 of 12 runs. In the other it went to a Haiku worker, which failed its check, and the session wrote the answer itself.
- **From Opus at xhigh, handing work to Sonnet did not reduce the Opus spend enough.** With the bug fix, Opus spend per run was $0.67 to $0.87, against $0.66 to $0.78 without the keyword, and the Sonnet worker added $0.10 to $0.14. With the feature, Opus spend fell to $0.91 to $0.96 from $1.19 to $1.46, and the Sonnet worker added $0.31 to $0.38 back.
- **From Sonnet at medium, the review went up to Opus**, because the routing table starts reviews there. Without the keyword, Sonnet at medium passed the review in all six runs, so the Opus worker added $0.20 to $0.75 per run for the same result.

## What it does not show

- **Jobs larger than the credit-note feature.** The largest job was the credit-note feature, which costs a $1.65 median on its own on Opus at xhigh.
- **Other starting settings.** No run started at `max`, or on Sonnet 5 at high, the default on Pro and Team Standard.
- **Escalation.** The one worker that failed its check was not sent again on a stronger setting, so no run exercised the escalation step.
- **Grading without a hand reading.** One review section wrote its references as `` `src/discounts.js` line 24 ``, which the review grader does not read. It found all five defects, and `../../bench/results/hand-grades.json` records that. Graded by the grader alone, that cell is 2 of 3 at 1.75x. C11 is falsified either way.

## Check it

Free, from the committed runs:

```sh
node bench/summarize.mjs --check
node --test experiments/ultratoken/ultratoken.test.mjs
```

Re-run on your own Claude account. The 24 runs came to $20.44 at list price. The runner stages the plugin with this directory's hook and agents (`stagePlugin` in `bench/run.mjs`), so agent types match the published runs.

```sh
node bench/run.mjs --results bench/rerun --only multi-opus-xhigh,multi-opus-xhigh-ultratoken,multi-sonnet-medium,multi-sonnet-medium-ultratoken,multi-large-opus-xhigh,multi-large-opus-xhigh-ultratoken,multi-large-sonnet-medium,multi-large-sonnet-medium-ultratoken
```
