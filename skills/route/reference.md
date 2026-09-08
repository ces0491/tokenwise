# Why the routing table says what it says

Evidence and sources behind `SKILL.md`. Read this when a recommendation is challenged or the user asks why.

## Where the tokens go

Measured from Claude Code transcripts on one machine: 15 sessions, September 2026, mostly Opus 5 with some Fable 5.1, parsed from the per-response `usage` fields in `~/.claude/projects`. The official `session-report` plugin and ccusage produce comparable figures for any machine.

| | |
|---|---|
| API calls | 3,604, of which 14% by subagents |
| Input tokens | 1.13 billion: 0% uncached, 1% cache writes, 99% cache reads |
| Output tokens | 2.8 million, of which 33% thinking |
| Average context per call, review sessions | 370K to 530K |
| Average context per call, feature sessions | 280K to 355K |
| Fixed overhead per call on that setup (system prompt, CLAUDE.md files, tool and MCP schemas) | about 67K tokens |

The review sessions had the largest context per call and the most calls. A review reads much of the repo into context early, then every later call carries it. That is the mechanism behind "a review of a small repo costs as much as building a feature". The costs docs say the same thing in one line: a one-line question in a session that has been open all day still draws usage for the whole conversation.

## Per-token prices and what they imply

From the API pricing page. Output costs 5x input on every current model, and thinking is output. A cache read costs 0.1x input (0.025x on Fable 5.1). A cache write costs 1.25x input on the 5-minute cache and 2x on the 1-hour cache. Fable 5.1 is 5x Sonnet 5 per token and 10x Haiku 4.5.

Per token, output is the expensive class. Volume makes cache reads matter anyway. Subscription plans do not bill per token and do not publish how usage draws down by model. Treat any dollar figure computed from token counts as a weighting for comparison.

The cache lifetime is one hour on a subscription and five minutes on an API key or once usage credits are being drawn. The first message after a longer break misses the cache and re-processes the full context.

## The cache is per model

From the Claude Code prompt caching docs: "Each model has its own cache. Switching models recomputes the entire request even when the content is identical." Claude Code asks for confirmation on `/model` only while the cache is warm (from v2.1.238). A model switch is free on a cleared context and costs a full re-process of the current context otherwise. That is the whole reason for the phase-boundary protocol.

## Nothing switches the live session for you

Hooks cannot change the model or effort of the session that is running. Tools that automate routing either inject a recommendation each turn or write the model into settings so the next session starts on it. The only mid-session switch is the user's own `/model` and `/effort`. A routing aid therefore has to explain the tradeoff well enough that the user acts on it.

## Subagent models

Each subagent runs in its own context window; only its summary returns. Agent files take `model` (`sonnet`, `haiku`, `opus`, `fable`, a full model id, or `inherit`) and, from v2.1.242, `effort`. The built-in Explore subagent inherits the main conversation's model, capped at Opus. `CLAUDE_CODE_SUBAGENT_MODEL` sets the model for general subagents; adding `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` (v2.1.257 or later) applies it to every subagent, including Explore and Plan. A subagent's tokens still count toward usage.

## Images

The vision docs give an image's cost as ceil(width / 28) times ceil(height / 28) tokens. A 1024 by 1024 image is about 1.4K tokens; a 1920 by 1080 screenshot about 2.7K. Each stays in context and is re-sent on every later call. Fifty labelled images in one session is fifty images multiplied by every call after them, inside the per-call overhead. A script calling the API sees each once, on a cheaper model, at half price through the Batch API.

## Effort

From the API docs on effort: `xhigh` is the strongest setting for most coding and agentic work on current models and the Claude Code default; `low` suits subagents and routine tasks, with fewer and more consolidated tool calls and less preamble; `max` earns its cost only where measurement shows headroom at the level below. Lower effort on the newest models often matches or exceeds a prior-generation model at high effort. Anthropic's July 2026 post frames effort as thoroughness rather than thinking time: it controls how many files Claude reads and how far it pushes through a task.

## Related tools

- `/usage` (subscription plans): attribution by skill, subagent, plugin and MCP server; behaviour flags for long context and cache misses; prompt-cache statistics from v2.1.251.
- `session-report`, an Anthropic plugin in the official marketplace: HTML report from local transcripts by project, subagent type, skill, cache breaks and most expensive prompts.
- ccusage: daily, monthly, session and 5-hour-block reports from local data, with a statusline.
- effort-router: a plugin that classifies each prompt into an effort tier via hooks, effort only.
- claude-model-router-hook: hooks that classify prompts and write the model for the next session, with subagent routing.

This skill covers what those do not: model and effort together per phase, the cost of switching, and what the cheaper choice gives up.

## Sources

- Manage costs effectively, Claude Code docs: https://code.claude.com/docs/en/costs
- Prompt caching, Claude Code docs: https://code.claude.com/docs/en/prompt-caching
- Model configuration, Claude Code docs: https://code.claude.com/docs/en/model-config
- Create custom subagents, Claude Code docs: https://code.claude.com/docs/en/sub-agents
- Claude Code effort level and model selection, Anthropic blog, 7 July 2026: https://claude.com/blog/claude-model-and-effort-level-in-claude-code
- API pricing: https://platform.claude.com/docs/en/pricing
- Image token cost: https://platform.claude.com/docs/en/vision
- session-report plugin: https://github.com/anthropics/claude-plugins-official/tree/main/plugins/session-report
- ccusage: https://github.com/ryoppippi/ccusage
- effort-router: https://github.com/cfitzgerald-pd/effort-router
- claude-model-router-hook: https://github.com/tzachbon/claude-model-router-hook
