# What a document costs Claude Code to read, by format

The same paper, *Attention Is All You Need* (arXiv 1706.03762v7), handed to Claude Code in four forms. Claude read each one in full with the Read tool, and the tokens it added to the context were measured from the session's own usage. The PDF and HTML figures each include one failed Read call, which the saved run records.

| Form | File size | Read calls | Returned as | Tokens added |
| --- | --- | --- | --- | --- |
| PDF, 15 pages | 2.2 MB | 2 | page images, with 123 characters of text | 19.3K |
| arXiv HTML page | 189 KB | 9 | text | 101.8K |
| HTML converted to Markdown with pandoc | 63 KB | 2 | text | 34.6K |
| PDF converted to text with pdftotext | 61 KB | 1 | text | 18.5K |

Recorded 14 September 2026 on Claude Sonnet 5 at low effort, Claude Code 2.1.270, one session per row. A session with no document started at 8.9K tokens of context. The raw run is `results/2026-09-14-sonnet-low.json`.

## What it shows

- The HTML page added 5.3 times the tokens the PDF did. The page carries layout tags, class names and MathML for the equations alongside the prose, and the Read tool returns all of it.
- The 15 page images cost about as much as the text pdftotext extracted from them, 19.3K tokens against 18.5K.
- Converting the HTML to Markdown before reading cut it to a third. Pandoc's `gfm` target keeps any HTML it cannot express as Markdown, which on this page left much of the markup in place, so the conversion drops raw HTML (`-t gfm-raw_html`). The tables and the equations, as LaTeX, survive.
- Whatever enters the context is sent again on every later call in the session.

## What it does not show

- **Other documents.** One equation-heavy paper. The gap between formats depends on how much markup a page carries. `measure.mjs` takes any files, so run it on your own.
- **Review quality.** Nothing here checks how well Claude understood each form.
- **Fetching a URL.** WebFetch converts a page to Markdown and has a smaller model answer a prompt about it, and Claude receives that answer. Only local files are measured.
- **Variation between runs.** Tokens added depend on what the Read tool returns, and the saved run records the page ranges and offsets each read asked for, so a re-run can be compared call by call.

## Check it

Free, from the saved run:

```sh
node experiments/doc-format/measure.mjs --report experiments/doc-format/results/2026-09-14-sonnet-low.json
node --test experiments/doc-format/measure.test.mjs
```

The report prints the SHA-256 of each file measured, so a re-run can confirm arXiv served the same bytes.

Re-run it on your own Claude account. It downloads the paper, converts it, and runs five short sessions, which came to $1.00 at list price on 14 September 2026:

```sh
node experiments/doc-format/measure.mjs --documents experiments/doc-format/documents.json --out experiments/doc-format/results/<name>.json
```

Or measure your own files, with `--convert` for the text versions:

```sh
node experiments/doc-format/measure.mjs report.pdf report.html --convert
```

It was run on Node 24 and needs Claude Code, with pandoc and pdftotext on PATH for the conversions. If Claude Code is installed as an npm `.cmd` shim on Windows, set `CLAUDE_BIN` to the full path of the executable, since Node cannot start a `.cmd` file without a shell. Each session is offered only the Read tool, so no permissions are bypassed. `--model` and `--effort` change the setting. Anthropic's pricing page says models from Claude 4.7 on use a newer tokenizer than earlier ones, which puts Sonnet 5 and Opus 5 on one tokenizer and Haiku 4.5 on the older one, so Haiku's counts for the same file differ.
