#!/usr/bin/env node
// Which file paths survive a Markdown report turned into a PDF, by the shape of the path and the tool that made the PDF.
//
//   node experiments/doc-format/pdf-wrap.mjs [--out experiments/doc-format/results/<name>.json]
//   node experiments/doc-format/pdf-wrap.mjs --report experiments/doc-format/results/<name>.json    # reads a saved run
//
// Writes a synthetic review, the same paths in every shape set in ordinary prose, and makes a PDF of it with each engine:
// Chrome printing pandoc's HTML (as it comes, and with inline code set to nowrap), pandoc through pdflatex, pandoc through
// Typst, and pandoc's docx exported by LibreOffice and by Word. Each PDF's text is pulled out twice with pdftotext:
// -layout keeps each printed line, so a path wrapped across two lines shows as split and one set past the page edge shows
// as cut off, and the default mode joins lines and drops a hyphen that ends one. A path counts as intact when its exact
// text is in the output. Needs pandoc and pdftotext; an engine that is not installed is skipped. CHROME_BIN and
// SOFFICE_BIN point at Chrome and LibreOffice when they are not in their usual place. Spends nothing. Tested by
// pdf-wrap.test.mjs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PER_SHAPE = 60;
const SEED = 7;

export const SHAPES = {
  'kebab-case name': (i) => `src/lib/statement-run-${i}/apply-deductions.ts`,
  'hyphenated line range': (i) => `src/model/build.ts:${100 + i}-${120 + i}`,
  'snake_case name': (i) => `src/lib/statement_run_${i}/apply_deductions.py:${i + 10}`,
  'camelCase name': (i) => `src/lib/statementRun${i}/applyDeductions.ts:${i + 10}`,
  'slashes only': (i) => `src/lib/statement/run${i}/deduct/apply/index.ts:${i + 10}`,
  'comma-separated lines': (i) => `src/pages.tsx:${i + 10},${i + 20},${i + 30}`,
  'dotted name': (i) => `pkg.module${i}.submodule.function_name`,
};

// Findings of the kind a code review carries, so the synthetic document reads as a review.
const FINDINGS = [
  'the total is recomputed inside the loop, so move it out and compute it once',
  'a missing value in the input is passed through without a check',
  'the retry wraps the whole request, so a partial write is repeated',
  'the error is logged and then swallowed, so the caller sees success',
  'the date is parsed in local time where the rest of the module uses UTC',
  'the cache key leaves out the account, so two accounts share one entry',
  'the loop exits on the first empty page and skips the rest',
  'the default of zero hides a missing rate instead of failing',
];
const CONNECTIVES = ['and the test that covers it passes for the wrong reason', 'which the existing tests do not reach', 'so the fix belongs in the shared helper', 'and the same pattern appears nearby'];
// The first version of the document strung random words together after each path. It is kept so that version can be
// rebuilt exactly: recall.mjs compares the two.
const FILLER = 'the fix moves this check before the loop so the total is computed once and the caller sees the same value'.split(' ');

// How each sentence continues after its path, drawing from the seeded generator.
const TEXTS = {
  findings: (rand) => {
    const one = (list) => list[Math.floor(rand() * list.length)];
    return `, ${one(FINDINGS)}${rand() < 0.5 ? `, ${one(CONNECTIVES)}` : ''}.`;
  },
  filler: (rand) => {
    const pick = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
    const phrase = (n) => Array.from({ length: n }, () => FILLER[Math.floor(rand() * FILLER.length)]).join(' ');
    const first = phrase(pick(3, 14));
    return ` ${first}, and ${phrase(pick(2, 6))}.`;
  },
};
export const TEXT_STYLES = Object.keys(TEXTS);

// A small seeded generator, so the document is the same on every run.
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Each path opens a sentence of varied length, so the paths land at different points along the printed line.
export function document(perShape = PER_SHAPE, seed = SEED, style = 'findings') {
  if (!TEXTS[style]) throw new Error(`unknown text style ${style}; use one of ${TEXT_STYLES.join(', ')}`);
  const rand = random(seed);
  const rest = TEXTS[style];
  const spans = [];
  const sentences = [];
  for (let i = 0; i < perShape; i += 1) {
    for (const [shape, make] of Object.entries(SHAPES)) {
      const filePath = make(i);
      spans.push({ shape, text: filePath });
      sentences.push(`At \`${filePath}\`${rest(rand)}`);
    }
  }
  for (let i = sentences.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [sentences[i], sentences[j]] = [sentences[j], sentences[i]];
  }
  const paras = [];
  for (let i = 0; i < sentences.length; i += 4) paras.push(sentences.slice(i, i + 4).join(' '));
  return { spans, markdown: `# Synthetic review\n\n${paras.join('\n\n')}\n` };
}

// Where a missing path went: split across two printed lines (and after which character), cut off at the edge of the page
// (and by how many characters), or joined with a hyphen lost.
export function classify(text, layout, joined) {
  const result = { split: null, cutOff: 0, hyphenDropped: false };
  if (!layout.includes(text)) {
    for (let k = 1; k < text.length; k += 1) {
      // A split at the foot of a page carries pdftotext's form feed onto the next line.
      if (new RegExp(`${escape(text.slice(0, k))}[ \\t]*\\r?\\n[\\f \\t]*${escape(text.slice(k))}`).test(layout)) {
        result.split = text[k - 1];
        break;
      }
    }
    if (result.split === null) {
      // A path set past the right margin loses its last characters where it leaves the page.
      for (let k = 1; k <= Math.min(10, text.length - 1); k += 1) {
        if (new RegExp(`${escape(text.slice(0, -k))}\\r?\\n`).test(layout)) { result.cutOff = k; break; }
      }
      if (!result.cutOff) result.split = 'elsewhere';
    }
  }
  if (!joined.includes(text)) {
    result.hyphenDropped = [...text].some((c, i) => c === '-' && joined.includes(text.slice(0, i) + text.slice(i + 1)));
  }
  return result;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function tally(spans, layout, joined) {
  const rows = {};
  for (const { shape, text } of spans) {
    const row = (rows[shape] ??= { paths: 0, split: 0, cutOff: 0, alteredWhenJoined: 0, hyphenDropped: 0, splitAfter: {} });
    const c = classify(text, layout, joined);
    row.paths += 1;
    if (c.cutOff) row.cutOff += 1;
    if (c.split) {
      row.split += 1;
      row.splitAfter[c.split] = (row.splitAfter[c.split] ?? 0) + 1;
    }
    if (!joined.includes(text)) row.alteredWhenJoined += 1;
    if (c.hyphenDropped) row.hyphenDropped += 1;
  }
  return rows;
}

export function report(run) {
  const lines = [
    `Recorded ${run.recorded.slice(0, 10)}: ${run.perShape} paths of each shape. ${Object.entries(run.tools).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    '',
    '| path shape | printed with | split across lines | cut off at the page edge | altered in joined text | of which a hyphen dropped |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const v of run.variants) {
    for (const [shape, r] of Object.entries(v.rows ?? {})) {
      lines.push(`| ${shape} | ${v.name} | ${r.split} of ${r.paths} | ${r.cutOff ?? 0} | ${r.alteredWhenJoined} of ${r.paths} | ${r.hyphenDropped} |`);
    }
  }
  lines.push('');
  for (const v of run.variants) {
    if (v.skipped) { lines.push(`- ${v.name}: skipped, ${v.skipped}.`); continue; }
    const after = {};
    for (const r of Object.values(v.rows)) for (const [c, n] of Object.entries(r.splitAfter)) after[c] = (after[c] ?? 0) + n;
    const text = Object.entries(after).map(([c, n]) => `${n} after "${c}"`).join(', ') || 'none';
    lines.push(`- ${v.name}: ${v.pages} pages. Splits: ${text}.`);
  }
  return lines.join('\n');
}

// ---- running ----------------------------------------------------------------------------------------

const CHROME_DEFAULTS = {
  win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
};

function chromePath() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const found = (CHROME_DEFAULTS[process.platform] ?? []).find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chrome not found; set CHROME_BIN');
  return found;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} failed: ${(r.stderr || '').trim().split('\n').pop()}`);
  return `${r.stdout}${r.stderr}`;
}

function chromeVersion(chrome) {
  if (process.platform === 'win32') {
    const r = spawnSync('powershell', ['-NoProfile', '-Command', `(Get-Item '${chrome}').VersionInfo.ProductVersion`], { encoding: 'utf8' });
    return r.stdout?.trim() || 'unknown';
  }
  return run(chrome, ['--version']).trim().replace(/^\D+/, '') || 'unknown';
}

export function pageCount(pdf) {
  const info = spawnSync('pdfinfo', [pdf], { encoding: 'utf8' });
  return Number(/Pages:\s+(\d+)/.exec(info.stdout ?? '')?.[1]) || null;
}

const fileVersion = (file) => spawnSync('powershell', ['-NoProfile', '-Command', `(Get-Item '${file}').VersionInfo.ProductVersion`], { encoding: 'utf8' }).stdout?.trim() || 'unknown';

function chromePrint(html, pdf) {
  const chrome = chromePath();
  run(chrome, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, pathToFileURL(html).href]);
  return chromeVersion(chrome);
}

function pandocHtml(md, html, extraCss) {
  run('pandoc', [md, '-f', 'gfm', '-t', 'html', '--standalone', '--metadata', 'title=Synthetic review', '-o', html]);
  if (extraCss) fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace('</head>', `<style>${extraCss}</style>\n</head>`));
}

// Typst ships inside Quarto, so it is used from there when it is not on PATH.
function typst(args) {
  const direct = spawnSync('typst', ['--version'], { encoding: 'utf8' });
  return direct.error ? run('quarto', ['typst', ...args]) : run('typst', args);
}

const SOFFICE_DEFAULTS = { win32: ['C:\\Program Files\\LibreOffice\\program\\soffice.exe'], darwin: ['/Applications/LibreOffice.app/Contents/MacOS/soffice'], linux: ['/usr/bin/soffice'] };

// Each engine turns the Markdown into a PDF and returns its own version. One that is not installed is skipped.
export const ENGINES = [
  {
    id: 'chrome', name: 'Chrome, pandoc stylesheet',
    print: (md, pdf, dir) => { const html = path.join(dir, 'pandoc.html'); pandocHtml(md, html); return chromePrint(html, pdf); },
  },
  {
    id: 'chrome-nowrap', name: 'Chrome, code nowrap',
    print: (md, pdf, dir) => { const html = path.join(dir, 'nowrap.html'); pandocHtml(md, html, 'code { white-space: nowrap; }'); return chromePrint(html, pdf); },
  },
  {
    id: 'latex', name: 'LaTeX (pdflatex)',
    print: (md, pdf) => {
      run('pandoc', [md, '-f', 'gfm', '-o', pdf, '--pdf-engine=pdflatex']);
      return run('pdflatex', ['--version']).split('\n')[0].trim();
    },
  },
  {
    id: 'typst', name: 'Typst',
    print: (md, pdf, dir) => {
      const typ = path.join(dir, 'synthetic.typ');
      run('pandoc', [md, '-f', 'gfm', '-t', 'typst', '-o', typ]);
      typst(['compile', typ, pdf]);
      return typst(['--version']).trim().replace(/^typst\s+/, '');
    },
  },
  {
    id: 'libreoffice', name: 'LibreOffice (from docx)',
    print: (md, pdf, dir) => {
      const soffice = process.env.SOFFICE_BIN || (SOFFICE_DEFAULTS[process.platform] ?? []).find((p) => fs.existsSync(p));
      if (!soffice) throw new Error('LibreOffice not found; set SOFFICE_BIN');
      const out = path.join(dir, 'libreoffice');
      const docx = path.join(out, 'libreoffice.docx');
      fs.mkdirSync(out);
      run('pandoc', [md, '-f', 'gfm', '-o', docx]);
      run(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', out, docx]);
      fs.renameSync(path.join(out, 'libreoffice.pdf'), pdf);
      return process.platform === 'win32' ? fileVersion(soffice) : run(soffice, ['--version']).trim();
    },
  },
  {
    // Word is driven through COM, so this engine runs on Windows only.
    id: 'word', name: 'Word (from docx)',
    print: (md, pdf, dir) => {
      if (process.platform !== 'win32') throw new Error('Word export runs on Windows only');
      const docx = path.join(dir, 'word.docx');
      run('pandoc', [md, '-f', 'gfm', '-o', docx]);
      const script = [
        '$w = New-Object -ComObject Word.Application; $w.Visible = $false',
        `try { $d = $w.Documents.Open('${docx}', $false, $true); $d.ExportAsFixedFormat('${pdf}', 17); $d.Close($false); $w.Version } finally { $w.Quit() }`,
      ].join('; ');
      return run('powershell', ['-NoProfile', '-Command', script]).trim();
    },
  },
];

async function main(argv) {
  const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  const unknown = argv.filter((a) => a.startsWith('--') && !['--out', '--report'].includes(a));
  if (unknown.length) throw new Error(`unknown option ${unknown.join(', ')}`);
  if (opt('report')) { process.stdout.write(`${report(JSON.parse(fs.readFileSync(opt('report'), 'utf8')))}\n`); return; }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-wrap-'));
  try {
    const { spans, markdown } = document();
    const md = path.join(work, 'synthetic.md');
    fs.writeFileSync(md, markdown);
    const tools = {
      pandoc: run('pandoc', ['--version']).split('\n')[0].replace(/^pandoc\s+/, '').trim(),
      // xpdf's pdftotext exits non-zero after printing its version.
      pdftotext: `${spawnSync('pdftotext', ['-v'], { encoding: 'utf8' }).stderr ?? ''}`.split('\n')[0].replace(/^pdftotext version\s*/, '').trim() || 'unknown',
    };

    const variants = [];
    for (const engine of ENGINES) {
      const pdf = path.join(work, `${engine.id}.pdf`);
      try {
        tools[engine.id] = engine.print(md, pdf, work);
        if (!fs.existsSync(pdf)) throw new Error('no PDF was written');
      } catch (e) {
        variants.push({ name: engine.name, skipped: e.message });
        process.stdout.write(`${engine.name}: skipped, ${e.message}\n`);
        continue;
      }
      run('pdftotext', ['-enc', 'UTF-8', '-layout', pdf, `${pdf}.layout.txt`]);
      run('pdftotext', ['-enc', 'UTF-8', pdf, `${pdf}.joined.txt`]);
      const layout = fs.readFileSync(`${pdf}.layout.txt`, 'utf8');
      const joined = fs.readFileSync(`${pdf}.joined.txt`, 'utf8');
      variants.push({ name: engine.name, pages: pageCount(pdf), rows: tally(spans, layout, joined) });
    }
    const result = { recorded: new Date().toISOString(), perShape: PER_SHAPE, seed: SEED, tools, variants };
    if (opt('out')) {
      fs.mkdirSync(path.dirname(path.resolve(opt('out'))), { recursive: true });
      fs.writeFileSync(opt('out'), `${JSON.stringify(result, null, 1)}\n`);
    }
    process.stdout.write(`${report(result)}\n`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main ?? (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`${e.message}\n`); process.exit(1); });
}
