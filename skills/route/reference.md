# Why the routing table says what it says

Evidence and sources behind `SKILL.md`. Read this when a recommendation is challenged or the user asks why.

Two kinds of evidence appear here. The token measurements below are observational, parsed from real Claude Code transcripts on one machine by `bench/context-profile.mjs`. The per-row model and effort recommendations were tested separately on a benchmark of graded tasks; that is in `../../docs/findings.md`, and it falsified four of the nine claims it set out to test. Where the two disagree, the benchmark wins for anything it covers, which is task-level model and effort choice on a small codebase. It does not cover long-context sessions, which is what the numbers below describe.

## Where the tokens go

Parsed from the per-response `usage` fields in `~/.claude/projects` on one machine, 11 September 2026, by `bench/context-profile.mjs`. Run it yourself for the same table on your own transcripts:

```sh
node bench/context-profile.mjs
```

| | |
| --- | --- |
| Sessions | 137 |
| API calls | 34,139, of which 6% by subagents |
| Input tokens | 12.07 billion: 0% uncached, 1% cache writes, 99% cache reads |
| Output tokens | 28.2 million, of which 33% thinking |
| Input to output | 428 to 1 |
| Context per call, median session | 255K |
| Fixed overhead per call, median session (system prompt, CLAUDE.md files, tool and MCP schemas) | 60K tokens |

One API response is written to the transcript as several lines, one per content block, each repeating the same `usage` object, so the script counts calls by `requestId`. Counting lines instead inflates both calls and tokens by the average number of blocks per response.

The overhead figure is the cheapest main-loop call in a session, which is a proxy: the first call of a session carries the system prompt, the tool and MCP schemas and the CLAUDE.md files, and little else. `/context` gives the exact breakdown for a live session.

Context per call grows with the session. Of the ten sessions on this machine with the most calls, seven averaged 396K to 535K per call. A session that reads much of a repo early carries it on every later call. The costs docs say the same thing in one line: a one-line question in a session that has been open all day still draws usage for the whole conversation.

## Per-token prices and what they imply

From the API pricing page. Output costs 5x input on every current model, and thinking is output. A cache read costs 0.1x input (0.025x on Fable 5.1). A cache write costs 1.25x input on the 5-minute cache and 2x on the 1-hour cache. Fable 5.1 is 5x Sonnet 5 and 10x Haiku 4.5 on input and output, and 1.25x and 2.5x on cache reads. Opus 5 is 2.5x Sonnet 5 on every class. Models from Claude 4.7 on use a newer tokenizer that the page says produces about 30% more tokens for the same text. Haiku 4.5 predates 4.7, so its token counts are not directly comparable with the other current models'.

The price table has no effort dimension. Effort changes how many tokens a task spends, through thinking and turns, and the model sets what each one costs. On the bench's rename, Opus 5 at xhigh and Sonnet 5 at low used about the same context over five or six turns, and Opus cost three times as much. `../../docs/findings.md` breaks that down, with how much effort added on each task.

Per token, output is the expensive class. Volume makes cache reads matter anyway. Subscription plans do not bill per token and do not publish how usage draws down by model. Treat any dollar figure computed from token counts as a weighting for comparison.

The cache lifetime is one hour on a subscription and five minutes on an API key or once usage credits are being drawn. The first message after a longer break misses the cache and re-processes the full context.

## The cache is per model and per effort level

From the Claude Code prompt caching docs: "Each model has its own cache. Switching models recomputes the entire request even when the content is identical." And: "on most models, each effort level has its own cache, so changing effort mid-session recomputes the entire request. On Fable 5.1 with an API key or a Claude subscription, the cache stays intact by default." Claude Code asks for confirmation on `/model` only while the cache is warm (from v2.1.238), and asks before an effort change while the cache is warm.

The page states those two rules, and the cost of a change on a cleared context follows from them without being stated there. After `/clear` the request holds the system prompt and project context and no conversation, so recomputing the entire request re-processes what a new session's first request would. The exception is a model and effort level that still has the same prefix cached: the page says any two requests with the same model and prefix read the same cache. The phase-boundary protocol follows from this.

## Nothing switches the live session for you

Hooks cannot change the model or effort of the session that is running. Tools that automate routing either inject a recommendation each turn or write the model into settings so the next session starts on it. The only mid-session switch is the user's own `/model` and `/effort`. A routing aid therefore has to explain the tradeoff well enough that the user acts on it.

How the user switches decides whether the switch outlasts the session. From the Claude Code model configuration docs: "`/model` saves your choice as the default for new sessions by writing the `model` field in your user settings." In the picker, `Enter` switches and saves as the default, and `s` switches "for this session only and leave your default unchanged". "Typing `/model <name>` directly behaves like `Enter`." For effort, "`Enter` in the `/effort` slider or the `/model` picker, or a level typed after `/effort`" saves the level as the default, and "`s` in the `/effort` slider or the `/model` picker" applies it to the session only. A default written by `/tokenwise:setup` is therefore replaced by any typed `/model <alias>` or `/effort <level>`, which is why the skill advises `s` for a phase and a typed command only for a new default.

## Subagent models

Each subagent runs in its own context window; only its summary returns. Agent files take `model` (`sonnet`, `haiku`, `opus`, `fable`, a full model id, or `inherit`) and `effort`. From v2.1.198 the built-in Explore subagent inherits the main conversation's model, capped at Opus on the Claude API; Plan inherits it. `CLAUDE_CODE_SUBAGENT_MODEL` sets the model for general subagents; adding `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` (v2.1.257 or later) applies it to every subagent, including Explore and Plan. A subagent's tokens still count toward usage.

## What this skill costs

From the Claude Code skills docs: "When you or Claude invoke a skill, the rendered `SKILL.md` content enters the conversation as a single message and stays there across later turns." A second invocation with different arguments appends the full content again, and auto-compaction re-attaches invoked skills after its summary, up to a token budget. `context: fork` runs a skill in a subagent instead: "The skill content becomes the prompt that drives the subagent. It won't have access to your conversation history."

This skill runs forked for that reason. Measured on Opus 5 at xhigh effort (`../../docs/findings.md`), a route that ran in the conversation left 9.6K tokens behind for every later call, most of it the answer and its thinking. Forked, a 1.3.0 route left 822, the answer alone. The cost is that the skill routes from the description it is given and cannot see the conversation or its context size.

## Images

The vision docs give an image's cost as ceil(width / 28) times ceil(height / 28) tokens. A 1024 by 1024 image is about 1.4K tokens; a 1920 by 1080 screenshot about 2.7K. Each stays in context and is re-sent on every later call. A script calling the API sees each once, on a cheaper model, at half price through the Batch API.

## Effort

From the API effort docs: `high` is the default, and the advice for Opus 5 and Fable 5.1 is to start there. The docs describe `xhigh` as extended capability for long-running agentic and coding work, `max` as the maximum with no limit on token spending, and `low` as the most efficient level, for simpler tasks such as subagents. Lower effort also means fewer and terser tool calls. Claude Code's model configuration docs give `high` as its default on every model that supports effort, except Opus 4.7, which defaults to `xhigh`.

Anthropic's July 2026 post says effort "controls how much work Claude does on your request overall": how long the model thinks, and also how many files it reads, how much it verifies and how far it pushes through a multi-step task before checking in.

The model configuration docs describe `ultrathink`: "Include `ultrathink` anywhere in your prompt to request deeper reasoning on that turn without changing your session effort setting. Claude Code recognizes the keyword and adds an in-context instruction. The effort level sent to the API is unchanged." They add that "think", "think hard" and "think more" pass through as ordinary prompt text. The prompt caching docs do not mention `ultrathink`. They do say that plan mode and skill loading "append their instructions as conversation messages, so the cached prefix stays intact". The skill reads `ultrathink`'s in-context instruction the same way and treats it as keeping the cache, an inference no page states. No bench run used it.

On a six-file review diff, Opus at high effort took 13 turns to find the same five defects Opus at low effort found in 3, for 3.3 times the cost. On implementation from a written spec, raising effort on Sonnet cost less per completed task than upgrading to Opus at lower effort.

No bench run used `max`, so its ladder entry carries no measurement. Ultracode's bench runs are under Ultracode below.

## Ultracode

This section quotes Anthropic's Claude Code docs, fetched 14 September 2026. Its last two paragraphs give the skill's own reading and the bench runs.

The model configuration docs: "Ultracode is a Claude Code setting rather than a model effort level: it sends `xhigh` to the model and additionally has Claude orchestrate dynamic workflows for substantive tasks." It turns on through `/effort ultracode`, `claude --effort ultracode` (v2.1.203 or later), the `"ultracode": true` setting, or the `/model` picker's effort slider. The `effortLevel` setting and `CLAUDE_CODE_EFFORT_LEVEL` do not accept it, and "When `CLAUDE_CODE_EFFORT_LEVEL` is set to a level other than `xhigh`, requests run at that level and ultracode's workflow orchestration stays inactive." It is unavailable when workflows are turned off, when the model does not support `xhigh`, or when an effort cap below `xhigh` applies. The same page lists `xhigh` for Fable 5.1 and 5, Opus 5, Sonnet 5, Opus 4.8 and Opus 4.7, and says models it does not list do not support effort. Haiku is not in that list.

The workflows docs describe two ways in. The keyword `ultracode` in a prompt runs that single task as a workflow "without changing the session's effort level". `/effort ultracode` makes Claude decide for every task: "A single request can turn into several workflows in a row: one to understand the code, one to make the change, and one to verify it. This applies to every task in the session, so each request uses more tokens and takes longer than at lower effort levels." It "lasts for the current session", and the page suggests dropping back with `/effort high` for routine work. The keyword works only in a prompt a person types, so it does not start a workflow from `claude -p`.

On cost, the same page: "A workflow spawns many agents, so a single run can use meaningfully more tokens than working through the same task in conversation." Sessions with ultracode on skip the large-workflow warning, "because turning ultracode on already opts you in to large runs". The `/config` size guideline is advice to Claude on how many agents to aim for; `medium`, under 15 agents, is the default from v2.1.219. A prompt that calls for a different scale overrides it. The runtime caps a run at 16 concurrent agents, fewer when Claude Code has fewer CPUs available, and 1,000 agents in total. The page also suggests asking Claude "to use a smaller model for stages that don't need the strongest one when you describe the task". None of the pages under Sources gives a usage or price figure for ultracode, and the costs page does not mention it.

Workflow agents pick their model "in the same order it uses for subagents", and "When nothing else assigns one, the agent runs on your session's model." The subagents page gives that order: the model named for the invocation, then the agent definition's `model` field, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the session model. `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` makes the variable apply over the first two. The model configuration page lists workflow agents among those `CLAUDE_CODE_SUBAGENT_MODEL` sets a default for. A workflow agent's cache "holds for five minutes by default, including on a Claude subscription", and agents in one run with the same model, effort, agent type, tools, output schema and working directory share a cached prefix.

The prompt caching docs do not mention ultracode. Ultracode sends `xhigh`, so turning it on from `xhigh` might keep the cache. None of the pages under Sources says so; as a precaution the skill treats the change as an effort change.

The skill's advice to use ultracode only for work that splits into independent parts is also its own reading of these pages. The bench tested the other side of it on two small tasks, three runs each on Opus 5 (C9 in `../../bench/SCOPE.md`, figures in `../../docs/findings.md`). On the six-file review, ultracode started a workflow in every run and found the same five defects as `xhigh`, at a $4.75 median list price against $0.50. On the one-bug fix it started no workflow and cost 1.26 times the `xhigh` median. No bench case is large enough to test whether ultracode pays on work that splits into context-sized parts.

## Related tools

- `/usage` (subscription plans): attribution by skill, subagent, plugin and MCP server; behaviour flags for long context and cache misses; prompt-cache statistics from v2.1.251.
- `session-report`, an Anthropic plugin in the official marketplace: HTML report from local transcripts by project, subagent type, skill, cache breaks and most expensive prompts.
- ccusage: daily, monthly, session and 5-hour-block reports from local data, with a statusline.
- effort-router: a plugin that classifies each prompt into an effort tier via hooks, effort only.
- claude-model-router-hook: hooks that classify prompts and write the model for the next session, with subagent routing.

This skill covers what those do not: model and effort together per phase, the cost of switching, and what the cheaper choice gives up.

## Sources

- Manage costs effectively, Claude Code docs: <https://code.claude.com/docs/en/costs>
- Prompt caching, Claude Code docs: <https://code.claude.com/docs/en/prompt-caching>
- Model configuration, Claude Code docs: <https://code.claude.com/docs/en/model-config>
- Orchestrate subagents at scale with dynamic workflows, Claude Code docs: <https://code.claude.com/docs/en/workflows>
- All settings, Claude Code docs: <https://code.claude.com/docs/en/settings-reference>
- Create custom subagents, Claude Code docs: <https://code.claude.com/docs/en/sub-agents>
- Skills, Claude Code docs: <https://code.claude.com/docs/en/skills>
- Choosing a Claude model and effort level in Claude Code, Anthropic blog, 7 July 2026: <https://claude.com/blog/claude-model-and-effort-level-in-claude-code>
- Effort, Claude API docs: <https://platform.claude.com/docs/en/build-with-claude/effort>
- API pricing: <https://platform.claude.com/docs/en/about-claude/pricing>
- Image token cost: <https://platform.claude.com/docs/en/vision>
- session-report plugin: <https://github.com/anthropics/claude-plugins-official/tree/main/plugins/session-report>
- ccusage: <https://github.com/ryoppippi/ccusage>
- effort-router: <https://github.com/cfitzgerald-pd/effort-router>
- claude-model-router-hook: <https://github.com/tzachbon/claude-model-router-hook>
