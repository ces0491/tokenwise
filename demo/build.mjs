#!/usr/bin/env node
// Renders a terminal-style demo of the route skill as an MP4 and a GIF.
//
// The rendered files are deliberately not committed — they are large, they go stale whenever the
// skill's answer changes, and this script regenerates them in a few seconds. What is committed is
// the means to rebuild them.
//
// The demo is a recreation, not a screen capture. Every line of the answer comes from a real
// invocation captured into answer.txt; the framing around it (the prompt line, the classification
// line, the install commands) is the only text this script adds.
//
// Capture an answer, then render:
//
//   cd demo
//   claude -p "/tokenwise:route review an uncommitted six-file diff in a repo I know well" \
//     --plugin-dir .. --setting-sources project --strict-mcp-config --effort low > answer.txt
//   node build.mjs
//   ffmpeg -f lavfi -i "color=c=0x0D1117:s=1920x1080:d=$(node -p "require('./meta.json').duration"):r=30" \
//     -filter_script:v filters.txt -c:v libx264 -crf 20 -pix_fmt yuv420p tokenwise-demo.mp4
//
// Requires ffmpeg built with libfreetype, and a monospace font. Set DEMO_FONT to override the
// default; the file is copied to font.ttf so the filter graph can reference it without absolute
// paths, which ffmpeg's filter syntax makes painful on Windows.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const W = 1920, H = 1080;
const FONT = 21, LH = 29, X = 70, TOP = 48, WRAP = 138;
const BODY = '0xE6EDF3', ACCENT = '0x7EE787', DIM = '0x8B949E', CMD = '0x79C0FF';

const FONT_CANDIDATES = [
  process.env.DEMO_FONT,
  'C:/Windows/Fonts/consola.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
  '/System/Library/Fonts/Menlo.ttc',
].filter(Boolean);

const answerPath = path.join(HERE, 'answer.txt');
if (!fs.existsSync(answerPath)) {
  process.stderr.write('demo/answer.txt is missing. Capture one first — see the header of this file.\n');
  process.exit(1);
}

const font = FONT_CANDIDATES.find((f) => fs.existsSync(f));
if (!font) {
  process.stderr.write(`No monospace font found. Tried:\n  ${FONT_CANDIDATES.join('\n  ')}\nSet DEMO_FONT to one.\n`);
  process.exit(1);
}
fs.copyFileSync(font, path.join(HERE, 'font.ttf'));

// ---- layout ---------------------------------------------------------------------------------------

const blocks = [];
let y = TOP;
let n = 0;

// One drawtext per line: ffmpeg renders a newline inside a textfile as .notdef on at least some
// builds, which draws a stray box at every internal line break.
function draw(lines, t, color) {
  for (const line of lines) {
    const file = `t${String(n++).padStart(3, '0')}.txt`;
    fs.writeFileSync(path.join(HERE, file), line);
    blocks.push({ file, y, t, color });
    y += LH;
  }
}
const gap = (k = 1) => { y += k * LH; };

function wrap(text, width, indent) {
  const out = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > width) { out.push(indent + line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(indent + line);
  return out;
}

const fields = fs.readFileSync(answerPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
  const m = /^- \*\*(.+?):\*\*\s*(.*)$/.exec(l);
  if (!m) throw new Error(`unparsed answer line: ${l.slice(0, 60)}`);
  // Markdown emphasis and code ticks are formatting, not content; a terminal shows neither.
  return { label: m[1], value: m[2].replace(/[`*]/g, '').trim() };
});

let t = 0.2;
draw(['$ claude'], t, DIM);
t += 0.9;
draw(['> /tokenwise:route review an uncommitted six-file diff in a repo I know well'], t, CMD);
gap();
t += 1.1;
draw(['  tokenwise:route  ·  reading volume: low  ·  judgment density: high'], t, DIM);
gap();

t += 1.0;
for (const f of fields) {
  draw([`  ${f.label}`], t, ACCENT);
  draw(wrap(f.value, WRAP, '    '), t + 0.15, BODY);
  gap();
  t += 1.25;
}
draw(['  /plugin marketplace add ces0491/tokenwise',
      '  /plugin install tokenwise@ces0491-plugins'], t + 0.3, CMD);

const duration = Math.ceil(t + 3.2);

// ---- filter graph ----------------------------------------------------------------------------------

const esc = (s) => String(s).replace(/,/g, '\\,');
fs.writeFileSync(path.join(HERE, 'filters.txt'), blocks.map((b) =>
  `drawtext=fontfile=font.ttf:textfile=${b.file}:x=${X}:y=${b.y}:fontsize=${FONT}` +
  `:fontcolor=${b.color}:enable='${esc(`gte(t,${b.t.toFixed(2)})`)}'`
).join(',\n'));
fs.writeFileSync(path.join(HERE, 'meta.json'), `${JSON.stringify({ duration, blocks: blocks.length, lastY: y, width: W, height: H }, null, 1)}\n`);

process.stdout.write(`${blocks.length} lines, ${fields.length} fields, ${duration}s, font ${path.basename(font)}\n`);
if (y > H - 40) {
  process.stderr.write(`Content overflows the frame by ${y - (H - 40)}px. Lower FONT/LH or raise WRAP.\n`);
  process.exit(1);
}
