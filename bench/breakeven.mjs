#!/usr/bin/env node
// Where asking for a route pays for itself. A route costs about the same whatever the task, and what it saves grows
// with the task, so there is a task size below which the route costs more than it saves. This draws that from the
// published data: what each setting cost on the bench's tasks, what a route cost from three session settings, and
// the task sizes where a route breaks even.
//
//   node bench/breakeven.mjs           # writes docs/breakeven.svg and prints every figure it drew
//   node bench/breakeven.mjs --check   # fails unless docs/breakeven.svg follows from the committed data
//
// Task costs are cell medians from results/runs.jsonl, and a cell is drawn only if bench/RESULTS.md shows every run
// in it passing. Route costs are the warm routing turns from results/skill-cost/, and every transcript used has to
// have run against the SKILL.md in this checkout, or the figures would describe a skill that no longer ships.
//
// The bands assume the recommended setting saves the median share it saved across the four tasks, whatever the task
// size. The bench's tasks are small, so that share is measured at one size only.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRuns } from './records.mjs';
import { figures } from './skill-cost.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'docs', 'breakeven.svg');
const fail = (msg) => { process.stderr.write(`${msg}\n`); process.exit(1); };

// Each task, with the setting a route moves you from and the one it recommends: the two cells the claim in
// bench/SCOPE.md compared. The descriptions follow docs/methodology.md.
const PAIRS = [
  { task: 'implement', text: 'Implement a feature from a written spec', from: 'implement-opus-xhigh', to: 'implement-sonnet-medium' },
  { task: 'chore', text: 'Rename a function across code, tests and README', from: 'chore-opus-xhigh', to: 'chore-sonnet-low' },
  { task: 'debug', text: 'Fix a planted bug with a failing test', from: 'debug-opus-high', to: 'debug-sonnet-medium' },
  { task: 'review', text: 'Review a six-file diff with five planted defects', from: 'review-opus-high', to: 'review-opus-low' },
];
// The skill-cost labels that measured a warm route from each session setting, cheapest setting first.
const ROUTES = [['1.1.2-sonnet-medium'], ['1.1.2-opus-high'], ['1.1.2']];
// idle and no-plugin depend only on the skill's description, which 1.1.2 shares with 1.0.1.
const BASE = '1.0.1';

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// "claude-opus-5" is Opus 5; "claude-haiku-4-5-20251001" is Haiku 4.5.
function modelName(id) {
  const parts = id.replace(/^claude-/, '').split('-').filter((p) => !/^\d{8}$/.test(p));
  return `${parts[0][0].toUpperCase()}${parts[0].slice(1)} ${parts.slice(1).join('.')}`;
}
const setting = (id, effort) => (effort ? `${modelName(id)}, ${effort}` : modelName(id));

// ---- task costs --------------------------------------------------------------------------------------

const passedCells = new Map();
for (const line of fs.readFileSync(path.join(HERE, 'RESULTS.md'), 'utf8').split('\n')) {
  const m = line.match(/^\| ([a-z0-9-]+) \| (\d+) \| (\d+)\/(\d+) \|/);
  if (m) passedCells.set(m[1], Number(m[3]) === Number(m[2]) && Number(m[4]) === Number(m[2]));
}

const byCell = new Map();
for (const r of loadRuns(path.join(HERE, 'results', 'runs.jsonl'))) {
  const cell = r.id.replace(/#\d+$/, '');
  if (!byCell.has(cell)) byCell.set(cell, []);
  byCell.get(cell).push(r);
}

function cell(id) {
  const rs = byCell.get(id);
  if (!rs) fail(`no runs for ${id}`);
  if (passedCells.get(id) !== true) fail(`${id}: bench/RESULTS.md does not show every run passing`);
  const models = [...new Set(rs.flatMap((r) => Object.keys(r.metrics.models).filter((m) => m.includes(r.model))))];
  if (models.length !== 1) fail(`${id}: runs used ${models.join(', ') || 'no model'} for ${rs[0].model}`);
  return { id, model: models[0], effort: rs[0].effort, label: setting(models[0], rs[0].effort), n: rs.length, cost: median(rs.map((r) => r.metrics.usd)), runs: rs };
}

const ladders = PAIRS.map((p) => {
  const cells = [...byCell.keys()].filter((k) => k.startsWith(`${p.task}-`)).map(cell).sort((a, b) => a.cost - b.cost);
  const from = cells.find((c) => c.id === p.from);
  const to = cells.find((c) => c.id === p.to);
  return { ...p, cells, fromCell: from, toCell: to, share: 1 - to.cost / from.cost };
});
const share = median(ladders.map((l) => l.share));

// ---- route costs -------------------------------------------------------------------------------------

const skillHash = crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(ROOT, 'skills', 'route', 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);

const routes = ROUTES.map((labels) => {
  const runs = labels.map((label) => {
    const f = figures(`${label}@${BASE}`);
    const inv = f.sessions.invoked;
    if (!inv?.complete || inv.from) fail(`${label}: no complete invoked session of its own`);
    if (inv.meta.skill !== skillHash) fail(`${label} ran against SKILL.md ${inv.meta.skill}; this checkout's is ${skillHash}. Re-measure (CONTRIBUTING.md).`);
    const lines = fs.readFileSync(path.join(HERE, 'results', 'skill-cost', label, 'invoked.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const result = lines.filter((o) => o.type === 'result').at(-1);
    const model = Object.keys(result.modelUsage).find((m) => m.includes(inv.meta.model));
    return { label, model, effort: inv.meta.effort, recorded: inv.meta.recorded.slice(0, 10), version: lines.find((o) => o.subtype === 'init')?.claude_code_version, cost: f.routeWarm.turnCost, carried: f.carriedFirst };
  });
  const keys = new Set(runs.map((r) => `${r.model} ${r.effort}`));
  if (keys.size !== 1) fail(`${labels.join(', ')} measured different settings: ${[...keys].join('; ')}`);
  const r = mean(runs.map((x) => x.cost));
  return { label: setting(runs[0].model, runs[0].effort), model: runs[0].model, effort: runs[0].effort, runs, cost: r, even: r / share, double: (2 * r) / share };
});

// ---- the figure --------------------------------------------------------------------------------------

const C = { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7', blue: '#2a78d6', red: '#e34948', neutral: '#f0efec', from: '#898781', other: '#c3c2b7' };
const FONT = 'system-ui, -apple-system, &quot;Segoe UI&quot;, sans-serif';
const W = 960;
const X0 = 40;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f2 = (n) => n.toFixed(2);
const usd = (n) => `$${f2(n)}`;
const out = [];
const text = (x, y, s, { size = 13, fill = C.ink2, weight = 400, anchor = 'start' } = {}) =>
  out.push(`<text x="${f2(x)}" y="${f2(y)}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${esc(s)}</text>`);
// A bar grows right from its baseline, square there and rounded 4px at the data end.
const bar = (x, y, w, h, fill, title) => {
  const r = Math.min(4, w / 2, h / 2);
  out.push(`<path d="M${f2(x)} ${f2(y)}H${f2(x + w - r)}Q${f2(x + w)} ${f2(y)} ${f2(x + w)} ${f2(y + r)}V${f2(y + h - r)}Q${f2(x + w)} ${f2(y + h)} ${f2(x + w - r)} ${f2(y + h)}H${f2(x)}Z" fill="${fill}"><title>${esc(title)}</title></path>`);
};
const dot = (x, y, fill, title) => out.push(`<circle cx="${f2(x)}" cy="${f2(y)}" r="5" fill="${fill}" stroke="${C.surface}" stroke-width="2"><title>${esc(title)}</title></circle>`);
const swatch = (x, y, fill) => out.push(`<rect x="${f2(x)}" y="${f2(y - 10)}" width="12" height="12" rx="2" fill="${fill}"/>`);

let y = 44;
text(X0, y, 'When is a route worth asking for?', { size: 26, fill: C.ink, weight: 600 });
y += 26;
text(X0, y, 'A tokenwise route recommends a model and effort level for a piece of work. The answer has a price of its own,', { size: 14 });
y += 20;
text(X0, y, 'so it pays only on work big enough for the cheaper setting to save more than that.', { size: 14 });

// Section A: what each setting cost.
y += 50;
text(X0, y, 'What each setting cost, task by task', { size: 18, fill: C.ink, weight: 600 });
y += 22;
text(X0, y, `Median list-price cost per run, ${Math.min(...ladders.flatMap((l) => l.cells.map((c) => c.n)))} to ${Math.max(...ladders.flatMap((l) => l.cells.map((c) => c.n)))} runs per setting. Every run shown passed its grader.`, { size: 13 });
y += 22;
swatch(X0, y, C.blue); text(X0 + 18, y, 'the setting a route recommends', { size: 13 });
swatch(X0 + 230, y, C.from); text(X0 + 248, y, 'the setting it moves you from', { size: 13 });
swatch(X0 + 450, y, C.other); text(X0 + 468, y, 'other settings measured', { size: 13 });

const maxCost = Math.max(...ladders.flatMap((l) => l.cells.map((c) => c.cost)));
const COL = [X0, 500];
const LABEL = 128;
const BARW = 230;
const ROW = 22;
const columns = [[ladders[0], ladders[1]], [ladders[2], ladders[3]]];
const top = y + 34;
let bottom = top;
columns.forEach((ls, ci) => {
  let cy = top;
  for (const l of ls) {
    text(COL[ci], cy, l.text, { size: 14, fill: C.ink, weight: 600 });
    cy += 10;
    for (const c of l.cells) {
      const w = Math.max(2, (c.cost / maxCost) * BARW);
      const fill = c.id === l.to ? C.blue : c.id === l.from ? C.from : C.other;
      text(COL[ci] + LABEL - 8, cy + 15, c.label, { size: 12, anchor: 'end' });
      bar(COL[ci] + LABEL, cy + 4, w, 14, fill, `${l.task}, ${c.label}: ${usd(c.cost)} median of ${c.n}`);
      text(COL[ci] + LABEL + w + 6, cy + 15, usd(c.cost), { size: 12, fill: C.ink });
      cy += ROW;
    }
    cy += 24;
  }
  bottom = Math.max(bottom, cy);
});

// Section B: what a route costs.
y = bottom + 20;
text(X0, y, 'What asking for a route costs', { size: 18, fill: C.ink, weight: 600 });
y += 22;
const multi = routes.filter((r) => r.runs.length > 1);
text(X0, y, `A route in a session already under way, one run per setting${multi.map((r) => ` and ${r.runs.length} on ${r.label.replace(', ', ' at ')}`).join('')}. It runs on the session’s own model and effort.`, { size: 13 });
const BX = X0 + 150;
const BW = 420;
const bmax = 0.2;
const bx = (v) => BX + (v / bmax) * BW;
y += 30;
const brows = routes.map((_, i) => y + 16 + i * 30);
const baxis = brows.at(-1) + 22;
for (const t of [0, 0.05, 0.1, 0.15, 0.2]) {
  out.push(`<line x1="${f2(bx(t))}" y1="${f2(brows[0] - 12)}" x2="${f2(bx(t))}" y2="${f2(baxis - 8)}" stroke="${C.grid}" stroke-width="1"/>`);
  text(bx(t), baxis + 6, usd(t), { size: 12, fill: C.muted, anchor: 'middle' });
}
text(BX + BW + 40, y, 'Answer left in context', { size: 12, fill: C.muted });
routes.forEach((r, i) => {
  const ry = brows[i];
  text(BX - 10, ry + 4, r.label, { size: 13, anchor: 'end' });
  out.push(`<line x1="${f2(bx(0))}" y1="${f2(ry)}" x2="${f2(bx(Math.max(...r.runs.map((x) => x.cost))))}" y2="${f2(ry)}" stroke="${C.axis}" stroke-width="2"/>`);
  const runs = [...r.runs].sort((a, b) => a.cost - b.cost);
  for (const run of runs) dot(bx(run.cost), ry, C.blue, `${r.label}: ${usd(run.cost)} (${run.label})`);
  text(bx(Math.max(...r.runs.map((x) => x.cost))) + 12, ry + 4, runs.map((x) => usd(x.cost)).join(' and '), { size: 13, fill: C.ink });
  text(BX + BW + 40, ry + 4, `${runs.map((x) => x.carried).join(' and ')} tokens`, { size: 13, fill: C.ink });
});

// Section C: where it pays.
y = baxis + 56;
text(X0, y, 'Where a route pays for itself', { size: 18, fill: C.ink, weight: 600 });
y += 22;
text(X0, y, `By what the task would cost on the setting you are on. The recommended setting saved a median ${Math.round(share * 100)}% on the four tasks above. The bands assume`, { size: 13 });
y += 18;
text(X0, y, `the same share at any size${multi.length ? ', and use the mean route cost where a setting has more than one run' : ''}. Each dot is one of those tasks, on its starting setting.`, { size: 13 });

const SX = X0 + 150;
const SW = 700;
const LMIN = -2;
const LMAX = 1;
const sx = (v) => SX + ((Math.log10(v) - LMIN) / (LMAX - LMIN)) * SW;
const STRIP = 28;
const srows = routes.map((_, i) => y + 44 + i * 74);
for (const t of [0.01, 0.03, 0.1, 0.3, 1, 3, 10]) {
  out.push(`<line x1="${f2(sx(t))}" y1="${f2(srows[0] - 26)}" x2="${f2(sx(t))}" y2="${f2(srows.at(-1) + STRIP + 26)}" stroke="${C.grid}" stroke-width="1"/>`);
  text(sx(t), srows.at(-1) + STRIP + 42, t < 1 ? usd(t) : `$${t}`, { size: 12, fill: C.muted, anchor: 'middle' });
}
routes.forEach((r, i) => {
  const ry = srows[i];
  text(SX - 10, ry + STRIP / 2 + 5, r.label, { size: 13, anchor: 'end' });
  const zones = [
    [10 ** LMIN, r.even, C.red, 0.18, `costs more than it saves below ${usd(r.even)}`],
    [r.even, r.double, C.neutral, 1, `saves one to two times its cost between ${usd(r.even)} and ${usd(r.double)}`],
    [r.double, 10 ** LMAX, C.blue, 0.16, `saves more than twice its cost above ${usd(r.double)}`],
  ];
  zones.forEach(([a, b, fill, op, title], zi) => {
    const x1 = sx(a) + (zi ? 1 : 0);
    const x2 = sx(b) - (zi < 2 ? 1 : 0);
    out.push(`<rect x="${f2(x1)}" y="${f2(ry)}" width="${f2(x2 - x1)}" height="${STRIP}" rx="${zi === 0 || zi === 2 ? 4 : 0}" fill="${fill}" fill-opacity="${op}"><title>${esc(`${r.label}: ${title}`)}</title></rect>`);
  });
  text(sx(r.even), ry + STRIP + 16, usd(r.even), { size: 12, fill: C.ink, anchor: 'middle' });
  text(sx(r.double), ry + STRIP + 16, usd(r.double), { size: 12, fill: C.ink, anchor: 'middle' });
  for (const l of ladders.filter((x) => x.fromCell.model === r.model && x.fromCell.effort === r.effort)) {
    const dx = sx(l.fromCell.cost);
    dot(dx, ry + STRIP / 2, C.ink, `${l.task} on ${r.label}: ${usd(l.fromCell.cost)}; the route saved ${usd(l.fromCell.cost - l.toCell.cost)} and cost ${usd(r.cost)}`);
    text(dx, ry - 6, `${l.task} ${usd(l.fromCell.cost)}`, { size: 12, fill: C.ink, anchor: 'middle' });
  }
});

text(SX + SW / 2, srows.at(-1) + STRIP + 62, 'What the task would cost on the setting you are on (log scale)', { size: 12, fill: C.muted, anchor: 'middle' });
y = srows.at(-1) + STRIP + 96;
out.push(`<rect x="${f2(SX)}" y="${f2(y - 10)}" width="12" height="12" rx="2" fill="${C.red}" fill-opacity="0.18"/>`);
text(SX + 18, y, 'costs more than it saves', { size: 13 });
out.push(`<rect x="${f2(SX + 210)}" y="${f2(y - 10)}" width="12" height="12" rx="2" fill="${C.neutral}" stroke="${C.axis}" stroke-width="1"/>`);
text(SX + 228, y, 'small gain: saves one to two times its cost', { size: 13 });
out.push(`<rect x="${f2(SX + 500)}" y="${f2(y - 10)}" width="12" height="12" rx="2" fill="${C.blue}" fill-opacity="0.16"/>`);
text(SX + 518, y, 'saves more than twice its cost', { size: 13 });
y += 24;
text(SX, y, 'Already on the setting a route recommends? Then it saves nothing, and every task size costs more than it saves.', { size: 13 });

// Footer: where the figures came from.
const taskRuns = ladders.flatMap((l) => l.cells.flatMap((c) => c.runs));
const taskVersions = [...new Set(taskRuns.map((r) => r.claude_version.replace(/ \(Claude Code\)$/, '')))].join(', ');
const day = (iso) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const taskDays = [...new Set(taskRuns.map((r) => day(r.started)))].join(', ');
const routeRuns = routes.flatMap((r) => r.runs);
const routeVersions = [...new Set(routeRuns.map((r) => r.version))].join(', ');
const routeDays = [...new Set(routeRuns.map((r) => day(r.recorded)))].join(', ');
y += 44;
out.push(`<line x1="${X0}" y1="${f2(y - 22)}" x2="${W - X0}" y2="${f2(y - 22)}" stroke="${C.grid}" stroke-width="1"/>`);
text(X0, y, `Tasks: Claude Code ${taskVersions}, run ${taskDays}. Routes: tokenwise SKILL.md ${skillHash}, Claude Code ${routeVersions}, run ${routeDays}.`, { size: 12, fill: C.muted });
y += 18;
text(X0, y, 'Dollars are Claude Code’s list-price figures; on a subscription they weight usage rather than bill it. The bench’s tasks are small.', { size: 12, fill: C.muted });
y += 18;
text(X0, y, 'Reproduce with node bench/breakeven.mjs at github.com/ces0491/tokenwise.', { size: 12, fill: C.muted });
const H = Math.ceil(y + 28);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}" role="img" aria-labelledby="t d">
<title id="t">When is a route worth asking for?</title>
<desc id="d">What each model and effort setting cost on four bench tasks, what a tokenwise route costs from three session settings, and the task sizes at which a route costs more than it saves, saves less than it costs, or saves more.</desc>
<rect width="${W}" height="${H}" fill="${C.surface}"/>
${out.join('\n')}
</svg>
`;

// ---- tables: every figure drawn ----------------------------------------------------------------------

const tables = [
  '| task | setting | runs | median cost |',
  '| --- | --- | --- | --- |',
  ...ladders.flatMap((l) => l.cells.map((c) => `| ${l.task} | ${c.label}${c.id === l.to ? ' (recommended)' : c.id === l.from ? ' (moved from)' : ''} | ${c.n} | ${usd(c.cost)} |`)),
  '',
  '| task | moved from | recommended | saved | share saved |',
  '| --- | --- | --- | --- | --- |',
  ...ladders.map((l) => `| ${l.task} | ${usd(l.fromCell.cost)} | ${usd(l.toCell.cost)} | ${usd(l.fromCell.cost - l.toCell.cost)} | ${Math.round(l.share * 100)}% |`),
  `| median | | | | ${Math.round(share * 100)}% |`,
  '',
  '| asking from | route cost per run | mean | answer left in context (tokens) | costs more than it saves below | saves less than twice its cost below |',
  '| --- | --- | --- | --- | --- | --- |',
  ...routes.map((r) => `| ${r.label} | ${r.runs.map((x) => usd(x.cost)).join(', ')} | ${usd(r.cost)} | ${r.runs.map((x) => x.carried).join(', ')} | ${usd(r.even)} | ${usd(r.double)} |`),
].join('\n');

if (process.argv.includes('--check')) {
  const committed = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
  if (committed !== svg) fail('docs/breakeven.svg does not follow from the committed data. Run node bench/breakeven.mjs and commit it.');
  process.stdout.write('docs/breakeven.svg follows from the committed data.\n');
} else {
  fs.writeFileSync(OUT, svg);
  process.stdout.write(`${tables}\n\nWrote ${path.relative(ROOT, OUT)}.\n`);
}
