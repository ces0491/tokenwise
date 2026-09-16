#!/usr/bin/env node
// The switch figure. A PreModelSwitch hook: Claude Code's own confirmation for a warm-cache model switch says the history
// gets re-read but not how much, and it passes the hook the size and an estimated cost. The hook shows those figures
// when the cost is more than a route from the session's model, and says nothing otherwise.
//
// It never returns a decision. "ask" would put the figure inside the confirmation, but outside an interactive /model
// Claude Code treats "ask" as a refusal, and the hook cannot tell /model from /config or turning on fast mode, which
// share source "command". So it prints only a systemMessage, which Claude Code shows whatever the decision, and the
// switch goes ahead or not exactly as it would without the plugin. A failure prints nothing (route-cost.mjs).
// Tested by switch-figure.test.mjs.

import fs from 'node:fs';
import { basis, canonical, effortOf, isMain, respond as respondWith, runHook, threshold, tokens } from './route-cost.mjs';

// The model that wrote the conversation's last response, read backwards from the end of the transcript. Claude Code
// confirms a switch only when the target differs from that model, since otherwise its cache still holds the
// conversation. Rows Claude Code writes itself carry the model "<synthetic>" and are skipped. The transcript is read in
// chunks, since one tool result can run to hundreds of kilobytes, up to a cap that keeps the hook well inside its timeout.
export function lastResponseModel(transcriptPath, { chunkBytes = 512 * 1024, maxBytes = 16 * 1024 * 1024 } = {}) {
  let fd;
  try {
    fd = fs.openSync(transcriptPath, 'r');
    let end = fs.fstatSync(fd).size;
    const floor = Math.max(0, end - maxBytes);
    let carry = Buffer.alloc(0);
    while (end > floor) {
      const start = Math.max(floor, end - chunkBytes);
      const chunk = Buffer.alloc(end - start);
      // readSync can return short of the buffer, so it is called until the chunk is full or the file ends.
      let got = 0;
      for (let n = 1; n > 0 && got < chunk.length;) {
        n = fs.readSync(fd, chunk, got, chunk.length - got, start + got);
        got += n;
      }
      const buf = Buffer.concat([chunk.subarray(0, got), carry]);
      // Unless this chunk starts the file, its first line may be cut, and cut mid-character: it is carried back as
      // raw bytes and read whole with the next chunk. Splitting the decoded string instead would re-encode a split
      // character as U+FFFD and corrupt that row.
      let body = buf;
      if (start > 0) {
        const cut = buf.indexOf(0x0a);
        carry = cut >= 0 ? buf.subarray(0, cut + 1) : buf;
        body = cut >= 0 ? buf.subarray(cut + 1) : Buffer.alloc(0);
      } else {
        carry = Buffer.alloc(0);
      }
      const lines = body.toString('utf8').split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].includes('"assistant"')) continue;
        try {
          const o = JSON.parse(lines[i]);
          const model = o.message?.model;
          if (o.type === 'assistant' && !o.isSidechain && model && model !== '<synthetic>') return model;
        } catch { /* not a whole JSON row */ }
      }
      end = start;
    }
  } catch { /* no transcript to read */ } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return null;
}

export function message(input, routes, readLast = lastResponseModel) {
  if (input.prompt_cache_warm !== true) return null;
  if (input.to_model && input.from_model && canonical(input.to_model) === canonical(input.from_model)) return null;
  const last = input.transcript_path ? readLast(input.transcript_path) : null;
  if (last && input.to_model && canonical(last) === canonical(input.to_model)) return null;
  const usd = input.estimated_cache_write_usd;
  if (typeof usd !== 'number' || typeof input.context_tokens !== 'number' || !input.context_tokens || !routes.length) return null;
  // "default" means Claude Code had no price for the target model and assumed one, so the figure cannot be weighed.
  if (input.pricing === 'default') return null;
  if (usd <= threshold(routes, input.from_model, effortOf(input))) return null;
  const to = input.to_model ? canonical(input.to_model) : 'the new model';
  // Claude Code can show this after the switch has applied, and the re-send happens on the next message, so the line
  // says what that message costs and how to avoid it from either side of the switch.
  return `tokenwise: on ${to}, your next message re-sends ${tokens(input.context_tokens)} tokens, about $${usd.toFixed(2)}${basis(input.pricing)}, because each model has its own cache. Run /clear first if you don't need this conversation.`;
}

export const respond = (stdin, routesFile) => respondWith(stdin, (input, routes) => message(input, routes), routesFile);

if (isMain(import.meta)) runHook(message);
