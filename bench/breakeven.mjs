#!/usr/bin/env node
// Where asking for a route pays for itself. A route is told to read only its own instructions and the description it
// is given, so its cost should not grow with the task, while what it saves does; the bench priced routes on two short
// descriptions only. This draws the comparison from the published data: what each setting cost on the bench's tasks,
// what a route cost from three session settings, and the task sizes where a route breaks even.
//
//   node bench/breakeven.mjs           # writes docs/breakeven.svg and prints every figure it drew
//   node bench/breakeven.mjs --check   # fails unless docs/breakeven.svg follows from the committed data
//
// Task costs are cell medians from results/runs.jsonl. A cell is drawn only if bench/RESULTS.md shows every run in it
// passing, and the script fails if a cell a task pair compares did not. Route costs are the warm routing turns from
// results/skill-cost/<version>*, where <version> is plugin.json's, and every transcript used has to have run against
// the SKILL.md in this checkout, or the figures would describe a skill that no longer ships.
//
// The bands assume the recommended setting saves the median share it saved across the task pairs, whatever the task
// size. The bench's tasks are small, so that share is measured at one size only.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cellOf } from './matrix.mjs';
import { loadRuns, median } from './records.mjs';
import { figures, skillHash } from './skill-cost.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'docs', 'breakeven.svg');

// Each task, with the setting a route moves you from and the one it recommends: the two cells the claim in
// bench/SCOPE.md compared. The descriptions follow docs/methodology.md.
const PAIRS = [
  { task: 'implement', text: 'Implement a feature from a written spec', from: 'implement-opus-xhigh', to: 'implement-sonnet-medium' },
  { task: 'chore', text: 'Rename a function across code, tests and README', from: 'chore-opus-xhigh', to: 'chore-sonnet-low' },
  { task: 'debug', text: 'Fix a planted bug with a failing test', from: 'debug-opus-high', to: 'debug-sonnet-medium' },
  { task: 'review', text: 'Review a six-file diff with five planted defects', from: 'review-opus-high', to: 'review-opus-low' },
];
// The skill-cost label suffixes measured from each session setting, cheapest setting first. The bare version label
// carries the idle session that the other two borrow, since it depends only on the skill's name and description.
const ROUTE_SUFFIXES = ['-sonnet-medium', '-opus-high', ''];

export class DataError extends Error {}
const need = (ok, msg) => { if (!ok) throw new DataError(msg); };

// "claude-opus-5" is Opus 5; "claude-haiku-4-5-20251001" is Haiku 4.5.
export function modelName(id) {
  const parts = id.replace(/^claude-/, '').split('-').filter((p) => !/^\d{8}$/.test(p));
  return `${parts[0][0].toUpperCase()}${parts[0].slice(1)} ${parts.slice(1).join('.')}`;
}
export const setting = (id, effort) => (effort ? `${modelName(id)}, ${effort}` : modelName(id));

// The Cells table in bench/RESULTS.md: `| cell | n | passed/total | ...`.
export function parseCells(markdown) {
  const cells = new Map();
  for (const line of markdown.split(/\r?\n/)) {
    const m = line.match(/^\| ([a-z0-9-]+) \| (\d+) \| (\d+)\/(\d+) \|/);
    if (m) cells.set(m[1], { n: Number(m[2]), passed: Number(m[3]) === Number(m[2]) && Number(m[4]) === Number(m[2]) });
  }
  return cells;
}

// The coloured bands on one row, cut to the axis so a breakeven off the chart cannot draw a negative width.
export function bands(even, double, lo, hi) {
  return [
    { from: lo, to: even, kind: 'loss' },
    { from: even, to: double, kind: 'small' },
    { from: double, to: hi, kind: 'gain' },
  ].map((b) => ({ ...b, from: Math.max(b.from, lo), to: Math.min(b.to, hi) })).filter((b) => b.to > b.from);
}

// Whole decades around every value, so each one lands on the axis.
export function logAxis(values) {
  const lo = Math.floor(Math.log10(Math.min(...values)));
  const hi = Math.ceil(Math.log10(Math.max(...values)));
  return { lo, hi: hi > lo ? hi : lo + 1 };
}

// A linear axis from zero with at most five steps, clear of the largest value.
export function linearAxis(max) {
  const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10].find((s) => Math.ceil((max * 1.1) / s) <= 5) ?? 10 ** Math.ceil(Math.log10(max));
  const top = Math.ceil((max * 1.1) / step) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

export const usd = (n) => `$${n.toFixed(2)}`;
export const tickUsd = (t) => (t >= 1 ? `$${t}` : `$${t.toFixed(Math.max(2, -Math.floor(Math.log10(t))))}`);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const day = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const count = (n) => WORDS[n] ?? String(n);

// ---- data --------------------------------------------------------------------------------------------

export function load() {
  const results = parseCells(fs.readFileSync(path.join(HERE, 'RESULTS.md'), 'utf8'));
  const byCell = new Map();
  for (const r of loadRuns(path.join(HERE, 'results', 'runs.jsonl'))) {
    const id = cellOf(r.id);
    if (!byCell.has(id)) byCell.set(id, []);
    byCell.get(id).push(r);
  }

  const cell = (id) => {
    const rs = byCell.get(id);
    const models = [...new Set(rs.flatMap((r) => Object.keys(r.metrics.models).filter((m) => m.includes(r.model))))];
    need(models.length === 1, `${id}: runs used ${models.join(', ') || 'no model'} for ${rs[0].model}`);
    return { id, model: models[0], effort: rs[0].effort, label: setting(models[0], rs[0].effort), n: rs.length, cost: median(rs.map((r) => r.metrics.usd)), runs: rs };
  };

  const ladders = PAIRS.map((p) => {
    for (const id of [p.from, p.to]) {
      need(byCell.has(id), `no runs for ${id}`);
      need(results.get(id)?.passed === true, `${id}: bench/RESULTS.md does not show every run passing, and ${p.task} compares it`);
    }
    const cells = [...byCell.keys()].filter((k) => k.startsWith(`${p.task}-`) && results.get(k)?.passed === true).map(cell).sort((a, b) => a.cost - b.cost);
    const fromCell = cells.find((c) => c.id === p.from);
    const toCell = cells.find((c) => c.id === p.to);
    return { ...p, cells, fromCell, toCell, share: 1 - toCell.cost / fromCell.cost };
  });
  const share = median(ladders.map((l) => l.share));
  need(Number.isFinite(share) && share > 0, `the recommended settings saved a median ${Math.round(share * 100)}%, so no task size pays for a route`);

  const version = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  const hash = skillHash(fs.readFileSync(path.join(ROOT, 'skills', 'route', 'SKILL.md'), 'utf8'));
  const routes = ROUTE_SUFFIXES.map((suffix) => {
    const label = `${version}${suffix}`;
    const f = figures(`${label}@${version}`);
    const inv = f.sessions.invoked;
    need(inv?.complete && !inv.from, `${label}: no complete invoked session of its own. Measure it (CONTRIBUTING.md).`);
    need(inv.meta.skill === hash, `${label} ran against SKILL.md ${inv.meta.skill}; this checkout's is ${hash}. Re-measure (CONTRIBUTING.md).`);
    need(f.carriedFirst != null, `${label}: no idle session in ${version} to measure the context a route leaves behind`);
    const lines = fs.readFileSync(path.join(HERE, 'results', 'skill-cost', label, 'invoked.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const result = lines.filter((o) => o.type === 'result').at(-1);
    const model = Object.keys(result?.modelUsage ?? {}).find((m) => m.includes(inv.meta.model));
    need(model, `${label}: no ${inv.meta.model} model in the session's usage`);
    const cost = f.routeWarm.turnCost;
    return { label, name: setting(model, inv.meta.effort), model, effort: inv.meta.effort, recorded: inv.meta.recorded.slice(0, 10), version: lines.find((o) => o.subtype === 'init')?.claude_code_version, cost, carried: f.carriedFirst, even: cost / share, double: (2 * cost) / share };
  });
  return { ladders, share, routes, hash, version };
}

// ---- the figure --------------------------------------------------------------------------------------

const C = { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7', blue: '#2a78d6', red: '#e34948', neutral: '#f0efec', from: '#898781', other: '#c3c2b7' };
const FILL = { loss: [C.red, 0.18], small: [C.neutral, 1], gain: [C.blue, 0.16] };
const FONT = 'system-ui, -apple-system, &quot;Segoe UI&quot;, sans-serif';
const W = 960;
const X0 = 40;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f2 = (n) => n.toFixed(2);

export function render({ ladders, share, routes, hash }) {
  const out = [];
  const text = (x, y, s, { size = 13, fill = C.ink2, weight = 400, anchor = 'start' } = {}) =>
    out.push(`<text x="${f2(x)}" y="${f2(y)}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${esc(s)}</text>`);
  // A bar grows right from its baseline, square there and rounded 4px at the data end.
  const bar = (x, y, w, h, fill, title) => {
    const r = Math.min(4, w / 2, h / 2);
    out.push(`<path d="M${f2(x)} ${f2(y)}H${f2(x + w - r)}Q${f2(x + w)} ${f2(y)} ${f2(x + w)} ${f2(y + r)}V${f2(y + h - r)}Q${f2(x + w)} ${f2(y + h)} ${f2(x + w - r)} ${f2(y + h)}H${f2(x)}Z" fill="${fill}"><title>${esc(title)}</title></path>`);
  };
  const dot = (x, y, fill, title) => out.push(`<circle cx="${f2(x)}" cy="${f2(y)}" r="5" fill="${fill}" stroke="${C.surface}" stroke-width="2"><title>${esc(title)}</title></circle>`);
  const swatch = (x, y, fill, opacity = 1, stroke = false) =>
    out.push(`<rect x="${f2(x)}" y="${f2(y - 10)}" width="12" height="12" rx="2" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}${stroke ? ` stroke="${C.axis}" stroke-width="1"` : ''}/>`);

  let y = 44;
  text(X0, y, 'When is a route worth asking for?', { size: 26, fill: C.ink, weight: 600 });
  y += 26;
  text(X0, y, 'A tokenwise route recommends a model and effort level for a piece of work. The answer has a cost of its own,', { size: 14 });
  y += 20;
  text(X0, y, 'so it pays only on work big enough for the cheaper setting to save more than that.', { size: 14 });

  // Section A: what each setting cost.
  const allCells = ladders.flatMap((l) => l.cells);
  y += 50;
  text(X0, y, 'What each setting cost, task by task', { size: 18, fill: C.ink, weight: 600 });
  y += 22;
  text(X0, y, `Median list-price cost per run, ${Math.min(...allCells.map((c) => c.n))} to ${Math.max(...allCells.map((c) => c.n))} runs per setting. Every run shown passed its grader.`, { size: 13 });
  y += 22;
  swatch(X0, y, C.blue); text(X0 + 18, y, 'the setting a route recommends', { size: 13 });
  swatch(X0 + 230, y, C.from); text(X0 + 248, y, 'the setting it moves you from', { size: 13 });
  swatch(X0 + 450, y, C.other); text(X0 + 468, y, 'other settings measured', { size: 13 });

  const maxCost = Math.max(...allCells.map((c) => c.cost));
  const COL = [X0, 500];
  const LABEL = 128;
  const BARW = 230;
  const ROW = 22;
  // Tasks fill two columns, each going to whichever is shorter so far.
  const columns = [[], []];
  const rows = [0, 0];
  for (const l of ladders) {
    const ci = rows[0] <= rows[1] ? 0 : 1;
    columns[ci].push(l);
    rows[ci] += l.cells.length + 2;
  }
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
  text(X0, y, 'A route in a session already under way, one run per setting. It runs on the session’s own model and effort.', { size: 13 });
  const BX = X0 + 150;
  const BW = 420;
  const baxis = linearAxis(Math.max(...routes.map((r) => r.cost)));
  const bx = (v) => BX + (v / baxis.top) * BW;
  y += 30;
  const brows = routes.map((_, i) => y + 16 + i * 30);
  const bbase = brows.at(-1) + 22;
  for (const t of baxis.ticks) {
    out.push(`<line x1="${f2(bx(t))}" y1="${f2(brows[0] - 12)}" x2="${f2(bx(t))}" y2="${f2(bbase - 8)}" stroke="${C.grid}" stroke-width="1"/>`);
    text(bx(t), bbase + 6, usd(t), { size: 12, fill: C.muted, anchor: 'middle' });
  }
  text(BX + BW + 40, y, 'Answer left in context', { size: 12, fill: C.muted });
  routes.forEach((r, i) => {
    const ry = brows[i];
    text(BX - 10, ry + 4, r.name, { size: 13, anchor: 'end' });
    out.push(`<line x1="${f2(bx(0))}" y1="${f2(ry)}" x2="${f2(bx(r.cost))}" y2="${f2(ry)}" stroke="${C.axis}" stroke-width="2"/>`);
    dot(bx(r.cost), ry, C.blue, `${r.name}: ${usd(r.cost)} (${r.label})`);
    text(bx(r.cost) + 12, ry + 4, usd(r.cost), { size: 13, fill: C.ink });
    text(BX + BW + 40, ry + 4, `${r.carried} tokens`, { size: 13, fill: C.ink });
  });

  // Section C: where it pays.
  y = bbase + 56;
  text(X0, y, 'Where a route pays for itself', { size: 18, fill: C.ink, weight: 600 });
  y += 22;
  text(X0, y, `By what the task would cost on the setting you are on. The recommended setting saved a median ${Math.round(share * 100)}% on the ${count(ladders.length)} tasks above. The bands assume`, { size: 13 });
  y += 18;
  text(X0, y, 'the same share at any size. Each dot is one of those tasks, on its starting setting.', { size: 13 });

  const SX = X0 + 150;
  const SW = 700;
  const { lo: LMIN, hi: LMAX } = logAxis([...routes.flatMap((r) => [r.cost, r.even, r.double]), ...ladders.map((l) => l.fromCell.cost)]);
  const sx = (v) => SX + ((Math.log10(v) - LMIN) / (LMAX - LMIN)) * SW;
  const onAxis = (v) => v >= 10 ** LMIN && v <= 10 ** LMAX;
  const STRIP = 28;
  const srows = routes.map((_, i) => y + 44 + i * 80);
  const ticks = [];
  for (let d = LMIN; d <= LMAX; d++) for (const m of d < LMAX ? [1, 3] : [1]) ticks.push(m * 10 ** d);
  for (const t of ticks) {
    out.push(`<line x1="${f2(sx(t))}" y1="${f2(srows[0] - 30)}" x2="${f2(sx(t))}" y2="${f2(srows.at(-1) + STRIP + 26)}" stroke="${C.grid}" stroke-width="1"/>`);
    text(sx(t), srows.at(-1) + STRIP + 42, tickUsd(Number(t.toPrecision(1))), { size: 12, fill: C.muted, anchor: 'middle' });
  }
  const bandTitle = (r, b) => ({
    loss: `costs more than it saves below ${usd(r.even)}`,
    small: `saves one to two times its cost between ${usd(r.even)} and ${usd(r.double)}`,
    gain: `saves more than twice its cost above ${usd(r.double)}`,
  })[b.kind];
  routes.forEach((r, i) => {
    const ry = srows[i];
    text(SX - 10, ry + STRIP / 2 + 5, r.name, { size: 13, anchor: 'end' });
    const bs = bands(r.even, r.double, 10 ** LMIN, 10 ** LMAX);
    bs.forEach((b, bi) => {
      const x1 = sx(b.from) + (bi ? 1 : 0);
      const x2 = sx(b.to) - (bi < bs.length - 1 ? 1 : 0);
      const [fill, op] = FILL[b.kind];
      out.push(`<rect x="${f2(x1)}" y="${f2(ry)}" width="${f2(x2 - x1)}" height="${STRIP}" rx="${b.kind === 'small' ? 0 : 4}" fill="${fill}" fill-opacity="${op}"><title>${esc(`${r.name}: ${bandTitle(r, b)}`)}</title></rect>`);
    });
    for (const v of [r.even, r.double]) if (onAxis(v)) text(sx(v), ry + STRIP + 16, usd(v), { size: 12, fill: C.ink, anchor: 'middle' });
    // Labels over dots closer than a label's width alternate between two heights.
    let lastX = -Infinity;
    let raised = false;
    for (const l of ladders.filter((x) => x.fromCell.model === r.model && x.fromCell.effort === r.effort).sort((a, b) => a.fromCell.cost - b.fromCell.cost)) {
      const dx = sx(l.fromCell.cost);
      raised = dx - lastX < 90 ? !raised : false;
      lastX = dx;
      dot(dx, ry + STRIP / 2, C.ink, `${l.task} on ${r.name}: ${usd(l.fromCell.cost)}; the recommended setting saved ${usd(l.fromCell.cost - l.toCell.cost)} and the route cost ${usd(r.cost)}`);
      text(dx, ry - (raised ? 20 : 6), `${l.task} ${usd(l.fromCell.cost)}`, { size: 12, fill: C.ink, anchor: 'middle' });
    }
  });

  text(SX + SW / 2, srows.at(-1) + STRIP + 62, 'What the task would cost on the setting you are on (log scale)', { size: 12, fill: C.muted, anchor: 'middle' });
  y = srows.at(-1) + STRIP + 96;
  swatch(SX, y, C.red, 0.18); text(SX + 18, y, 'costs more than it saves', { size: 13 });
  swatch(SX + 210, y, C.neutral, 1, true); text(SX + 228, y, 'small gain: saves one to two times its cost', { size: 13 });
  swatch(SX + 500, y, C.blue, 0.16); text(SX + 518, y, 'saves more than twice its cost', { size: 13 });
  y += 24;
  text(SX, y, 'Already on the setting a route recommends? Then the route saves nothing, at any task size.', { size: 13 });

  // Footer: where the figures came from.
  const taskRuns = allCells.flatMap((c) => c.runs);
  const taskVersions = [...new Set(taskRuns.map((r) => r.claude_version.replace(/ \(Claude Code\)$/, '')))].join(', ');
  const taskDays = [...new Set(taskRuns.map((r) => day(r.started)))].join(', ');
  const routeVersions = [...new Set(routes.map((r) => r.version))].join(', ');
  const routeDays = [...new Set(routes.map((r) => day(r.recorded)))].join(', ');
  y += 44;
  out.push(`<line x1="${X0}" y1="${f2(y - 22)}" x2="${W - X0}" y2="${f2(y - 22)}" stroke="${C.grid}" stroke-width="1"/>`);
  text(X0, y, `Tasks: Claude Code ${taskVersions}, run ${taskDays}. Routes: tokenwise SKILL.md ${hash}, Claude Code ${routeVersions}, run ${routeDays}.`, { size: 12, fill: C.muted });
  y += 18;
  text(X0, y, 'Dollars are Claude Code’s list-price figures; on a subscription they are a weighting for comparing settings. The bench’s tasks are small.', { size: 12, fill: C.muted });
  y += 18;
  text(X0, y, 'Reproduce with node bench/breakeven.mjs at github.com/ces0491/tokenwise.', { size: 12, fill: C.muted });
  const H = Math.ceil(y + 28);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}" role="img" aria-labelledby="t d">
<title id="t">When is a route worth asking for?</title>
<desc id="d">What each model and effort setting cost on ${count(ladders.length)} bench tasks, what a tokenwise route costs from ${count(routes.length)} session settings, and the task sizes at which a route costs more than it saves, saves one to two times its cost, or saves more than twice its cost.</desc>
<rect width="${W}" height="${H}" fill="${C.surface}"/>
${out.join('\n')}
</svg>
`;
}

// ---- tables: every figure drawn ----------------------------------------------------------------------

export function tables({ ladders, share, routes }) {
  return [
    '| task | setting | runs | median cost |',
    '| --- | --- | --- | --- |',
    ...ladders.flatMap((l) => l.cells.map((c) => `| ${l.task} | ${c.label}${c.id === l.to ? ' (recommended)' : c.id === l.from ? ' (moved from)' : ''} | ${c.n} | ${usd(c.cost)} |`)),
    '',
    '| task | moved from | recommended | saved | share saved |',
    '| --- | --- | --- | --- | --- |',
    ...ladders.map((l) => `| ${l.task} | ${usd(l.fromCell.cost)} | ${usd(l.toCell.cost)} | ${usd(l.fromCell.cost - l.toCell.cost)} | ${Math.round(l.share * 100)}% |`),
    `| median | | | | ${Math.round(share * 100)}% |`,
    '',
    '| asking from | route cost | answer left in context (tokens) | costs more than it saves below | saves less than twice its cost below |',
    '| --- | --- | --- | --- | --- |',
    ...routes.map((r) => `| ${r.name} | ${usd(r.cost)} | ${r.carried} | ${usd(r.even)} | ${usd(r.double)} |`),
  ].join('\n');
}

// What a warm route cost from each measured setting, for the resume guard's threshold (hooks/resume-guard.mjs). Written
// beside the chart from the same data, so the threshold moves when the routes are re-measured.
export const ROUTE_COSTS = path.join(ROOT, 'hooks', 'route-costs.json');
export function routeCosts({ routes, hash, version }) {
  const doc = {
    note: 'Generated by bench/breakeven.mjs from bench/results/skill-cost: what a route cost in a session already under way, from each measured setting. The resume guard warns only when resuming would cost more than a route from the session\'s model.',
    version,
    skill: hash,
    routes: routes.map((r) => ({ model: r.model.replace(/\[1m\]$/, ''), effort: r.effort, usd: Number(r.cost.toFixed(4)) })),
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

// ---- command line ------------------------------------------------------------------------------------

if (import.meta.main ?? (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))) {
  let data;
  try {
    data = load();
  } catch (e) {
    if (!(e instanceof DataError)) throw e;
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
  const outputs = [[OUT, render(data)], [ROUTE_COSTS, routeCosts(data)]];
  const committed = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '');
  const stale = outputs.filter(([file, text]) => committed(file) !== text);
  const rel = (file) => path.relative(ROOT, file).replace(/\\/g, '/');
  if (process.argv.includes('--check')) {
    if (stale.length) { process.stderr.write(`${stale.map(([f]) => rel(f)).join(' and ')} do not follow from the committed data. Run node bench/breakeven.mjs and commit the result.\n`); process.exit(1); }
    process.stdout.write(`${outputs.map(([f]) => rel(f)).join(' and ')} follow from the committed data.\n`);
  } else {
    // An unchanged file is left alone, so a checkout with CRLF line endings does not show it modified.
    for (const [file, text] of stale) fs.writeFileSync(file, text);
    process.stdout.write(`${tables(data)}\n\n${stale.length ? `Wrote ${stale.map(([f]) => rel(f)).join(' and ')}.` : 'docs/breakeven.svg and hooks/route-costs.json are already up to date.'}\n`);
  }
}
