// Reads the routing table out of skills/route/SKILL.md. Shared by sync-routing-table.mjs, which copies it into
// docs/guide.md, and check-models.mjs, which lists the rows that use an alias.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'route', 'SKILL.md');

export const readLF = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// A row counts as measured unless its Measured cell opens with "Untested", "Not separated" or "Not measured", the
// vocabulary for rows the bench did not cover. The match ignores case and leading markdown emphasis, so "**Untested**"
// or "untested" cannot flip a row to measured.
export function parseRoutingTable(md = readLF(SKILL)) {
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
    return { task, start, escalate, measured, isMeasured: !/^[\s*_`]*(untested|not separated|not measured)(?![a-z])/i.test(measured) };
  });
}
