#!/usr/bin/env node
// Offline sanity check on the plugin's manifests and skill frontmatter, for CI and for local use.
// `claude plugin validate .` runs alongside this in CI, but it checks the marketplace manifest only.
// This covers what that leaves out: plugin.json's required fields, and every skill's frontmatter.
//
//   node scripts/check-manifests.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const fail = [];

let plugin;
let market;
try {
  plugin = JSON.parse(read('.claude-plugin/plugin.json'));
} catch (e) {
  fail.push(`.claude-plugin/plugin.json does not parse: ${e.message}`);
}
try {
  market = JSON.parse(read('.claude-plugin/marketplace.json'));
} catch (e) {
  fail.push(`.claude-plugin/marketplace.json does not parse: ${e.message}`);
}

if (plugin) {
  for (const field of ['name', 'version', 'description', 'license']) {
    if (!plugin[field]) fail.push(`plugin.json is missing ${field}`);
  }
  if (plugin.version && !/^\d+\.\d+\.\d+$/.test(plugin.version)) {
    fail.push(`plugin.json version is not semver: ${plugin.version}`);
  }
}

// An unstaged version bump leaves the changelog announcing a version plugin.json does not have, and every other
// check passes because the old version is valid semver.
if (plugin?.version && fs.existsSync(path.join(ROOT, 'CHANGELOG.md'))) {
  const latest = /^## (\d+\.\d+\.\d+)/m.exec(read('CHANGELOG.md'));
  if (!latest) fail.push('CHANGELOG.md has no "## <version>" heading');
  else if (latest[1] !== plugin.version) {
    fail.push(`CHANGELOG.md's newest entry is ${latest[1]} but plugin.json says ${plugin.version}`);
  }
}

if (plugin && market) {
  const entry = market.plugins?.find((p) => p.name === plugin.name);
  if (!entry) fail.push(`marketplace.json has no entry named ${plugin.name}`);
  else if (!entry.source) fail.push(`marketplace.json entry ${plugin.name} has no source`);
}

// Every skill directory needs a SKILL.md whose frontmatter carries the two fields Claude Code reads to
// decide whether to load it. A skill with no description is invisible.
const skillsDir = path.join(ROOT, 'skills');
const skills = fs.existsSync(skillsDir)
  ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];
if (!skills.length) fail.push('no skills found under skills/');
for (const name of skills) {
  const rel = `skills/${name}/SKILL.md`;
  if (!fs.existsSync(path.join(ROOT, rel))) { fail.push(`${rel} is missing`); continue; }
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(read(rel));
  if (!fm) { fail.push(`${rel} has no frontmatter`); continue; }
  if (!/^name:\s*\S/m.test(fm[1])) fail.push(`${rel} frontmatter has no name`);
  if (!/^description:\s*\S/m.test(fm[1])) fail.push(`${rel} frontmatter has no description`);
}

if (fail.length) {
  for (const f of fail) process.stderr.write(`  ${f}\n`);
  process.exit(1);
}
process.stdout.write(`${plugin.name} ${plugin.version}: manifests agree, ${skills.length} skill(s) with frontmatter\n`);
