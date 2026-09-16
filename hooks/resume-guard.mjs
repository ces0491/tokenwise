#!/usr/bin/env node
// The resume guard. A SessionStart hook for resumed and forked sessions: when the conversation's prompt cache has likely
// expired, the first message re-sends all of it, and Claude Code passes the hook that size and an estimated cost. The
// guard shows the user those figures when the cost is more than a route from the session's model, and says nothing
// otherwise.
//
// It prints only a systemMessage, which Claude Code shows to the user and does not send to the model. Plain stdout from
// a SessionStart hook would go into Claude's context, so a failure of any kind prints nothing (route-cost.mjs).
// Tested by resume-guard.test.mjs.

import { effortOf, isMain, respond as respondWith, runHook, threshold, tokens } from './route-cost.mjs';

export { canonical, threshold } from './route-cost.mjs';

export function message(input, routes) {
  if (input.source !== 'resume' && input.source !== 'fork') return null;
  if (input.prompt_cache_likely_expired !== true) return null;
  const usd = input.estimated_cache_write_usd;
  if (typeof usd !== 'number' || typeof input.context_tokens !== 'number' || !routes.length) return null;
  if (usd <= threshold(routes, input.model, effortOf(input))) return null;
  // Claude Code shows this as one dim line under the last message, so the cost comes first.
  return `tokenwise: resuming re-sends ${tokens(input.context_tokens)} tokens, about $${usd.toFixed(2)} by Claude Code's estimate, because the cache has expired. Run /clear first if you don't need this conversation.`;
}

export const respond = (stdin, routesFile) => respondWith(stdin, message, routesFile);

if (isMain(import.meta)) runHook(message);
