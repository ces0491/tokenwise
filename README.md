# tokenwise

A one-skill Claude Code plugin for choosing the model and effort level per phase of a session, and switching at a point where the switch costs nothing.

## Why

Every API call re-sends the whole conversation. Across 15 sessions measured on one machine, input tokens outweighed output 400 to 1, and 99% of input was cached context re-read on every call. Review sessions carried 370K to 530K tokens of context per call. Context size multiplied by call count is the bill; model and effort set the price per token on top.

Two facts shape the advice. The prompt cache is per model, so a `/model` switch on a warm context re-processes all of it. And nothing can switch the running session's model for you: hooks can nudge or change the next session's settings, but the mid-session switch is your own `/model` and `/effort`. So the useful tool is one that tells you what to run, when, and what the cheaper option gives up.

## What it does

`/tokenwise:route <what you're about to do>` classifies the task on two axes (reading volume, judgment density) and answers with:

- the model and effort, as the exact `/model` and `/effort` commands
- whether to `/clear` or `/compact` first, and what the switch costs if you don't
- what to push into subagents
- what you give up with the cheaper choice
- the signal that says move up a tier, using Anthropic's rule: didn't know enough means change model, didn't try hard enough means raise effort

The skill also loads on its own at phase changes and whenever tokens, cost or quota come up. `skills/route/reference.md` carries the measurements and sources.

## Install

From a local checkout:

```
claude --plugin-dir /path/to/tokenwise
```

From GitHub:

```
/plugin marketplace add ces0491/tokenwise
/plugin install tokenwise@ces0491-plugins
```

Pair it with two environment variables so delegated reading runs on Haiku, including the built-in Explore and Plan subagents (Claude Code 2.1.257 or later):

```
CLAUDE_CODE_SUBAGENT_MODEL=haiku
CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1
```

## What it does not do

Measurement is covered elsewhere. `/usage` on subscription plans shows attribution by skill, subagent, plugin and MCP server and flags long context and cache misses. Anthropic's `session-report` plugin and ccusage report by session over time. For automated effort or model classification via hooks, see effort-router and claude-model-router-hook. The skill's reference file lists all of these.

## License

MIT.
