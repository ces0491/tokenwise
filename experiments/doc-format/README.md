# What a document costs Claude Code to read, by format

A paper, a code review report and three claude.ai artifacts, each handed to Claude Code in several forms, plus a synthetic review whose file paths are known. Claude read each form in full, one session per form, and the tokens it added to the context were measured from the session's own usage. Files were read with the Read tool unless a section says otherwise. Links were read with the tools a session would use for them.

## A paper

*Attention Is All You Need* (arXiv 1706.03762v7), downloaded from arXiv and converted locally.

| Form | File size | Read calls | Returned as | Tokens added |
| --- | --- | --- | --- | --- |
| PDF, 15 pages | 2.2 MB | 2 | page images, with 123 characters of text | 19.4K |
| arXiv HTML page | 189 KB | 9 | text | 101.8K |
| HTML converted to Markdown with pandoc | 63 KB | 2 | text | 34.6K |
| PDF converted to text with pdftotext | 61 KB | 1 | text | 18.5K |

The PDF and HTML figures each include one failed Read call. The raw run is `results/2026-09-16-sonnet-low.json`. An earlier run, `results/2026-09-14-sonnet-low.json` on Claude Code 2.1.270, measured the same bytes (the SHA-256 of each file matches) and its tokens added are within 50 of these on every row.

- The HTML page added 5.3 times the tokens the PDF did. The page carries layout tags, class names and MathML for the equations alongside the prose, and the Read tool returns all of it.
- The Read tool needs page ranges for a PDF over 10 pages. The page-range read returned the 15 pages as images, which cost about as much as the text pdftotext extracted from them.
- Converting the HTML to Markdown cut it to a third. Pandoc's `gfm` target keeps any HTML it cannot express as Markdown, which on this page left much of the markup in place, so the conversion drops raw HTML (`-t gfm-raw_html`). The tables and the equations, as LaTeX, survive.

## A code review report

A 12 KB Markdown review report written for an engineer: headings, lists, and file paths and line numbers in code formatting. It is a client document and is not published; the saved run records only its file names and hashes. It was rendered to HTML with `pandoc -f gfm -t html --standalone`, to a single HTML file with `quarto render --to html -M embed-resources:true`, and to PDF by printing the pandoc page with headless Chrome.

| Form | File size | Read calls | Returned as | Tokens added |
| --- | --- | --- | --- | --- |
| Markdown | 12 KB | 1 | text | 4.9K |
| HTML, pandoc | 18 KB | 1 | text | 8.3K |
| PDF, 5 pages | 161 KB | 1 | PDF document block, with 100 characters of text | 12.5K |
| HTML, Quarto single file | 1.2 MB | 18, 8 errors | text | not read |

The raw run is `results/2026-09-16-sonnet-low-review-report.json`.

- The pandoc HTML added 1.7 times what the Markdown did. The report's markup is light.
- The PDF added 2.6 times what the Markdown did. At 5 pages it was read whole and sent as a document block, which [Anthropic's PDF documentation](https://platform.claude.com/docs/en/build-with-claude/pdf-support) describes as each page's image with its extracted text alongside.
- The Quarto file was not read. It embeds scripts, fonts and the stylesheet, several as single lines tens or hundreds of thousands of characters long, and the report starts on line 2,196. Claude stopped at line 36, a 33,477-character base64 script, which it reported was over the Read tool's 25,000-token limit even when asked for on its own. The run's 11.1K is the cost of those 18 calls, not of the report.
- Offered Read, Grep, Glob and Bash limited to `grep`, `head`, `tail`, `wc` and `cut`, Claude got through a copy of the Quarto file re-rendered with the same command. Two Read calls failed, Grep found where the report starts, and Claude read from line 2,170 to the end, adding 15.2K, about three times the Markdown. Those tools also raise a session's starting context, from 15.7K to 21.9K. The raw run is `results/2026-09-17-sonnet-low-quarto-tools.json`.

## File paths in a printed PDF

The review report names 23 file paths, 19 of them with a hyphen. In its PDF, 7 of the 19 were split across two printed lines, each at a hyphen, and none of the other 4 were. Pulled out with pdftotext's default mode, which joins lines and drops a hyphen that ends one, a line range written `389-392` became `389392`. That count was taken by hand on 17 September, from a copy of the PDF re-rendered with the same commands, and is not in a saved run.

`pdf-wrap.mjs` repeats the test on a synthetic review: 60 paths in each of seven shapes, each opening a sentence that reads like a review finding, made into a PDF six ways. Chrome prints pandoc's HTML, as it comes and with `code { white-space: nowrap; }` added. Pandoc also goes through pdflatex and through Typst, and its docx is exported by LibreOffice and by Word.

| Path shape | Chrome | Chrome, `nowrap` | LaTeX | Typst | LibreOffice | Word |
| --- | --- | --- | --- | --- | --- | --- |
| kebab-case name | 14 split | 0 | 0 | 19 split | 15 split | 14 split |
| hyphenated line range | 0 | 0 | 0 | 9 split | 3 split | 2 split |
| snake_case name | 0 | 0 | 0 | 29 split | 0 | 0 |
| camelCase name | 0 | 0 | 0 | 16 split | 0 | 0 |
| slashes only | 0 | 0 | 1 cut off | 18 split | 0 | 0 |
| comma-separated lines | 0 | 0 | 0 | 6 split | 0 | 0 |
| dotted name | 0 | 0 | 0 | 0 | 0 | 0 |

Each cell is out of 60. The raw run is `results/2026-09-17-pdf-wrap.json`.

- Chrome, LibreOffice and Word split paths only after a hyphen. Pandoc's stylesheet sets inline code to `white-space: pre-wrap`, which lets Chrome wrap code, and Chrome breaks after a hyphen.
- Typst split after a slash as well, so every shape with a slash broke. Of its 97 splits, 89 came after a slash.
- LaTeX split nothing. It set long paths past the right margin instead, and one ran off the page, where pdftotext lost its last characters: `index.ts:59` came out as `index.t`.
- The synthetic line ranges (`build.ts:104-124`) are short, with one hyphen. The kebab-case paths are longer, 44 characters against 26, with three hyphens each. The test doesn't separate the effect of length from the number of hyphens.
- Whether a path splits depends on where the prose around it puts it on the line, so the counts move with the wording of the document.
- In pdftotext's default mode, almost every path split at a hyphen came out with the hyphen missing: all 14 of Chrome's, all 18 of LibreOffice's, 15 of Word's 16 and 7 of Typst's 8. Typst's splits at a slash kept every character but left a space or a line break in the path: `deduct/ apply/index.ts`.
- With `nowrap`, Chrome split nothing. Each path moved whole to the next line. Every synthetic path fits on one line; a path longer than the line would run past the margin instead.

## Whether Claude gives the paths back

`recall.mjs` hands Claude the synthetic review and asks it to list every path exactly, then scores the list. The short version has 84 paths and stays under the Read tool's 10-page PDF line; the long one has 420 and goes over it. Each copy ran three times.

| Copy | Paths split by the PDF | Listed exactly, three runs |
| --- | --- | --- |
| Short, Markdown | - | 84, 84, 84 |
| Short, HTML (pandoc) | - | 84, 84, 84 |
| Short, PDF (Chrome) | 3 | 84, 84, 84 |
| Short, PDF (Chrome, `nowrap`) | 0 | 84, 84, 84 |
| Short, PDF (Typst) | 22 | 84, 84, 84 |
| Long, Markdown | - | 420, 420, 420 |
| Long, PDF (Chrome) | 20 | 420, 419, 420 |

The raw run is `results/2026-09-17-sonnet-low-recall.json`, with each reply kept.

- Claude gave back every path these PDFs split, exactly, in every run. The short PDFs went in as document blocks, page images with extracted text; the long one as page images.
- The one miss, in the long PDF's second run, is a slash-only path that was not split, left out of the list.

### Hyphens lost

The first version of the synthetic review strung random words after each path. Claude sometimes gave back that document's split paths with the hyphen missing, so the short Chrome PDF was run eight more times in each of four combinations: the filler text or the review findings (`--text`), with a prompt that does or does not say the document is a test (`--framing`).

| Document text | Prompt | Reads that listed the paths | Reads with a split path wrong |
| --- | --- | --- | --- |
| filler | plain | 8 | 2 |
| filler | says it is a test | 8 | 1 |
| findings | plain | 7 | 0 |
| findings | says it is a test | 8 | 0 |

The raw runs are `results/2026-09-17-sonnet-low-hyphens-<text>-<framing>.json`, with each reply kept.

- Every wrong path was one the PDF split, given back with a hyphen missing: `statement-run-8` as `statement-run8`, and once `apply-deductions` as `applydeductions`. In one read all three split paths came back wrong, in the other two, two of the three.
- The prompt made no clear difference. The document did, but the two documents also split their paths in different places. In the filler version all three split after `statement-run-`, just before the number. In the findings version they split after `statement-` or `apply-`, before a word. These runs can't separate the wording from where the break falls.
- In one findings, plain session Claude declined to list the paths, calling the document a synthetic list built to extract paths in bulk. One filler, plain session never read the file and was retried. Earlier, unsaved trials on the filler version declined more often, which is why the main run says the document is a test.

## A claude.ai artifact

A code review of this author's tidylearn R package, published by Claude as a claude.ai artifact: a 51 KB HTML page with 74 findings. The findings are not in the HTML as text. They sit in a JavaScript array that builds the page in the browser.

| Form | File size | Tool calls | Returned as | Tokens added |
| --- | --- | --- | --- | --- |
| Markdown copy | 38 KB | 1 Read | text | 18.8K |
| The page's HTML, saved | 51 KB | 1 Read | text | 23.7K |
| The link, offered Artifact and Read | - | 1 Artifact, 2 Read | text | 46.1K |
| The link, offered only WebFetch | - | none | - | not read |

The raw run is `results/2026-09-17-sonnet-low-artifact.json`. It records the artifact version the Artifact tool returned, not the link, since the artifact is private.

- The Artifact tool returned the first 50 KB of the page and saved the whole file to disk, with an instruction to read every line of it. Claude did, so most of the page entered the context twice.
- A session offered the Artifact tools started at 33.1K tokens of context, against 15.7K offered only Read. That overhead is sent on every call, whether or not the session reads an artifact.
- Offered only WebFetch, the saved session declined without a call, saying claude.ai artifact links need a login. An earlier session run by hand called WebFetch and got HTTP 403.
- The artifact is owned by the account that ran the sessions, which is why the Artifact tool returned its HTML. For an artifact shared by someone else, the tool's description says a read returns an isolated summary. That case is not measured.
- Two smaller artifacts by the same author, a methodology report and a brand-mark study, both plain HTML with no script-built content, came back whole from one Artifact call each, adding 17.1K and 8.3K. Neither was saved to disk or read a second time. Their calls returned 41,621 and 18,163 characters, where the tidylearn page came back cut at 50,000 with the rest saved to disk. Offered only WebFetch, the agent declined both without a call. The raw run is `results/2026-09-17-sonnet-low-artifacts-small.json`.
- On Claude Code 2.1.273 (`results/2026-09-17-sonnet-low-links-cc2.1.273.json`), the tidylearn link read with the Artifact tool added 26.5K: after the Artifact call, Claude read the saved file from line 560 only, so the page did not go in twice. The two smaller artifacts added 17.1K and 8.4K, as before. Left to choose, the agent again declined WebFetch for all three links. Told to use WebFetch, two hand-run sessions on 2.1.273 got HTTP 403, as the 2.1.272 one did.
- These are all headless `claude -p` sessions. In an interactive Claude Code session in VS Code, whose WebFetch description says artifact links are fetchable through the claude.ai login, WebFetch returned the tidylearn page the way the Artifact tool does: its first 50,000 characters, with the whole file saved to disk. That call is not saved.
- `pandoc -f html -t gfm-raw_html` on the saved page gives an empty file, because the findings are built by script. The Markdown copy was made by rendering the page with `chrome --headless --dump-dom`, removing `<script>`, `<style>`, `<title>` and `<link>` elements, turning `<header>` and `<main>` into `<div>`, and converting with `pandoc -f html -t gfm-raw_html --wrap=none`. Pandoc 3.8.3 keeps only the contents of `<main>` when a page has one, which dropped the summary table until that element was renamed.

## An ordinary link

The paper's arXiv HTML page, given to a session as a link and read with WebFetch, which is what a pasted link to a public page goes through.

| Form | Tool calls | Text returned | Tokens added |
| --- | --- | --- | --- |
| The page saved and read with Read (from the paper's table) | 9 Read | the page | 101.8K |
| The link, offered only WebFetch | 2 WebFetch | 1,279 and 736 characters | 1.2K |

The raw run is `results/2026-09-17-sonnet-low-webfetch.json`.

- WebFetch hands the agent a smaller model's answer about the page, not the page. For a 189 KB page, that came to two answers of 2,015 characters in all.
- Asked to read the page in full, the agent replied "OK", as it did after reading whole files.
- On Claude Code 2.1.273 (`results/2026-09-17-sonnet-low-links-cc2.1.273.json`), two WebFetch calls returned 1,843 and 1,370 characters and added 1.6K. This time the agent declined to reply "OK", saying WebFetch had given it summaries and it could not honestly claim to have read the page.

Across all the documents, whatever enters the context is sent again on every later call in the session.

## What it does not show

- **Other documents.** A handful of real documents. The gap between formats depends on how much markup a page carries and how it was rendered. `measure.mjs` takes any files and links, so run it on your own.
- **Understanding.** The recall test checks whether exact paths survive. It says nothing about whether Claude understood a document's content.
- **Other tools.** Apart from the Quarto check, file sessions are offered only the Read tool.
- **A shared artifact.** Every artifact link was read by its owner. A reader it was shared with gets a summary, which is not measured.
- **Other public pages.** One page was read through WebFetch.
- **Other models.** Everything ran on Sonnet 5 at low effort.
- **Variation between runs.** The paper ran twice, the tidylearn artifact link offered Artifact and Read ran once more by hand, adding 46.4K, and the recall test ran each copy three times. Tokens added depend on what the tools return, and the saved runs record each call, so a re-run can be compared call by call.

## Check it

The paper and the review report were recorded on 16 September 2026, and everything else on 17 September, all on Claude Sonnet 5 at low effort, on Claude Code 2.1.272 except `results/2026-09-17-sonnet-low-links-cc2.1.273.json`. A session with no document offered only Read started at 15.5K to 15.7K tokens of context. Dollar figures are the list prices Claude Code reports; on a subscription they weight usage rather than add up to a bill.

Free, from the saved runs:

```sh
node experiments/doc-format/measure.mjs --report experiments/doc-format/results/2026-09-16-sonnet-low.json
node experiments/doc-format/measure.mjs --report experiments/doc-format/results/2026-09-16-sonnet-low-review-report.json
node experiments/doc-format/measure.mjs --report experiments/doc-format/results/2026-09-17-sonnet-low-quarto-tools.json
node experiments/doc-format/measure.mjs --report experiments/doc-format/results/2026-09-17-sonnet-low-artifact.json
node experiments/doc-format/measure.mjs --report experiments/doc-format/results/2026-09-17-sonnet-low-artifacts-small.json
node experiments/doc-format/measure.mjs --report experiments/doc-format/results/2026-09-17-sonnet-low-webfetch.json
node experiments/doc-format/measure.mjs --report experiments/doc-format/results/2026-09-17-sonnet-low-links-cc2.1.273.json
node experiments/doc-format/pdf-wrap.mjs --report experiments/doc-format/results/2026-09-17-pdf-wrap.json
node experiments/doc-format/recall.mjs --report experiments/doc-format/results/2026-09-17-sonnet-low-recall.json
node experiments/doc-format/recall.mjs --report experiments/doc-format/results/2026-09-17-sonnet-low-hyphens-filler-plain.json
node --test experiments/doc-format/measure.test.mjs experiments/doc-format/pdf-wrap.test.mjs experiments/doc-format/recall.test.mjs
```

The report prints the SHA-256 of each file measured, so a re-run can confirm arXiv served the same bytes.

Re-run the paper on your own Claude account. It downloads the paper, converts it, and runs five short sessions, which came to $1.09 at list price on 16 September 2026:

```sh
node experiments/doc-format/measure.mjs --documents experiments/doc-format/documents.json --out experiments/doc-format/results/<name>.json
```

Or measure your own files, with `--convert` for text versions of any HTML or PDF among them. The review report's four forms ran this way in five sessions, for $0.51:

```sh
node experiments/doc-format/measure.mjs report.md report.html report.pdf --out experiments/doc-format/results/<name>.json
```

A `https://claude.ai/artifact/<id>` link among them is read in two sessions, one offered the Artifact and Read tools and one offered only WebFetch. Any other `https` link is read in one session offered only WebFetch. Each tool set also gets a session with no document. The tidylearn artifact's three forms ran this way in seven sessions, for $0.74:

```sh
node experiments/doc-format/measure.mjs report.md report.html https://claude.ai/artifact/<id> --out experiments/doc-format/results/<name>.json
```

`--tools Read,Grep,Glob,Bash` offers file sessions more than Read, with Bash limited to `grep`, `head`, `tail`, `wc` and `cut`. The Quarto check ran that way.

`node experiments/doc-format/pdf-wrap.mjs --out experiments/doc-format/results/<name>.json` re-runs the path test. It spends nothing and needs pandoc and pdftotext. Each engine it cannot find is skipped: Chrome (`CHROME_BIN`), pdflatex, Typst (on PATH or through Quarto), LibreOffice (`SOFFICE_BIN`) and Word, which runs through COM on Windows only. It was recorded with pandoc 3.8.3, xpdf's pdftotext 4.00, Chrome 152, MiKTeX pdfTeX 4.23, Typst 0.15.1, LibreOffice 26.2 and Word 16. Poppler's pdftotext may join lines differently.

`node experiments/doc-format/recall.mjs --repeat 3 --out experiments/doc-format/results/<name>.json` re-runs the recall test on your own Claude account. It needs pandoc, pdftotext, Chrome and Typst to build and check its copies. The hyphen runs added `--copies short-pdf-chrome --repeat 8` with each `--text` (`findings`, `filler`) and `--framing` (`test`, `plain`); the other `--report` files are named in the same pattern.

`measure.mjs` was run on Node 24 and needs Claude Code, with pandoc and pdftotext on PATH for the conversions, and a Claude Code login that can open the artifact for a link. If Claude Code is installed as an npm `.cmd` shim on Windows, set `CLAUDE_BIN` to the full path of the executable, since Node cannot start a `.cmd` file without a shell. Each session is offered only the tools named above, and only those are allowed, so no permissions are bypassed. The Artifact tool can also publish and delete. The prompt asks only for a read, and the saved run records the action of every Artifact call. `--model` and `--effort` change the setting. Anthropic's pricing page says models from Claude 4.7 on use a newer tokenizer than earlier ones, which puts Sonnet 5 and Opus 5 on one tokenizer and Haiku 4.5 on the older one, so Haiku's counts for the same file differ.
