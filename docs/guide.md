# Using tokenwise

The plugin adds two skills and two warnings. This guide covers what each does, when to reach for the route skill, and two environment variables worth setting once.

## Install

```text
/plugin marketplace add ces0491/tokenwise
/plugin install tokenwise@ces0491-plugins
```

In the VS Code extension the manager opens with `/plugins`. From the terminal, `claude plugin install tokenwise@ces0491-plugins` does the same thing and writes to the same settings.

Idle, the plugin costs only the route skill's name and description, which is all that loads until it fires: 153 tokens of context, measured on Opus 5. Setup loads only when you type it, and the hooks add nothing to the conversation. What a route costs is under "What routing costs" below.

## Set a cheaper default

```text
/tokenwise:setup
```

It shows the model and effort new sessions start on, recommends Sonnet 5 at medium with the bench figures behind it, lists anything that would still override the change (`ANTHROPIC_MODEL`, `CLAUDE_CODE_EFFORT_LEVEL`, a project's settings, an organization default), and asks before writing. It writes `model` and the effort level saved for Sonnet 5 under `modelSettings` in your user settings, because a level saved for a model takes precedence over the top-level `effortLevel`. `/tokenwise:setup restore` puts back the values from before setup first ran, leaving alone any you changed since.

The session you run it in keeps its model, and a resumed session keeps the model it was using. A typed `/model` or `/effort` replaces this default; "Switching mid-session" covers the switch that doesn't.

## Warnings before a re-send

Two hooks show a line when something is about to re-send your conversation to an empty cache:

- **On resume.** A conversation idle for longer than its prompt cache lifetime re-sends all of it with your first message. The line gives the tokens and the estimated cost, and suggests `/clear` if you don't need the conversation.
- **On a model switch.** Each model has its own cache, so unless the new model wrote the last response, the next message re-sends the whole conversation. Claude Code's confirmation says so without a size; the line gives it. It shows with the switch result, and not when you cancel: on a Sonnet-to-Opus switch in a fresh session the confirmation itself carried no line, and declining showed none either. Effort changes have no hook, so only Claude Code's confirmation covers them.

The figures come from Claude Code, which passes the hook the token count and an estimated cost. On a model switch it also reports which rates it priced that estimate on, and the line repeats it; on a resume it reports no rates, so the line quotes the figure without naming a basis. A line shows only when that cost is more than a route from your model, and a hook never changes whether the resume or switch goes ahead. Claude never sees the line, which was checked by forking one conversation twice and varying only the size of the hook message: the two first requests came back within run-to-run noise of each other. Both warnings need Claude Code 2.1.251 or later, and both run a Node script, so `node` has to be on your PATH.

## Ask it

```text
/tokenwise:route implement the plan in docs/plan.md, about 12 files
```

It answers with the model and effort to use, how to switch to them for this session only, whether to clear first, what to delegate, one check that tells you the phase is finished, what you give up by going cheaper, and the signal that says move up a tier.

Claude also runs it without being asked by name when you ask which model or effort level to use. It recommends and never acts, so you can ignore it.

## What routing costs

The skill runs in its own subagent context. Its text and its reasoning stay there, and only the answer comes back into your conversation, where it is carried on every later call like anything else in context. The skill runs on your session's model and effort. A route in a session already under way cost $0.04 asked from Sonnet 5 at medium, $0.10 from Opus 5 at high and $0.12 from Opus 5 at xhigh, and the first route left 468 to 825 tokens behind. `findings.md` has the numbers, and a chart of the task sizes where a route pays for itself.

- Route just before a `/clear`, at a phase boundary, and nothing it returns is carried.
- For a single small chore, pick Sonnet at low effort, or Haiku, yourself. On the bench, moving a rename from Opus at xhigh to Sonnet at low saved $0.17, against $0.12 for asking from Opus 5 at xhigh.
- Describe the work after the command. The skill cannot see your conversation, so `/tokenwise:route` on its own only asks for a description.

## Why context size drives the cost

Every API call re-sends the whole conversation. Cost is context size multiplied by the number of calls, plus output, and thinking counts as output. The price of each token depends on the model. Effort doesn't change that price, but it changes how many tokens a task spends: how much Claude thinks, and how many turns it takes, each re-reading the context. That is why a review of a small repository can cost as much as building a feature: the review reads everything into context early, then carries it on every later call.

## What to run where

Start at the cheap end and escalate on a failure you can point to. The Measured column says whether the bench covered that row; the skill's own table carries the evidence for each one.

Measured means measured on `claude-haiku-4-5-20251001`, `claude-sonnet-5`, `claude-opus-5` and `claude-fable-5-1`, the models the aliases pointed to on 8 and 14 September 2026. When Anthropic moves an alias to a newer model, the advice follows the alias, but the evidence stays with the older model until the bench is re-run.

<!-- routing-table: generated from skills/route/SKILL.md by scripts/sync-routing-table.mjs -->
| Work | Start | Escalate to | Measured |
| --- | --- | --- | --- |
| Plan, architect, resolve an ambiguous spec | opus, high | fable, xhigh | no |
| Implement from a written spec or plan | sonnet, medium | opus, medium, then xhigh | yes |
| Implement without a spec, or a cross-cutting change | sonnet, high | opus, xhigh | no |
| Debug a failure you can reproduce | sonnet, medium | opus, high | yes |
| Debug a failure with no reproduction | opus, high | fable, xhigh | no |
| Tests, docs, mechanical refactors, renames | sonnet, low, or haiku | sonnet, medium | yes |
| Review a diff | opus, low | opus, high for a large or unfamiliar diff | yes |
| Commit, chores, formatting | sonnet, low, or haiku | | no |
| Bulk labelling, classification, extraction | not Claude Code | | no |
<!-- /routing-table -->

On the four measured rows, the cheap setting finished the job in every run on a small test project, and the expensive settings cost up to nine times more for the same result. The rest carry no measurement. The numbers are in `findings.md`.

## Escalating

Anthropic's rule: if Claude failed with the context it had, it did not know enough, so change the model. If it skipped files, did not run tests, or stopped early, it did not try hard enough, so raise the effort.

For one turn that needs more thought, try `ultrathink` in the prompt first. It asks for deeper reasoning on that turn without changing the effort level, which should keep the prompt cache that an `/effort` change breaks, though the caching docs do not say so. The bench did not measure it.

Raise effort on the model you are on before upgrading the model. Higher effort is not uniformly better: on a code review it bought ten extra turns and 3.3 times the cost for the same findings.

Judge by cost per completed task, which counts the retries a cheaper setting needs.

## Ultracode

Ultracode is a Claude Code setting that sends `xhigh` and has Claude plan a multi-agent workflow for the substantive tasks it judges need one. What it adds beyond `xhigh` is agents, each with its own context. Anthropic's docs say that with it on, each request uses more tokens and takes longer than at lower effort levels. On the bench's small review, Opus with ultracode ran a workflow each time and found the same five defects as Opus at `xhigh`, for 9.5 times the cost. On a one-bug fix it started no workflow.

It fits judgment-heavy work that splits into independent parts, each big enough to fill a context, such as an audit across many files. A rename or migration over many files stays on its routing row. For one such task, type the keyword `ultracode` in the prompt, which runs that task as a workflow without changing the session's effort. `/effort ultracode` lets Claude decide task by task whether to run a workflow for the rest of the session, so drop back with `/effort high` when the work stops splitting, as the workflows docs suggest. It needs a model with `xhigh`, so it is not available on Haiku.

Workflow agents run on your session model unless the workflow, the agent type's `model` field or `CLAUDE_CODE_SUBAGENT_MODEL` gives them another, in that order. With the two variables below both set, every workflow agent runs on Haiku, so check `/model` and those variables before a large run. `/usage` shows what the run cost.

## Switching mid-session

The prompt cache is per model, and on most models per effort level too, so changing either on a warm context makes Claude Code re-process all of it. Claude Code asks you to confirm while the cache is warm. Fable 5.1 on an API key or a Claude subscription keeps its cache when effort changes.

Switch at a phase boundary:

1. Write what the next phase needs to a file: the plan, the findings, the task list.
2. `/tokenwise:route <the next phase>`, so the next step clears its answer too.
3. `/clear`.
4. Open `/model`, choose the model and effort, and press `s`.
5. Start from the file.

Pressing `s` in the `/model` picker or the `/effort` slider switches for this session only. Typing `/model sonnet` or `/effort medium` does the same and also saves it as your default for new sessions, replacing the default `/tokenwise:setup` sets, so type the command only when you mean to change the default.

On a cleared context there is no conversation to re-process, so a switch usually costs what a new session's first request costs: the system prompt and project context.

Escalating mid-task is a switch too. On a large context, write down where the work stands and `/clear` before raising effort or changing model.

Split work across sessions so a model or effort change does not re-process a warm cache. On a small task, planning on Opus and implementing on Sonnet cost more than one Opus session, because the plan has to be written, read and paid for. Split when the phases are long enough that carrying the first one's context through the second would cost more than rebuilding it.

## Two environment variables worth setting

```text
CLAUDE_CODE_SUBAGENT_MODEL=haiku
CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1
```

Requires Claude Code 2.1.257 or later. Without the second variable, the built-in Explore and Plan subagents inherit your session model, so delegating exploration on an Opus session is not cheap. With both set, a delegated exploration cost 30% less on the bench, $0.44 against $0.63 at the median, and the subagent's own reading cost $0.08. Without them the subagent runs on the session model, where its cost is not separable from the main session's.

Subagent tokens still count against your usage. Delegation moves reading to a cheaper model in a context that gets thrown away.

## Other habits

- `/clear` between unrelated tasks. Stale context is charged on every later message.
- Delegate test runs, log reading and documentation fetching so the verbose output stays out of your context.
- Grep before you read whole files.
- A screenshot stays in context until `/clear`. A 1024-pixel image is about 1.4K tokens and is re-sent on every later call.
- Bulk labelling or extraction belongs in a script. Each item is seen once, on a cheap model, and the Batch API halves the price.

## Checking your own usage

`/usage` on a subscription plan shows attribution by skill, subagent, plugin and MCP server, and flags long context and cache misses. `/context` shows what is filling the window. For history across sessions, Anthropic's `session-report` plugin and `ccusage` both read the local transcripts.

## What it will not do

- It cannot change your model or effort. Only you can, with `/model` and `/effort`.
- It does not track your spend. The tools above do that.
- It does not know your subscription quota. Costs quoted anywhere in this plugin are API list prices, a weighting for comparing settings.
