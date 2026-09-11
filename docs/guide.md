# Using tokenwise

The plugin adds one skill, with nothing to configure. This guide covers what it does, when to reach for it, and the two settings worth changing once.

## Install

```text
/plugin marketplace add ces0491/tokenwise
/plugin install tokenwise@ces0491-plugins
```

In the VS Code extension the manager opens with `/plugins`. From the terminal, `claude plugin install tokenwise@ces0491-plugins` does the same thing and writes to the same settings.

Idle, the skill costs only its name and description, which is all that loads until it fires: 122 tokens of context, measured on Opus 5. What a route costs is under "What routing costs" below.

## Ask it

```text
/tokenwise:route implement the plan in docs/plan.md, about 12 files
```

It answers with the model and effort to use, the exact commands, whether to clear first, what to delegate, one check that tells you the phase is finished, what you give up by going cheaper, and the signal that says move up a tier.

Claude also runs it without being asked by name when you ask which model or effort level to use. It recommends and never acts, so you can ignore it.

## What routing costs

The skill runs in its own subagent context. Its text and its reasoning stay there, and only the answer comes back into your conversation, where it is carried on every later call like anything else in context. Measured on Opus 5 at xhigh effort, that answer was 876 tokens, and a route in a session already under way cost $0.136. The numbers are in `findings.md`.

- Route just before a `/clear`, at a phase boundary, and nothing it returns is carried.
- For a single small chore, pick Sonnet or Haiku at low effort yourself. On the bench, moving a rename from Opus at xhigh to Sonnet at low saved $0.17, about what asking costs.
- Describe the work after the command. The skill cannot see your conversation, so `/tokenwise:route` on its own only asks for a description.

## The one idea

Every API call re-sends the whole conversation. Cost is context size multiplied by the number of calls, plus output, and thinking counts as output. The price of each token depends on the model. Effort doesn't change that price, but it changes how many tokens a task spends: how much Claude thinks, and how many turns it takes, each re-reading the context. That is why a review of a small repository can cost as much as building a feature: the review reads everything into context early, then carries it on every later call.

Two consequences follow. Keep reading out of the main context, and match the model to the work rather than defaulting to the top of the range.

## What to run where

Start at the cheap end and escalate on a failure you can point to. The Measured column says whether the bench covered that row; the skill's own table carries the evidence for each one.

Measured means measured on `claude-haiku-4-5-20251001`, `claude-sonnet-5`, `claude-opus-5` and `claude-fable-5-1`, the models the aliases pointed to on 8 September 2026. When Anthropic moves an alias to a newer model, the advice follows the alias, but the evidence stays with the older model until the bench is re-run.

<!-- routing-table: generated from skills/route/SKILL.md by scripts/sync-routing-table.mjs -->
| Work | Start | Escalate to | Measured |
| --- | --- | --- | --- |
| Plan, architect, resolve an ambiguous spec | opus, high | fable, xhigh | no |
| Implement from a written spec or plan | sonnet, medium | opus, medium, then xhigh | yes |
| Implement without a spec, or a cross-cutting change | sonnet, high | opus, xhigh | no |
| Debug a failure you can reproduce | sonnet, medium | opus, high | yes |
| Debug a failure with no reproduction | opus, high | fable, xhigh | no |
| Tests, docs, mechanical refactors, renames | sonnet or haiku, low | sonnet, medium | yes |
| Review a diff | opus, low | opus, high for a large or unfamiliar diff | yes |
| Commit, chores, formatting | sonnet or haiku, low | | no |
| Bulk labelling, classification, extraction | not Claude Code | | no |
<!-- /routing-table -->

On the four measured rows, the cheap setting finished the job in every run on a small test project, and the expensive settings cost up to nine times more for the same result. The rest carry no measurement. The numbers are in `findings.md`.

## Escalating

Anthropic's rule: if Claude failed with the context it had, it did not know enough, so change the model. If it skipped files, did not run tests, or stopped early, it did not try hard enough, so raise the effort.

Raise effort on the model you are on before upgrading the model. Higher effort is not uniformly better: on a code review it bought ten extra turns and 3.3 times the cost for the same findings.

Judge by cost per completed task. A cheaper setting that needs a retry is not cheaper.

## Switching mid-session

The prompt cache is per model, so switching model on a warm context makes Claude Code re-process all of it. Claude Code will ask you to confirm when that is about to happen.

Switch at a phase boundary:

1. Write what the next phase needs to a file: the plan, the findings, the task list.
2. `/tokenwise:route <the next phase>`, so the next step clears its answer too.
3. `/clear`.
4. `/model sonnet` then `/effort medium`.
5. Start from the file.

A switch on a cleared context costs nothing. On a warm 300K context it re-processes 300K tokens.

Splitting work across sessions is about the cache, not about saving money on the work itself. On a small task, planning on Opus and implementing on Sonnet cost more than one Opus session, because the plan has to be written, read and paid for. Split when the phases are long enough that carrying the first one's context through the second would cost more than rebuilding it.

## Two settings worth changing

```text
CLAUDE_CODE_SUBAGENT_MODEL=haiku
CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1
```

Requires Claude Code 2.1.257 or later. Without the second variable, the built-in Explore and Plan subagents inherit your session model, so delegating exploration on an Opus session is not cheap. With both set, a delegated exploration cost 30% less on the bench, $0.44 against $0.63 at the median, and the subagent's own reading cost $0.08. Without them the subagent runs on the session model, where its cost is not separable from the main session's.

Subagent tokens still count against your usage. Delegation moves reading to a cheaper model in a context that gets thrown away.

## Habits that matter more than model choice

- `/clear` between unrelated tasks. Stale context is charged on every later message.
- Delegate test runs, log reading and documentation fetching so the verbose output stays out of your context.
- Grep before you read whole files.
- Screenshots are expensive and permanent. A 1024-pixel image is about 1.4K tokens and is re-sent on every later call.
- Bulk labelling or extraction belongs in a script. Each item is seen once, on a cheap model, and the Batch API halves the price.

## Checking your own usage

`/usage` on a subscription plan shows attribution by skill, subagent, plugin and MCP server, and flags long context and cache misses. `/context` shows what is filling the window. For history across sessions, Anthropic's `session-report` plugin and `ccusage` both read the local transcripts.

## What it will not do

- It cannot change your model or effort. Only you can, with `/model` and `/effort`.
- It does not track your spend. The tools above do that.
- It does not know your subscription quota. Costs quoted anywhere in this plugin are API list prices, useful for comparison, not a bill.
