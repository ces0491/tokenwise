# tokenwise

A one-skill Claude Code plugin for choosing the model and effort level per phase of a session, and switching at a point where the switch costs nothing.

## Why

Every API call re-sends the whole conversation. Across 140 sessions on one machine, input tokens outweighed output 444 to 1, and 99% of input was cached context re-read on every call. The longest sessions carried 400K to 535K tokens of context per call. Context size multiplied by call count is the bill; model and effort set the price per token on top.

Those are one machine's numbers, dated 9 September 2026. `node bench/context-profile.mjs` produces the same table from your own transcripts, so you can check the shape of it rather than take mine.

Two facts shape the advice. The prompt cache is per model, so a `/model` switch on a warm context re-processes all of it. And nothing can switch the running session's model for you: hooks can nudge or change the next session's settings, but the mid-session switch is your own `/model` and `/effort`. So the useful tool is one that tells you what to run, when, and what the cheaper option gives up.

## What it does

`/tokenwise:route <what you're about to do>` classifies the task on two axes (reading volume, judgment density) and answers with:

- the model and effort, as the exact `/model` and `/effort` commands
- whether to `/clear` or `/compact` first, and what the switch costs if you don't
- what to push into subagents
- what you give up with the cheaper choice
- the signal that says move up a tier, using Anthropic's rule: didn't know enough means change model, didn't try hard enough means raise effort
- what "done" is for that phase, as one check you can run before trusting the cheaper setting

The skill also loads on its own at phase changes and whenever tokens, cost or quota come up. There is nothing to set up. `skills/route/reference.md` carries the measurements and sources.

## Does it work

Four of the routing table's nine rows were run against a small test project where "works" is decided by a grader, not by reading the output: hidden tests for implementing and debugging, with the original tests restored first so a model that edits tests to pass gets no credit; recall of five planted defects for reviewing; tests plus a grep for a rename. The table's last column says which rows those are, and marks the rest untested.

Fifty-two graded runs later, four of the eight claims the routing table made were wrong. Debugging and reviewing named a more expensive setting than the work needed. Forcing subagents onto Haiku saved 30% where the claim was 40%. And splitting a small task into a planning session and an implementation session cost more than doing it in one. The table has been corrected. Implementing a feature from a spec cost $0.17 on Haiku and $2.63 on Fable at xhigh, and both passed the same 37 tests. Reviewing a diff on Opus at low effort found all five planted defects in 3 turns; the same model at high effort found the same five in 13 turns for 3.3 times the cost.

Pass/fail thresholds were fixed before the results were read (`bench/SCOPE.md`) and the verdicts are computed from them. Full numbers in [docs/findings.md](docs/findings.md), method in [docs/methodology.md](docs/methodology.md), raw runs in `bench/results/`.

## Checking the figures

Every number above comes from a file in this repository or from a script in it. Two of the three checks are free and take seconds.

```sh
git clone https://github.com/ces0491/tokenwise && cd tokenwise

node bench/summarize.mjs --check     # do the published tables follow from the published runs?
node bench/context-profile.mjs       # the token figures above, against your own transcripts
node bench/run.mjs                   # re-run the matrix on your account: about $30 and 90 minutes
```

`--check` regenerates `bench/RESULTS.md` from `bench/results/runs.jsonl` and fails if the committed report differs, so you can confirm the tables were not edited by hand without spending anything. `context-profile.mjs` reports on your machine, not mine, so expect different numbers: the ratio and the cache share are the parts that should look familiar. Only the third command costs money.

What the bench cannot show: all 52 graded runs passed, so it measures cost at equal outcomes and never reaches the point where an expensive setting earns its price. The fixture is small, so it says nothing about long-context sessions.

## Documentation

- [User guide](docs/guide.md) — day-to-day use, what to run where, the two settings worth changing.
- [Findings](docs/findings.md) — what the bench measured, claim by claim, and the two verdicts that need a caveat.
- [Methodology](docs/methodology.md) — fixture, graders, run conditions, and what the harness cannot measure.

## Install

From a local checkout:

```sh
claude --plugin-dir /path/to/tokenwise
```

From GitHub:

```text
/plugin marketplace add ces0491/tokenwise
/plugin install tokenwise@ces0491-plugins
```

Pair it with two environment variables so delegated reading runs on Haiku, including the built-in Explore and Plan subagents (Claude Code 2.1.257 or later):

```text
CLAUDE_CODE_SUBAGENT_MODEL=haiku
CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1
```

## What it does not do

Measurement is covered elsewhere. `/usage` on subscription plans shows attribution by skill, subagent, plugin and MCP server and flags long context and cache misses. Anthropic's `session-report` plugin and ccusage report by session over time. For automated effort or model classification via hooks, see effort-router and claude-model-router-hook. The skill's reference file lists all of these.

## License

MIT.
