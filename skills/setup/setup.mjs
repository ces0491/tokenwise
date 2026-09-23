#!/usr/bin/env node
// Checks the model and effort new Claude Code sessions start on, in the user's settings, sets Sonnet 5 at medium when
// the bench measured the current setting costing more, and puts the previous values back.
// The /tokenwise:setup skill runs it; nothing here runs on install.
//
//   node skills/setup/setup.mjs show      # the setting sessions start on, whether setup recommends a change and why,
//                                         # and anything that would override it
//   node skills/setup/setup.mjs apply     # write the recommendation, saving the values from before setup first ran
//   node skills/setup/setup.mjs restore   # put those back, except values the user changed after apply
//
// Claude Code resolves effort per model: a level saved under modelSettings for a model wins over the top-level
// effortLevel in the same file, and /effort saves there. So the effort is written under modelSettings for the
// recommended model. Settings live in CLAUDE_CONFIG_DIR when it is set, and in ~/.claude otherwise.
// Tested by setup.test.mjs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const RECOMMENDED = { model: 'sonnet', canonical: 'claude-sonnet-5', effort: 'medium' };
const BACKUP = 'tokenwise-setup-backup.json';

export const configDir = (env = process.env) => env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');

// The two values setup owns, as they stand in a settings object. null means the key is absent.
export function current(settings) {
  return {
    model: settings.model ?? null,
    effort: settings.modelSettings?.[RECOMMENDED.canonical]?.effortLevel ?? null,
  };
}

// What each model setting resolves to on the Anthropic API from Claude Code 2.1.280, per the model configuration docs.
// No model set, or "default", is the account default: Opus 5.5 on Pro, Max, Team, Enterprise and the API. The
// ANTHROPIC_DEFAULT_* environment variables change both, so overrides() names them.
const ACCOUNT_DEFAULT = 'claude-opus-5-5';
const ALIASES = { opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5', haiku: 'claude-haiku-4-5', fable: 'claude-fable-5-1', best: 'claude-fable-5-1' };
const RESOLVES_FROM = '2.1.280';
export const isDefault = (m) => m == null || String(m).toLowerCase() === 'default';
export const canonicalModel = (m) => {
  if (isDefault(m)) return ACCOUNT_DEFAULT;
  const id = String(m).toLowerCase().replace(/\[1m\]$/, '').replace(/-\d{8}$/, '');
  return ALIASES[id] ?? id;
};

const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];

// The level a model runs at from these settings: its saved level, then the top-level effortLevel, which Opus 5.5
// ignores in the user's settings, then the model's own default. A cap lowers it: the model entry's maxEffortLevel,
// which replaces the top-level one in the same file, or else the top-level one. Haiku takes no effort level.
export function effortFor(settings, model) {
  if (model === 'claude-haiku-4-5') return null;
  const entry = settings.modelSettings?.[model] ?? {};
  const level = entry.effortLevel
    ?? (model === 'claude-opus-5-5' ? undefined : settings.effortLevel)
    ?? (model === 'claude-opus-5-5' ? 'medium' : model === 'claude-opus-4-7' ? 'xhigh' : 'high');
  const cap = entry.maxEffortLevel ?? settings.maxEffortLevel;
  return LEVELS.includes(level) && LEVELS.includes(cap) && LEVELS.indexOf(level) > LEVELS.indexOf(cap) ? cap : level;
}

export const applied = (settings) => canonicalModel(settings.model) === RECOMMENDED.canonical
  && effortFor(settings, RECOMMENDED.canonical) === RECOMMENDED.effort;

// Settings where Sonnet 5 at medium cost at most 0.7 times as much per completed task, the bench's noise band, on every
// task the bench ran both. The rest of what the bench measured against Sonnet 5 at medium ("noise") cleared it on some
// tasks or none: Sonnet 5 at high (0.72 times on the one task), Sonnet 5 at xhigh (0.51 and 0.80 on two tasks), and the
// account default, Opus 5.5 at medium, which C12 compared on four tasks and which cleared it on one ("c12").
const COSTLIER = { 'claude-opus-5': ['medium', 'high', 'xhigh'], 'claude-fable-5-1': ['xhigh'] };
const NOISE = { 'claude-sonnet-5': ['high', 'xhigh'] };

const older = (v, than) => {
  const [a, b] = [v, than].map((x) => x.split('.').map(Number));
  const i = a.findIndex((n, k) => n !== b[k]);
  return i >= 0 && a[i] < b[i];
};

// The installed Claude Code's version, or null when it cannot be read. Aliases and the account default resolve by
// version, and setup reads them as 2.1.280 does.
// On Windows an npm install is a .cmd shim, which needs a shell, and a shell takes one command string.
export function claudeVersion(env = process.env) {
  const bin = env.CLAUDE_BIN || 'claude';
  const options = { encoding: 'utf8', timeout: 10_000, env };
  const r = process.platform === 'win32' ? spawnSync(`"${bin}" --version`, { ...options, shell: true }) : spawnSync(bin, ['--version'], options);
  return /(\d+\.\d+\.\d+)/.exec(r.stdout ?? '')?.[1] ?? null;
}

// Whether setup recommends a change, and on what basis: "applied" (already there), "old-cli" (a Claude Code older
// than the one setup reads settings as), "c12" (Opus 5.5 at medium), "noise" (see NOISE), "cheaper" (Haiku, or Sonnet 5
// at low), "measured" (a setting in COSTLIER) or "unmeasured" (anything else).
export function assess(settings, { cliVersion = null } = {}) {
  const model = canonicalModel(settings.model);
  const start = { model, effort: effortFor(settings, model), accountDefault: isDefault(settings.model) };
  const basis = applied(settings) ? 'applied'
    : cliVersion && older(cliVersion, RESOLVES_FROM) ? 'old-cli'
      : model === 'claude-opus-5-5' && start.effort === 'medium' ? 'c12'
        : NOISE[model]?.includes(start.effort) ? 'noise'
          : model === 'claude-haiku-4-5' || (model === 'claude-sonnet-5' && start.effort === 'low') ? 'cheaper'
            : COSTLIER[model]?.includes(start.effort) ? 'measured' : 'unmeasured';
  return { start, recommend: basis === 'measured', basis };
}

// A copy of settings with the given values written, deleting a key whose value is null and any object left empty.
export function withValues(settings, { model, effort }) {
  const out = structuredClone(settings);
  if (model == null) delete out.model;
  else out.model = model;
  const all = { ...(out.modelSettings || {}) };
  const entry = { ...(all[RECOMMENDED.canonical] || {}) };
  if (effort == null) delete entry.effortLevel;
  else entry.effortLevel = effort;
  if (Object.keys(entry).length) all[RECOMMENDED.canonical] = entry;
  else delete all[RECOMMENDED.canonical];
  if (Object.keys(all).length) out.modelSettings = all;
  else delete out.modelSettings;
  return out;
}

// What makes sessions start somewhere other than the user's settings say, or would stop them starting on the written
// values. Managed settings and an organization default model can too; they are not readable from here, so the skill
// names them instead.
export function overrides(env, projectFiles) {
  const found = [];
  if (env.ANTHROPIC_MODEL) found.push(`ANTHROPIC_MODEL=${env.ANTHROPIC_MODEL} sets the model for every session`);
  if (env.ANTHROPIC_DEFAULT_MODEL) found.push(`ANTHROPIC_DEFAULT_MODEL=${env.ANTHROPIC_DEFAULT_MODEL} sets the model when no settings file names one`);
  for (const family of ['OPUS', 'SONNET', 'HAIKU', 'FABLE']) {
    const v = env[`ANTHROPIC_DEFAULT_${family}_MODEL`];
    if (v) found.push(`ANTHROPIC_DEFAULT_${family}_MODEL=${v} changes what the ${family.toLowerCase()} alias resolves to`);
  }
  if (env.CLAUDE_CODE_EFFORT_LEVEL) found.push(`CLAUDE_CODE_EFFORT_LEVEL=${env.CLAUDE_CODE_EFFORT_LEVEL} sets the effort for every session`);
  for (const [file, s] of Object.entries(projectFiles)) {
    if (s.model != null) found.push(`${file} sets model to ${s.model} in this project`);
    const entries = Object.values(s.modelSettings || {});
    if (s.effortLevel != null || entries.some((e) => e?.effortLevel != null)) found.push(`${file} sets an effort level in this project`);
    if (s.maxEffortLevel != null || entries.some((e) => e?.maxEffortLevel != null)) found.push(`${file} caps effort in this project`);
  }
  return found;
}

// ---- files -------------------------------------------------------------------------------------------

// undefined when the file does not exist, so a file holding JSON null is not mistaken for a missing one.
function readJson(file) {
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Written to a temporary file and renamed, so an interrupted write cannot leave half a settings file. A failed write
// removes its temporary file and throws.
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tokenwise-${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// cliVersion defaults to the installed Claude Code's, read when show or apply needs it.
export function run(command, { env = process.env, cwd = process.cwd(), cliVersion } = {}) {
  const version = () => (cliVersion === undefined ? claudeVersion(env) : cliVersion);
  const dir = configDir(env);
  const file = path.join(dir, 'settings.json');
  const backupFile = path.join(dir, BACKUP);
  let settings;
  try {
    const parsed = readJson(file);
    settings = parsed === undefined ? {} : parsed;
  } catch (e) {
    return { ok: false, message: `${file} is not valid JSON, so nothing was changed: ${e.message}` };
  }
  if (!isObject(settings)) return { ok: false, message: `${file} does not hold a JSON object, so nothing was changed.` };

  if (command === 'show') {
    const projectFiles = {};
    for (const rel of ['.claude/settings.json', '.claude/settings.local.json']) {
      try {
        const s = readJson(path.join(cwd, rel));
        if (s) projectFiles[rel] = s;
      } catch { /* an unreadable project file is Claude Code's to report */ }
    }
    const claude = version();
    const a = assess(settings, { cliVersion: claude });
    return {
      ok: true, file, claudeVersion: claude, current: current(settings),
      start: a.start, recommend: a.recommend, basis: a.basis,
      applied: applied(settings), backup: fs.existsSync(backupFile), overrides: overrides(env, projectFiles),
    };
  }

  if (command === 'apply') {
    if (applied(settings)) return { ok: true, changed: false, message: `${file} already starts new sessions on ${RECOMMENDED.model} at ${RECOMMENDED.effort}. Nothing changed.` };
    const a = assess(settings, { cliVersion: version() });
    if (!a.recommend) {
      const at = a.start.effort ? ` at ${a.start.effort}` : '';
      return { ok: false, changed: false, message: `Setup recommends no change from ${a.start.model}${at} (${a.basis}), so nothing was written. /model sets a default by hand.` };
    }
    const before = current(settings);
    // A backup left by an earlier apply holds the values from before setup first ran, so it is kept. Otherwise a second
    // apply, after the user changed a value, would save setup's own values as the ones to go back to.
    const hadBackup = fs.existsSync(backupFile);
    try {
      if (!hadBackup) writeJson(backupFile, { ...before, savedAt: new Date().toISOString() });
      writeJson(file, withValues(settings, RECOMMENDED));
    } catch (e) {
      if (!hadBackup) fs.rmSync(backupFile, { force: true });
      return { ok: false, message: `Could not write ${file}, so nothing was changed: ${e.message}` };
    }
    return { ok: true, changed: true, before, message: `New sessions start on ${RECOMMENDED.model} at ${RECOMMENDED.effort}. The values from before setup first ran are saved; restore puts them back.` };
  }

  if (command === 'restore') {
    let backup;
    try {
      backup = readJson(backupFile);
    } catch (e) {
      return { ok: false, message: `${backupFile} is not valid JSON, so nothing was changed: ${e.message}` };
    }
    if (!backup) return { ok: false, message: 'No saved values to restore: setup has not changed these settings.' };
    // A value the user changed after apply is theirs, so only a value still holding setup's recommendation goes back.
    const now = current(settings);
    const target = {
      model: now.model === RECOMMENDED.model ? backup.model : now.model,
      effort: now.effort === RECOMMENDED.effort ? backup.effort : now.effort,
    };
    const kept = ['model', 'effort'].filter((k) => now[k] !== RECOMMENDED[k]);
    try {
      writeJson(file, withValues(settings, target));
    } catch (e) {
      return { ok: false, message: `Could not write ${file}, so nothing was changed: ${e.message}` };
    }
    fs.rmSync(backupFile);
    const note = kept.length ? ` Left alone, because they changed after setup: ${kept.join(' and ')}.` : '';
    return { ok: true, changed: true, restored: target, kept, message: `The model and effort setup replaced are back.${note}` };
  }

  return { ok: false, message: `Unknown command "${command}". Use show, apply or restore.` };
}

// Run directly, including through a symlink or junction, where argv[1] is the link and import.meta.url the real path.
const realArgv = () => {
  try {
    return fs.realpathSync(process.argv[1]);
  } catch {
    return null;
  }
};
if (import.meta.main ?? (process.argv[1] && realArgv() === fileURLToPath(import.meta.url))) {
  const result = run(process.argv[2]);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
