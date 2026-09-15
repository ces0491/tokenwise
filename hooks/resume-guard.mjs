#!/usr/bin/env node
// The resume guard. A SessionStart hook for resumed and forked sessions: when the conversation's prompt cache has likely
// expired, the first message re-sends all of it, and Claude Code passes the hook that size and an estimated cost. The
// guard shows the user those figures when the cost is more than a route from the session's model, and says nothing
// otherwise.
//
// It prints only a systemMessage, which Claude Code shows to the user. Plain stdout from a SessionStart hook would go
// into Claude's context, so a failure of any kind prints nothing. The route costs come from route-costs.json, which
// bench/breakeven.mjs writes from the measured routes. Tested by resume-guard.test.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// A model ID as Claude Code reports it, without the [1m] context suffix or a date suffix.
export const canonical = (id) => String(id).replace(/\[1m\]$/, '').replace(/-\d{8}$/, '');

// What a route cost from this session's setting. A measured model at an unmeasured effort takes that model's cheapest
// route, and an unmeasured or unreported model takes the cheapest route of all, so the guard errs towards speaking.
export function threshold(routes, model, effort) {
  const same = model ? routes.filter((r) => r.model === canonical(model)) : [];
  const exact = same.find((r) => r.effort === effort);
  if (exact) return exact.usd;
  const pool = same.length ? same : routes;
  return Math.min(...pool.map((r) => r.usd));
}

const tokens = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}K`);

export function message(input, routes) {
  if (input.source !== 'resume' && input.source !== 'fork') return null;
  if (input.prompt_cache_likely_expired !== true) return null;
  const usd = input.estimated_cache_write_usd;
  if (typeof usd !== 'number' || typeof input.context_tokens !== 'number' || !routes.length) return null;
  if (usd <= threshold(routes, input.model, input.effort?.level)) return null;
  // Claude Code shows this as one dim line under the last message, so the cost comes first.
  return `tokenwise: resuming re-sends ${tokens(input.context_tokens)} tokens, about $${usd.toFixed(2)} at list price, because the cache has expired. Run /clear first if you don't need this conversation.`;
}

export function respond(stdin, routesFile = path.join(HERE, 'route-costs.json')) {
  try {
    const text = message(JSON.parse(stdin), JSON.parse(fs.readFileSync(routesFile, 'utf8')).routes);
    return text ? JSON.stringify({ systemMessage: text }) : '';
  } catch {
    return '';
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { input += d; });
  process.stdin.on('end', () => process.stdout.write(respond(input)));
}
