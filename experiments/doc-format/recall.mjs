#!/usr/bin/env node
// Whether Claude can give back every file path in a document exactly, by the form the document arrives in.
//
//   node experiments/doc-format/recall.mjs [--out experiments/doc-format/results/<name>.json] [--repeat 3] [--model sonnet] [--effort low]
//       [--copies short-pdf-chrome,...] [--text findings|filler] [--framing test|plain]
//   node experiments/doc-format/recall.mjs --report experiments/doc-format/results/<name>.json    # free: reads a saved run
//
// Uses pdf-wrap.mjs's synthetic review, whose paths are known, in two sizes: a short one (under the Read tool's 10-page
// PDF line) and a long one (over it). The short one goes in as Markdown, as pandoc HTML, and as PDFs printed by Chrome,
// by Chrome with inline code set to nowrap, and by Typst. The long one goes in as Markdown and as a Chrome PDF. Each copy
// gets one `claude -p` session offered only the Read tool, asked to read the file and list every path exactly, and the
// list is scored against the paths the document holds. A wrong path is marked when the PDF split it across two printed
// lines, which shows what Claude made of the split. --repeat runs each copy that many times, since the same PDF does not
// always come back the same way. A session that never reads the file is retried twice and then recorded as it ended.
// --copies runs only the copies named. --text filler builds the document from random words instead of review findings,
// and --framing plain leaves out the prompt's opening line saying the document is a test; the first trials ran that way,
// and Claude sometimes declined them as a likely prompt injection. Sessions run on your Claude account and draw on its
// usage. Tested by recall.test.mjs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { session } from './measure.mjs';
import { ENGINES, TEXT_STYLES, document, pageCount } from './pdf-wrap.mjs';

const SEED = 11;
const SIZES = { short: 12, long: 60 };

// The copies to test: which size of document, what form it takes, and how it is made from the Markdown.
const engine = (id) => ENGINES.find((e) => e.id === id);
export const COPIES = [
  { id: 'short-md', size: 'short', form: 'Markdown', ext: 'md', make: null },
  { id: 'short-html', size: 'short', form: 'HTML, pandoc', ext: 'html', make: (md, out) => pandoc([md, '-f', 'gfm', '-t', 'html', '--standalone', '--metadata', 'title=Synthetic review', '-o', out]) },
  { id: 'short-pdf-chrome', size: 'short', form: 'PDF, Chrome', ext: 'pdf', make: (md, out, dir) => engine('chrome').print(md, out, dir) },
  { id: 'short-pdf-nowrap', size: 'short', form: 'PDF, Chrome with code nowrap', ext: 'pdf', make: (md, out, dir) => engine('chrome-nowrap').print(md, out, dir) },
  { id: 'short-pdf-typst', size: 'short', form: 'PDF, Typst', ext: 'pdf', make: (md, out, dir) => engine('typst').print(md, out, dir) },
  { id: 'long-md', size: 'long', form: 'Markdown', ext: 'md', make: null },
  { id: 'long-pdf-chrome', size: 'long', form: 'PDF, Chrome', ext: 'pdf', make: (md, out, dir) => engine('chrome').print(md, out, dir) },
];

const FRAMINGS = ['test', 'plain'];

export function prompt(name, framing) {
  const test = framing === 'test' ? `${name} is a synthetic code review made for a test of whether file paths survive when a document is converted to another format. ` : '';
  const read = framing === 'test' ? 'Read it' : `Read the file ${name}`;
  return `${test}${read} in full with the Read tool. If it is a PDF of more than 10 pages, read it in page ranges until every page has been read. Every sentence in it starts with "At" followed by a file path or a dotted module name. List every one of those paths and names exactly as it appears to you, one per line, in the order they appear, with nothing else in your reply.`;
}

function pandoc(args) {
  const r = spawnSync('pandoc', args, { encoding: 'utf8' });
  if (r.error || r.status !== 0) throw new Error(`pandoc failed: ${r.error?.message ?? r.stderr}`);
}

// The paths Claude listed, one per line, with any list markers or code quotes it added taken off.
export function listed(answer) {
  return String(answer).split('\n').map((l) => l.trim().replace(/^[-*\d.)\s]+(?=\S)/, '').replace(/^`|`$/g, '').trim()).filter(Boolean);
}

// Scores a reply against the document's paths. A path counts once however often it is listed. `split` is the set of
// paths the PDF broke across printed lines.
export function score(spans, answer, split = new Set()) {
  const got = listed(answer);
  const have = new Set(got);
  const known = new Set(spans.map((s) => s.text));
  const strays = got.filter((g) => !known.has(g));
  const wrong = [];
  let exact = 0;
  for (const { shape, text } of spans) {
    if (have.has(text)) { exact += 1; continue; }
    // The closest listed line that is not itself a path in the document, within a few characters.
    let near = null;
    let best = 4;
    for (const g of strays) {
      const d = distance(g, text, best);
      if (d < best) { best = d; near = g; }
    }
    wrong.push({ shape, text, splitInPdf: split.has(text), got: near });
  }
  const splitPaths = spans.filter((s) => split.has(s.text)).length;
  return { paths: spans.length, listed: got.length, exact, splitPaths, wrong, strays };
}

// Edit distance, giving up once it reaches `cap`.
export function distance(a, b, cap = Infinity) {
  if (Math.abs(a.length - b.length) >= cap) return cap;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...cur) >= cap) return cap;
    prev = cur;
  }
  return prev[b.length];
}

// A reply that lists far fewer lines than the document holds did not answer the question.
export const answered = (s) => s.listed >= s.paths / 2;

const usd = (n) => (n == null ? '?' : `$${n.toFixed(3)}`);

export function report(run) {
  const lines = [
    `Recorded ${run.recorded.slice(0, 10)} on ${run.model ?? '?'} at ${run.effort} effort, Claude Code ${run.claudeCode ?? '?'}. Document text: ${run.text ?? 'findings'}. Prompt framing: ${run.framing ?? 'test'}. One session per row.`,
    '',
    '| document | copy | run | pages | paths | listed exactly | split by the PDF | of those, listed exactly | wrong for another reason | session cost |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of run.rows) {
    const s = r.score;
    const splitWrong = s.wrong.filter((w) => w.splitInPdf).length;
    const other = s.wrong.length - splitWrong;
    const split = r.ext === 'pdf' ? String(s.splitPaths) : '-';
    const splitRight = r.ext === 'pdf' ? String(s.splitPaths - splitWrong) : '-';
    const flag = !r.session.reads?.length ? ' (never read the file)' : !answered(s) ? ` (reply listed ${s.listed} lines)` : '';
    lines.push(`| ${r.size} | ${r.form} | ${r.run ?? 1}${flag} | ${r.pages ?? '-'} | ${s.paths} | ${s.exact} | ${split} | ${splitRight} | ${other} | ${usd(r.session.cost)} |`);
  }
  const examples = run.rows.filter((r) => answered(r.score)).flatMap((r) => {
    const altered = r.score.wrong.filter((w) => w.got).map((w) => `\`${w.text}\` came back as \`${w.got}\`${w.splitInPdf ? ', split by the PDF' : ''}`);
    const missing = r.score.wrong.filter((w) => !w.got);
    const byShape = {};
    for (const w of missing) byShape[w.shape] = (byShape[w.shape] ?? 0) + 1;
    const left = Object.entries(byShape).map(([shape, n]) => `${n} ${shape}${missing.some((w) => w.shape === shape && w.splitInPdf) ? ' (some split by the PDF)' : ''}`);
    return [...altered, ...(left.length ? [`left out ${left.join(', ')}`] : [])].map((t) => `- ${r.size} ${r.form}, run ${r.run ?? 1}: ${t}`);
  });
  if (examples.length) lines.push('', ...examples);
  const retried = run.rows.flatMap((r) => r.retries ?? []);
  const total = [...run.rows.map((r) => r.session), ...retried].reduce((t, s) => t + (s.cost || 0), 0);
  const note = retried.length ? `, ${retried.length} of them retries after a session that never read the file` : '';
  lines.push('', `All ${run.rows.length + retried.length} sessions${note}: ${usd(total)} at list price.`);
  return lines.join('\n');
}

async function main(argv) {
  const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  const unknown = argv.filter((a) => a.startsWith('--') && !['--out', '--report', '--model', '--effort', '--repeat', '--copies', '--text', '--framing'].includes(a));
  if (unknown.length) throw new Error(`unknown option ${unknown.join(', ')}`);
  if (opt('report')) { process.stdout.write(`${report(JSON.parse(fs.readFileSync(opt('report'), 'utf8')))}\n`); return; }

  const settings = { model: opt('model') ?? 'sonnet', effort: opt('effort') ?? 'low', dry: false };
  const repeat = Number(opt('repeat') ?? 1);
  if (!Number.isInteger(repeat) || repeat < 1) throw new Error('--repeat needs a whole number of at least 1');
  const text = opt('text') ?? 'findings';
  if (!TEXT_STYLES.includes(text)) throw new Error(`--text takes one of ${TEXT_STYLES.join(', ')}`);
  const framing = opt('framing') ?? 'test';
  if (!FRAMINGS.includes(framing)) throw new Error(`--framing takes one of ${FRAMINGS.join(', ')}`);
  const wanted = opt('copies')?.split(',').map((c) => c.trim()).filter(Boolean);
  const unknownCopies = (wanted ?? []).filter((w) => !COPIES.some((c) => c.id === w));
  if (unknownCopies.length) throw new Error(`unknown copy ${unknownCopies.join(', ')}; use any of ${COPIES.map((c) => c.id).join(', ')}`);
  const copies = wanted ? COPIES.filter((c) => wanted.includes(c.id)) : COPIES;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-'));
  try {
    const docs = {};
    for (const [size, perShape] of Object.entries(SIZES)) {
      const { spans, markdown } = document(perShape, SEED, text);
      const md = path.join(work, `${size}.md`);
      fs.writeFileSync(md, markdown);
      docs[size] = { spans, md };
    }
    const rows = [];
    for (const [i, c] of copies.entries()) {
      const dir = path.join(work, `session-${i}`);
      fs.mkdirSync(dir);
      const name = `review.${c.ext}`;
      const file = path.join(dir, name);
      const { spans, md } = docs[c.size];
      if (c.make) c.make(md, file, fs.mkdtempSync(path.join(work, 'build-'))); else fs.copyFileSync(md, file);
      let split = new Set();
      let pages = null;
      if (c.ext === 'pdf') {
        pages = pageCount(file);
        const r = spawnSync('pdftotext', ['-enc', 'UTF-8', '-layout', file, '-'], { encoding: 'utf8' });
        split = new Set(spans.filter((s) => !r.stdout.includes(s.text)).map((s) => s.text));
      }
      const ask = prompt(name, framing);
      for (let n = 1; n <= repeat; n += 1) {
        process.stdout.write(`${c.size} ${c.form}, run ${n}\n`);
        const retries = [];
        let s = await session(ask, dir, settings);
        while (!s.reads.length && retries.length < 2) {
          retries.push({ ...s, answer: undefined });
          s = await session(ask, dir, settings);
        }
        // The document is synthetic, so the reply is kept whole for checking what came back.
        rows.push({ size: c.size, form: c.form, ext: c.ext, run: n, pages, score: score(spans, s.answer, split), session: s, ...(retries.length ? { retries } : {}) });
      }
    }
    const first = rows[0]?.session ?? {};
    const result = { recorded: new Date().toISOString(), model: first.model, claudeCode: first.claudeCode, effort: settings.effort, seed: SEED, sizes: SIZES, text, framing, rows };
    if (opt('out')) {
      fs.mkdirSync(path.dirname(path.resolve(opt('out'))), { recursive: true });
      fs.writeFileSync(opt('out'), `${JSON.stringify(result, null, 1)}\n`);
    }
    process.stdout.write(`\n${report(result)}\n`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main ?? (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`${e.message}\n`); process.exit(1); });
}
