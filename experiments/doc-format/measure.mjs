#!/usr/bin/env node
// How many tokens of context a document adds when Claude Code reads it, by format.
//
//   node experiments/doc-format/measure.mjs --documents experiments/doc-format/documents.json --out results/<name>.json
//   node experiments/doc-format/measure.mjs <file> [<file> ...] [--out results/<name>.json]
//   node experiments/doc-format/measure.mjs --report experiments/doc-format/results/<name>.json    # free: reads a saved run
//
// Options: --convert (default with --documents) also measures a text copy of each file: HTML to Markdown with pandoc (raw HTML dropped),
// PDF to text with pdftotext -layout. --model (default sonnet), --effort (default low), --dry prints the sessions.
//
// Runs one `claude -p` session with no document, then one per file. Each session is offered only the Read tool, so no
// permissions are bypassed, and is asked to read the whole file (a long PDF in page ranges) and reply OK. The tokens a
// file adds are the context of the session's last API call less its first: the file as Claude Code delivered it, plus
// the Read tool calls, a few dozen tokens each. Sessions run on your Claude account and draw on its usage.
//
// --documents downloads each URL into a temporary directory and records its SHA-256, so a re-run can tell whether it
// measured the same bytes. The documents themselves are not stored. Tested by measure.test.mjs.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const TIMEOUT_MS = 10 * 60_000;
const BUDGET_USD = 2;

// ---- reading a session ------------------------------------------------------------------------------

// One API call spans several stream lines that share a message id; its context is set when the call starts. Calls made
// inside a subagent are skipped, though with only the Read tool offered there are none.
export function parseSession(stdout) {
  const events = String(stdout).split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const seen = new Set();
  const calls = [];
  const reads = [];
  const byId = new Map();
  for (const e of events) {
    // What each Read returned: the kinds of content block, the characters of text, and whether it was an error. A PDF's
    // pages arriving as images show here as image blocks. Coverage of a long text file shows in the offsets Claude asked for.
    if (e.type === 'user' && Array.isArray(e.message?.content)) {
      for (const c of e.message.content) {
        const r = c.type === 'tool_result' ? byId.get(c.tool_use_id) : null;
        if (!r) continue;
        const blocks = typeof c.content === 'string' ? [{ type: 'text', text: c.content }] : (c.content || []);
        const text = blocks.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
        r.returned = { blocks: [...new Set(blocks.map((b) => b.type))], textChars: text.length, error: !!c.is_error };
      }
    }
    if (e.type !== 'assistant' || !e.message || e.parent_tool_use_id) continue;
    for (const c of e.message.content || []) {
      if (c.type !== 'tool_use' || c.name !== 'Read') continue;
      const { pages, offset, limit } = c.input || {};
      const r = { pages: pages ?? null, offset: offset ?? null, limit: limit ?? null, returned: null };
      reads.push(r);
      byId.set(c.id, r);
    }
    if (seen.has(e.message.id)) continue;
    seen.add(e.message.id);
    const u = e.message.usage || {};
    calls.push((u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0));
  }
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init');
  const result = events.findLast((e) => e.type === 'result') ?? null;
  return {
    calls, reads,
    model: init?.model ?? null, claudeCode: init?.claude_code_version ?? null,
    cost: result?.total_cost_usd ?? null, isError: result ? !!result.is_error : true, answer: result?.result ?? '',
  };
}

// What a document adds, and whether the session looks like a complete read.
export function summarise(s) {
  const added = s.calls.length >= 2 ? s.calls.at(-1) - s.calls[0] : null;
  const notes = [];
  if (s.isError) notes.push('ended in an error');
  if (!/^\s*ok\W*\s*$/i.test(s.answer)) notes.push('reply was not just OK: check it read everything');
  if (!s.reads.length) notes.push('no Read call');
  return { added, notes };
}

// ---- report -----------------------------------------------------------------------------------------

const K = (n) => (n == null ? '?' : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const usd = (n) => (n == null ? '?' : `$${n.toFixed(3)}`);

// The content kinds the Read calls returned, and how many were errors.
export function returnedText(reads) {
  const got = reads.map((r) => r.returned).filter(Boolean);
  const kinds = [...new Set(got.flatMap((g) => g.blocks))].join(' and ') || '?';
  const errors = got.filter((g) => g.error).length;
  return [kinds, errors ? `${errors} error${errors > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ');
}

export function report(run) {
  const base = run.baseline;
  const lines = [
    `Recorded ${run.recorded.slice(0, 10)} on ${base.model ?? '?'} at ${run.effort} effort, Claude Code ${base.claudeCode ?? '?'}. One session per row.`,
    '',
    '| document | format | size | Read calls | Read returned | tokens added | session cost | note |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of run.rows) {
    const { added, notes } = summarise(r.session);
    lines.push(`| ${r.document} | ${r.format} | ${K(r.bytes)}B | ${r.session.reads.length} | ${returnedText(r.session.reads)} | ${K(added)} | ${usd(r.session.cost)} | ${notes.join('; ') || '-'} |`);
  }
  const total = [base, ...run.rows.map((r) => r.session)].reduce((t, s) => t + (s.cost || 0), 0);
  lines.push('', `Baseline session with no document: ${K(base.calls[0])} tokens of context on its first call. All ${run.rows.length + 1} sessions: ${usd(total)} at list price.`);
  for (const r of run.rows.filter((x) => x.sha256)) lines.push(`- ${r.document} ${r.format}: ${r.source}, sha256 ${r.sha256}`);
  return lines.join('\n');
}

// ---- running ----------------------------------------------------------------------------------------

function session(prompt, cwd, { model, effort, dry }) {
  const args = ['-p', '--model', model, '--effort', effort, '--output-format', 'stream-json', '--verbose',
    '--setting-sources', 'project', '--strict-mcp-config', '--tools', 'Read', '--allowedTools', 'Read', '--max-budget-usd', String(BUDGET_USD)];
  if (dry) { process.stdout.write(`  ${CLAUDE} ${args.join(' ')}\n`); return Promise.resolve(parseSession('')); }
  return new Promise((resolve) => {
    const child = spawn(CLAUDE, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', () => {});
    child.on('close', () => { clearTimeout(timer); resolve(parseSession(stdout)); });
    child.stdin.end(prompt);
  });
}

function convert(file, format, dir) {
  const run = (cmd, args, out) => {
    const r = spawnSync(cmd, args, { encoding: 'utf8' });
    if (r.error) return { note: `${cmd} not found on PATH` };
    if (r.status !== 0) return { note: `${cmd} failed: ${(r.stderr || '').trim().split('\n').pop()}` };
    return { file: out };
  };
  const base = path.join(dir, path.basename(file, path.extname(file)));
  if (format === 'html') return { format: 'html as Markdown (pandoc)', ...run('pandoc', [file, '-f', 'html', '-t', 'gfm-raw_html', '-o', `${base}.from-html.md`], `${base}.from-html.md`) };
  if (format === 'pdf') return { format: 'pdf as text (pdftotext)', ...run('pdftotext', ['-layout', file, `${base}.from-pdf.txt`], `${base}.from-pdf.txt`) };
  return null;
}

async function download(url, file) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const formatOf = (file) => ({ '.pdf': 'pdf', '.html': 'html', '.htm': 'html', '.md': 'markdown', '.txt': 'text' }[path.extname(file).toLowerCase()] ?? path.extname(file).slice(1));

async function main(argv) {
  const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  const flag = (name) => argv.includes(`--${name}`);
  const valued = new Set(['--model', '--effort', '--documents', '--out', '--report']);
  if (opt('report')) { process.stdout.write(`${report(JSON.parse(fs.readFileSync(opt('report'), 'utf8')))}\n`); return; }

  const settings = { model: opt('model') ?? 'sonnet', effort: opt('effort') ?? 'low', dry: flag('dry') };
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-format-'));
  try {
    const targets = [];
    if (opt('documents')) {
      const spec = JSON.parse(fs.readFileSync(opt('documents'), 'utf8'));
      for (const d of spec.documents) {
        for (const [format, url] of Object.entries(d.formats)) {
          const file = path.join(work, `${d.id}.${format}`);
          process.stdout.write(`download ${url}\n`);
          await download(url, file);
          targets.push({ document: d.id, format, source: url, file });
        }
      }
    } else {
      const files = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]));
      if (!files.length) throw new Error('give files, --documents <json> or --report <json>');
      for (const f of files) targets.push({ document: path.basename(f, path.extname(f)), format: formatOf(f), source: path.basename(f), file: path.resolve(f) });
    }
    if (opt('documents') || flag('convert')) {
      for (const t of [...targets]) {
        const c = convert(t.file, t.format, work);
        if (c?.file) targets.push({ document: t.document, format: c.format, source: `${t.source}, converted`, file: c.file });
        else if (c?.note) process.stdout.write(`${t.document} ${t.format}: ${c.note}, conversion skipped\n`);
      }
    }

    process.stdout.write(`${targets.length + 1} sessions on ${settings.model} at ${settings.effort}\n`);
    const empty = path.join(work, 'baseline');
    fs.mkdirSync(empty);
    const baseline = await session('Reply with OK only.', empty, settings);
    const rows = [];
    for (const [i, t] of targets.entries()) {
      const dir = path.join(work, `session-${i}`);
      fs.mkdirSync(dir);
      const name = path.basename(t.file);
      fs.copyFileSync(t.file, path.join(dir, name));
      process.stdout.write(`${t.document} ${t.format}\n`);
      const prompt = `Read the file ${name} in full with the Read tool. If it is a PDF of more than 10 pages, read it in page ranges until every page has been read. If Read returns a partial view, keep reading with offset and limit until every line has been read. Do not summarise it. When you have read all of it, reply with OK only.`;
      const s = await session(prompt, dir, settings);
      rows.push({ document: t.document, format: t.format, source: t.source, bytes: fs.statSync(t.file).size, sha256: sha256(t.file), session: s });
    }
    if (settings.dry) return;
    const run = { recorded: new Date().toISOString(), effort: settings.effort, baseline, rows };
    if (opt('out')) {
      fs.mkdirSync(path.dirname(path.resolve(opt('out'))), { recursive: true });
      fs.writeFileSync(opt('out'), `${JSON.stringify(run, null, 1)}\n`);
    }
    process.stdout.write(`\n${report(run)}\n`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main ?? (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`${e.message}\n`); process.exit(1); });
}
