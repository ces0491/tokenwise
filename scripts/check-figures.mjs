#!/usr/bin/env node
// The observational token figures are transcribed once, into the table in skills/route/reference.md, and quoted in
// prose by README.md and skills/route/SKILL.md. Nothing tied the three together, so re-running bench/context-profile.mjs
// meant three hand edits and CI caught none of them. This check reads the table as the source of record and fails when
// either of the other two quotes a different number. It cannot check the table against a machine's transcripts: the
// profile reads ~/.claude/projects, which is not in the repository.
//
//   node scripts/check-figures.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const REFERENCE = 'skills/route/reference.md';
const fail = [];

const ref = read(REFERENCE);
const pick = (label, re) => {
  const m = re.exec(ref);
  if (!m) fail.push(`${REFERENCE} no longer states ${label} where this check reads it`);
  return m;
};

const sessions = pick('the session count', /^\| Sessions \| (\d[\d,]*) \|/m)?.[1];
const ratio = pick('the input-to-output ratio', /^\| Input to output \| (\d[\d,]*) to 1 \|/m)?.[1];
const cacheRead = pick('the cache-read share of input', /(\d+)% cache reads/)?.[1];
const busiest = pick('the range the busiest sessions carried', /seven averaged (\d+K) to (\d+K) per call/);

// Each quoting document, with the figures its prose has to agree with.
const QUOTES = [
  ['README.md', [
    [`${sessions} sessions`, 'the session count'],
    [`${ratio} to 1`, 'the input-to-output ratio'],
    [`${cacheRead}% of input was cached`, 'the cache-read share'],
    [`${busiest?.[1]} to ${busiest?.[2]} tokens of context per call`, 'the range the busiest sessions carried'],
  ]],
  ['skills/route/SKILL.md', [
    [`${sessions} sessions`, 'the session count'],
    [`${ratio} to 1`, 'the input-to-output ratio'],
    [`${cacheRead}% of input was cached`, 'the cache-read share'],
  ]],
];

if (!fail.length) {
  for (const [file, quotes] of QUOTES) {
    const text = read(file);
    for (const [needle, label] of quotes) {
      if (!text.includes(needle)) fail.push(`${file} does not quote ${label} as ${REFERENCE} gives it ("${needle}")`);
    }
  }
}

if (fail.length) {
  for (const f of fail) process.stderr.write(`  ${f}\n`);
  process.exit(1);
}
process.stdout.write(`README.md and skills/route/SKILL.md quote the ${REFERENCE} profile: ${sessions} sessions, ${ratio} to 1, ${cacheRead}% cache reads\n`);
