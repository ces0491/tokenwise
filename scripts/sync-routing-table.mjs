#!/usr/bin/env node
// The routing table exists twice: skills/route/SKILL.md carries it with the evidence per row, and
// docs/guide.md carries it with a measured yes/no for a human reading on GitHub. Kept by hand they
// drift, and they already did once. SKILL.md is the source, since that is the copy Claude reads and
// the one whose Measured column has to stay honest; the guide's copy is generated from it.
//
//   node scripts/sync-routing-table.mjs           # rewrite the guide's table
//   node scripts/sync-routing-table.mjs --check    # exit non-zero if it is out of date
//
// A row counts as measured unless its Measured cell opens with "Untested" or "Not separated", which
// is the vocabulary SKILL.md uses for the rows the bench did not cover.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'skills/route/SKILL.md');
const TARGET = path.join(ROOT, 'docs/guide.md');
const BEGIN = '<!-- routing-table: generated from skills/route/SKILL.md by scripts/sync-routing-table.mjs -->';
const END = '<!-- /routing-table -->';

const readLF = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

function parseRoutingTable(md) {
  const section = /^## Routing table$([\s\S]*?)^## /m.exec(md);
  if (!section) throw new Error('SKILL.md has no "## Routing table" section');
  const rows = section[1].split('\n').filter((l) => l.startsWith('|'));
  if (rows.length < 3) throw new Error('routing table has no body rows');
  const cells = (line) => line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const head = cells(rows[0]);
  if (head.length !== 4) throw new Error(`expected 4 columns in the routing table, got ${head.length}`);
  return rows.slice(2).map((line) => {
    const c = cells(line);
    if (c.length !== 4) throw new Error(`row has ${c.length} cells, expected 4: ${line}`);
    const [task, start, escalate, measured] = c;
    return { task, start, escalate, measured, isMeasured: !/^(Untested|Not separated)/.test(measured) };
  });
}

const plain = (s) => s.replace(/`/g, '');

function guideTable(rows) {
  const head = ['Work', 'Start', 'Escalate to', 'Measured'];
  const out = [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`];
  for (const r of rows) {
    const cells = [plain(r.task), plain(r.start), plain(r.escalate), r.isMeasured ? 'yes' : 'no'];
    // An empty cell would otherwise come out as "|  |", which is two spaces where the compact style
    // markdownlint pins wants one.
    out.push(`| ${cells.join(' | ')} |`.replace(/\| {2}\|/g, '| |'));
  }
  return out.join('\n');
}

const rows = parseRoutingTable(readLF(SOURCE));
const table = guideTable(rows);
const guide = readLF(TARGET);
const block = new RegExp(`${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
if (!block.test(guide)) {
  process.stderr.write(`docs/guide.md has no routing-table block. Add these markers around its table:\n  ${BEGIN}\n  ${END}\n`);
  process.exit(1);
}
const updated = guide.replace(block, `${BEGIN}\n${table}\n${END}`);

const measured = rows.filter((r) => r.isMeasured).length;
if (process.argv.includes('--check')) {
  if (updated === guide) {
    process.stdout.write(`docs/guide.md matches the routing table in SKILL.md (${rows.length} rows, ${measured} measured)\n`);
    process.exit(0);
  }
  process.stderr.write('docs/guide.md\'s routing table is out of date with skills/route/SKILL.md.\n');
  process.stderr.write('Run `node scripts/sync-routing-table.mjs` and commit the result.\n');
  process.exit(1);
}

fs.writeFileSync(TARGET, updated);
process.stdout.write(`docs/guide.md updated from SKILL.md: ${rows.length} rows, ${measured} measured\n`);
