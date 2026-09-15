// Shared by the plugin's hooks: the measured route costs, the threshold a hook's warning has to clear, and how a hook
// answers Claude Code. Tested through resume-guard.test.mjs and switch-figure.test.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// What a route cost from each measured setting, written by bench/breakeven.mjs.
export const ROUTES_FILE = path.join(HERE, 'route-costs.json');

// A model ID as Claude Code reports it, without the [1m] context suffix or a date suffix.
export const canonical = (id) => String(id).replace(/\[1m\]$/, '').replace(/-\d{8}$/, '');

// What a route cost from this session's setting. A measured model at an unmeasured effort takes that model's cheapest
// route, and an unmeasured or unreported model takes the cheapest route of all, so a hook errs towards speaking.
export function threshold(routes, model, effort) {
  const same = model ? routes.filter((r) => r.model === canonical(model)) : [];
  const exact = same.find((r) => r.effort === effort);
  if (exact) return exact.usd;
  const pool = same.length ? same : routes;
  return Math.min(...pool.map((r) => r.usd));
}

// Rounded before the unit is picked, so 999,600 reads 1.0M rather than 1000K.
export const tokens = (n) => (Math.round(n / 1e3) >= 1000 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}K`);

// The session's effort level. The hooks reference sends an `effort` object only on events inside a tool-use context,
// which SessionStart and PreModelSwitch are not, and gives the level to every hook command as $CLAUDE_EFFORT.
export const effortOf = (input, env = process.env) => input.effort?.level ?? env.CLAUDE_EFFORT ?? undefined;

// Whether a hook script was run directly, including through a symlink or junction, where argv[1] is the link and
// import.meta.url the real path.
export function isMain(meta) {
  if (typeof meta.main === 'boolean') return meta.main;
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fileURLToPath(meta.url);
  } catch {
    return false;
  }
}

// A hook's whole stdout: a systemMessage when message() returns text, and nothing otherwise, including on any failure.
// Neither hook makes a decision or adds context, so a broken hook changes nothing for the user.
export function respond(stdin, message, routesFile = ROUTES_FILE) {
  try {
    const text = message(JSON.parse(stdin), JSON.parse(fs.readFileSync(routesFile, 'utf8')).routes);
    return text ? JSON.stringify({ systemMessage: text }) : '';
  } catch {
    return '';
  }
}

export function runHook(message) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { input += d; });
  process.stdin.on('end', () => process.stdout.write(respond(input, message)));
}
