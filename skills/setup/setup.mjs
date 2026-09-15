#!/usr/bin/env node
// Sets the model and effort new Claude Code sessions start on, in the user's settings, and puts them back.
// The /tokenwise:setup skill runs it; nothing here runs on install.
//
//   node skills/setup/setup.mjs show      # current values, the recommendation, and anything that would override it
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

export const applied = (settings) => {
  const c = current(settings);
  return c.model === RECOMMENDED.model && c.effort === RECOMMENDED.effort;
};

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

// What would stop a new session starting on the written values. Managed settings and an organization default model
// can too; they are not readable from here, so the skill names them instead.
export function overrides(env, projectFiles) {
  const found = [];
  if (env.ANTHROPIC_MODEL) found.push(`ANTHROPIC_MODEL=${env.ANTHROPIC_MODEL} sets the model for every session`);
  if (env.CLAUDE_CODE_EFFORT_LEVEL) found.push(`CLAUDE_CODE_EFFORT_LEVEL=${env.CLAUDE_CODE_EFFORT_LEVEL} sets the effort for every session`);
  for (const [file, s] of Object.entries(projectFiles)) {
    if (s.model != null) found.push(`${file} sets model to ${s.model} in this project`);
    if (s.effortLevel != null || s.modelSettings?.[RECOMMENDED.canonical]?.effortLevel != null) found.push(`${file} sets an effort level in this project`);
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

export function run(command, { env = process.env, cwd = process.cwd() } = {}) {
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
    // The top-level effortLevel is not a value setup writes, but it is what a model with no saved level runs at.
    return {
      ok: true, file, current: current(settings), topLevelEffort: settings.effortLevel ?? null,
      recommended: { model: RECOMMENDED.model, effort: RECOMMENDED.effort },
      applied: applied(settings), backup: fs.existsSync(backupFile), overrides: overrides(env, projectFiles),
    };
  }

  if (command === 'apply') {
    if (applied(settings)) return { ok: true, changed: false, message: `${file} already starts new sessions on ${RECOMMENDED.model} at ${RECOMMENDED.effort}. Nothing changed.` };
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
