#!/usr/bin/env node
// How many tokens of context a document adds when Claude Code reads it, by format.
//
//   node experiments/doc-format/measure.mjs --documents experiments/doc-format/documents.json --out results/<name>.json
//   node experiments/doc-format/measure.mjs <file | https link> [...] [--out results/<name>.json]
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
// A link is read by a session offered only WebFetch. A claude.ai artifact link is also read by one offered the Artifact
// and Read tools. Each tool set gets its own session with no document, since the tools add context of their own. An
// artifact's link is not saved, only the version the Artifact tool reports, and an artifact id in an answer or a tool
// call is masked, so a private artifact's address stays out of the saved run; any other link is saved as given.
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
// inside a subagent are skipped, though with the tools offered here there are none.
const TOOLS = ['Read', 'Artifact', 'WebFetch', 'Grep', 'Glob', 'Bash'];

export function parseSession(stdout) {
  const events = String(stdout).split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const seen = new Set();
  const calls = [];
  const reads = [];
  const byId = new Map();
  for (const e of events) {
    // What each tool call returned: the kinds of content block, the characters of text, and whether it was an error. A
    // PDF's pages arriving as images show here as image blocks. Coverage of a long text file shows in the offsets Claude
    // asked for. An Artifact read also names the artifact version it returned.
    if (e.type === 'user' && Array.isArray(e.message?.content)) {
      for (const c of e.message.content) {
        const r = c.type === 'tool_result' ? byId.get(c.tool_use_id) : null;
        if (!r) continue;
        const blocks = typeof c.content === 'string' ? [{ type: 'text', text: c.content }] : (c.content || []);
        const text = blocks.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
        r.returned = { blocks: [...new Set(blocks.map((b) => b.type))], textChars: text.length, error: !!c.is_error };
        const version = r.tool === 'Artifact' ? /\(version ([\w-]+)\)/.exec(text)?.[1] : null;
        if (version) r.returned.version = version;
      }
    }
    if (e.type !== 'assistant' || !e.message || e.parent_tool_use_id) continue;
    for (const c of e.message.content || []) {
      if (c.type !== 'tool_use' || !TOOLS.includes(c.name)) continue;
      const { pages, offset, limit, action } = c.input || {};
      const r = { tool: c.name, pages: pages ?? null, offset: offset ?? null, limit: limit ?? null, returned: null };
      if (action) r.action = action;
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
  const lastLine = s.answer.trim().split('\n').filter((l) => l.trim()).pop() ?? '';
  if (!/^\s*ok\W*\s*$/i.test(lastLine)) notes.push('reply did not end with OK: check it read everything');
  if (!s.reads.length) notes.push('no tool call');
  return { added, notes };
}

// ---- report -----------------------------------------------------------------------------------------

const K = (n) => (n == null ? '?' : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const usd = (n) => (n == null ? '?' : `$${n.toFixed(3)}`);

// Tool calls by tool, in the order first used: "1 Artifact, 2 Read". Runs saved before other tools were offered
// recorded only Read calls, with no tool field.
export function callsText(reads) {
  const counts = new Map();
  for (const r of reads) counts.set(r.tool ?? 'Read', (counts.get(r.tool ?? 'Read') ?? 0) + 1);
  if (!counts.size) return '0';
  if (counts.size === 1 && counts.has('Read')) return String(counts.get('Read'));
  return [...counts].map(([tool, n]) => `${n} ${tool}`).join(', ');
}

// The content kinds the tool calls returned, and how many were errors.
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
    '| document | format | size | tool calls | returned | tokens added | session cost | note |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of run.rows) {
    const { added, notes } = summarise(r.session);
    const size = r.bytes == null ? '-' : `${K(r.bytes)}B`;
    lines.push(`| ${r.document} | ${r.format} | ${size} | ${callsText(r.session.reads)} | ${returnedText(r.session.reads)} | ${K(added)} | ${usd(r.session.cost)} | ${notes.join('; ') || '-'} |`);
  }
  // Runs with an artifact link carry a session with no document for each extra tool set.
  const extra = Object.entries(run.baselines ?? {});
  const total = [base, ...extra.map(([, s]) => s), ...run.rows.map((r) => r.session)].reduce((t, s) => t + (s.cost || 0), 0);
  const sessions = run.rows.length + 1 + extra.length;
  if (!extra.length) {
    lines.push('', `Baseline session with no document: ${K(base.calls[0])} tokens of context on its first call. All ${sessions} sessions: ${usd(total)} at list price.`);
  } else {
    lines.push('', `Baseline sessions with no document, tokens of context on the first call: ${K(base.calls[0])} offered Read, ${extra.map(([tools, s]) => `${K(s.calls[0])} offered ${tools.split(',').join(' and ')}`).join(', ')}. All ${sessions} sessions: ${usd(total)} at list price.`);
  }
  for (const r of run.rows.filter((x) => x.sha256)) lines.push(`- ${r.document} ${r.format}: ${r.source}, sha256 ${r.sha256}`);
  for (const r of run.rows) {
    const version = r.session.reads.map((x) => x.returned?.version).find(Boolean);
    if (version) lines.push(`- ${r.document} ${r.format}: ${r.source}, version ${version}`);
  }
  return lines.join('\n');
}

// ---- running ----------------------------------------------------------------------------------------

// Offering Bash allows only these commands, all of which read without writing.
export const READ_ONLY_BASH = ['Bash(grep:*)', 'Bash(head:*)', 'Bash(tail:*)', 'Bash(wc:*)', 'Bash(cut:*)'];
export const allowedFor = (tools) => tools.flatMap((t) => (t === 'Bash' ? READ_ONLY_BASH : [t]));

export function session(prompt, cwd, { model, effort, dry }, tools = ['Read']) {
  const args = ['-p', '--model', model, '--effort', effort, '--output-format', 'stream-json', '--verbose',
    '--setting-sources', 'project', '--strict-mcp-config', '--tools', tools.join(','), '--allowedTools', allowedFor(tools).join(','), '--max-budget-usd', String(BUDGET_USD)];
  if (dry) { process.stdout.write(`  ${CLAUDE} ${args.join(' ')}\n`); return Promise.resolve(parseSession('')); }
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    // A CLAUDE_BIN that cannot be started rejects, so the temporary directory is still removed.
    child.on('error', (e) => { clearTimeout(timer); reject(new Error(`could not start ${CLAUDE}: ${e.message}`)); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ ...parseSession(stdout), exit: code, stderr: stderr.trim().split('\n').slice(-3).join('\n') }); });
    child.stdin.end(prompt);
  });
}

// Converted files are named after their position in the target list, so two inputs with the same basename cannot
// overwrite each other's conversion.
function convert(file, format, dir, index) {
  const run = (cmd, args, out) => {
    const r = spawnSync(cmd, args, { encoding: 'utf8' });
    if (r.error) return { note: `${cmd} not found on PATH` };
    if (r.status !== 0) return { note: `${cmd} failed: ${(r.stderr || '').trim().split('\n').pop()}` };
    return { file: out };
  };
  const base = path.join(dir, `${index}-${path.basename(file, path.extname(file))}`);
  if (format === 'html') return { format: 'html as Markdown (pandoc)', ...run('pandoc', [file, '-f', 'html', '-t', 'gfm-raw_html', '-o', `${base}.from-html.md`], `${base}.from-html.md`) };
  if (format === 'pdf') return { format: 'pdf as text (pdftotext)', ...run('pdftotext', ['-layout', file, `${base}.from-pdf.txt`], `${base}.from-pdf.txt`) };
  return null;
}

async function download(url, file) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

export const isArtifactLink = (arg) => /^https:\/\/claude\.ai\/artifact\/[\w-]+\/?$/.test(arg);
export const isLink = (arg) => /^https:\/\/\S+$/.test(arg);

// An answer or a tool call can still carry an artifact's address, so every id in the saved text is replaced.
export const maskArtifactIds = (text) => text.replace(/(claude\.ai\/(?:code\/)?artifact\/)[\w-]+/g, '$1<id>');

// The ways a session holding a link can read it: an artifact link with the Artifact tool or WebFetch, any other page
// with WebFetch.
const WEBFETCH = { format: 'link, WebFetch', tools: ['WebFetch'] };
const LINK_READS = [{ format: 'link, Artifact tool', tools: ['Artifact', 'Read'] }, WEBFETCH];

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const formatOf = (file) => ({ '.pdf': 'pdf', '.html': 'html', '.htm': 'html', '.md': 'markdown', '.txt': 'text' }[path.extname(file).toLowerCase()] ?? path.extname(file).slice(1));

async function main(argv) {
  const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  const flag = (name) => argv.includes(`--${name}`);
  const valued = new Set(['--model', '--effort', '--documents', '--out', '--report', '--tools']);
  const known = new Set([...valued, '--convert', '--dry']);
  // Checked before anything runs, so a mistyped option cannot turn into a file name or a silently ignored setting.
  const unknown = argv.filter((a) => a.startsWith('--') && !known.has(a));
  if (unknown.length) throw new Error(`unknown option ${unknown.join(', ')} (options take a separate value: --model opus)`);
  for (const v of valued) { const i = argv.indexOf(v); if (i >= 0 && (i + 1 >= argv.length || argv[i + 1].startsWith('--'))) throw new Error(`${v} needs a value`); }
  if (opt('report')) { process.stdout.write(`${report(JSON.parse(fs.readFileSync(opt('report'), 'utf8')))}\n`); return; }

  const settings = { model: opt('model') ?? 'sonnet', effort: opt('effort') ?? 'low', dry: flag('dry') };
  const fileTools = opt('tools') ? opt('tools').split(',').map((t) => t.trim()).filter(Boolean) : ['Read'];
  const offered = ['Read', 'Grep', 'Glob', 'Bash'];
  const bad = fileTools.filter((t) => !offered.includes(t));
  if (bad.length || !fileTools.includes('Read')) throw new Error(`--tools takes Read plus any of ${offered.slice(1).join(', ')}${bad.length ? `, not ${bad.join(', ')}` : ''}`);
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
      const args = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]));
      if (!args.length) throw new Error('give files or artifact links, --documents <json> or --report <json>');
      const missing = args.filter((a) => !isLink(a) && !fs.existsSync(a));
      if (missing.length) throw new Error(`no such file: ${missing.join(', ')}${missing.some((m) => /^http:/.test(m)) ? ' (links must be https)' : ''}`);
      let artifacts = 0;
      for (const a of args) {
        if (isArtifactLink(a)) {
          artifacts += 1;
          for (const l of LINK_READS) targets.push({ document: `artifact-${artifacts}`, format: l.format, source: 'claude.ai artifact', link: a, tools: l.tools });
        } else if (isLink(a)) {
          targets.push({ document: new URL(a).hostname, format: WEBFETCH.format, source: a, link: a, tools: WEBFETCH.tools });
        } else {
          targets.push({ document: path.basename(a, path.extname(a)), format: formatOf(a), source: path.basename(a), file: path.resolve(a) });
        }
      }
    }
    if (opt('documents') || flag('convert')) {
      for (const [i, t] of [...targets].entries()) {
        if (t.link) continue;
        const c = convert(t.file, t.format, work, i);
        if (c?.file) targets.push({ document: t.document, format: c.format, source: `${t.source}, converted`, file: c.file });
        else if (c?.note) process.stdout.write(`${t.document} ${t.format}: ${c.note}, conversion skipped\n`);
      }
    }

    const readOnly = fileTools.length === 1;
    if (!readOnly) for (const t of targets) if (!t.link) t.tools = fileTools;
    const toolSets = [...new Set(targets.filter((t) => t.tools).map((t) => t.tools.join(',')))];
    process.stdout.write(`${targets.length + 1 + toolSets.length} sessions on ${settings.model} at ${settings.effort}\n`);
    const empty = path.join(work, 'baseline');
    fs.mkdirSync(empty);
    const checked = (s, what) => {
      if (!settings.dry && !s.calls.length) throw new Error(`the ${what} session made no API call (exit ${s.exit})${s.stderr ? `: ${s.stderr}` : ''}`);
      return s;
    };
    const baseline = checked(await session('Reply with OK only.', empty, settings), 'baseline');
    const baselines = {};
    for (const set of toolSets) baselines[set] = checked(await session('Reply with OK only.', empty, settings, set.split(',')), `${set} baseline`);
    const rows = [];
    for (const [i, t] of targets.entries()) {
      const dir = path.join(work, `session-${i}`);
      fs.mkdirSync(dir);
      if (t.link) {
        process.stdout.write(`${t.document} ${t.format}\n`);
        const prompt = `Read the document at ${t.link} in full with the tools you have. If a tool returns only part of it, or saves the full content to a file, keep reading until you have read all of it. Do not summarise it. When you have read all of it, reply with OK only.`;
        rows.push({ document: t.document, format: t.format, source: t.source, bytes: null, sha256: null, session: await session(prompt, dir, settings, t.tools) });
        continue;
      }
      const name = path.basename(t.file);
      fs.copyFileSync(t.file, path.join(dir, name));
      process.stdout.write(`${t.document} ${t.format}\n`);
      const how = readOnly ? 'with the Read tool' : 'with the tools you have';
      const prompt = `Read the file ${name} in full ${how}. If it is a PDF of more than 10 pages, read it in page ranges until every page has been read. If Read returns a partial view, keep reading with offset and limit until every line has been read. Do not summarise it. When you have read all of it, reply with OK only.`;
      const s = await session(prompt, dir, settings, t.tools ?? ['Read']);
      rows.push({ document: t.document, format: t.format, source: t.source, bytes: fs.statSync(t.file).size, sha256: sha256(t.file), ...(t.tools ? { tools: t.tools } : {}), session: s });
    }
    if (settings.dry) return;
    const run = { recorded: new Date().toISOString(), effort: settings.effort, baseline, ...(toolSets.length ? { baselines } : {}), rows };
    // A run in which every document session failed is reported but not saved, and exits non-zero.
    if (rows.every((r) => r.session.isError)) {
      process.stdout.write(`\n${report(run)}\n`);
      throw new Error(`every document session ended in an error; nothing saved${rows[0]?.session.stderr ? `. Last: ${rows[0].session.stderr}` : ''}`);
    }
    if (opt('out')) {
      fs.mkdirSync(path.dirname(path.resolve(opt('out'))), { recursive: true });
      fs.writeFileSync(opt('out'), `${maskArtifactIds(JSON.stringify(run, null, 1))}\n`);
    }
    process.stdout.write(`\n${report(run)}\n`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main ?? (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`${e.message}\n`); process.exit(1); });
}
