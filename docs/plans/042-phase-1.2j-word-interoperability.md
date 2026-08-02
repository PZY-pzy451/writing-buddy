# Phase 1.2J — Word interoperability

Updated: 2026-08-02

## Outcome

Remove the remaining document-format blocker between an author's existing
workflow and Writing Buddy. Authors can safely import a local `.docx` outline
or manuscript, review the extracted text before project creation, and export a
complete work as a structured Word document from History.

## Priority decision

The comparison uses a normalized cohort of 100 target authors per quarter.
There is no production analytics baseline, so confidence is deliberately kept
at or below 60%. RICE is `Reach × Impact × Confidence ÷ Effort`.

| Candidate | Lens | RICE calculation | Score |
| --- | --- | --- | ---: |
| DOCX import plus whole-work delivery | Blocker | `85 × 2 × 0.60 ÷ 2` | 51 |
| Daily writing goal | Enabler | `75 × 1 × 0.50 ÷ 1.5` | 25 |
| One-click whole-work consistency pass | Enabler | `45 × 2 × 0.60 ÷ 3` | 18 |
| Scene plot grid | Enabler | `55 × 2 × 0.60 ÷ 4` | 16.5 |

DOCX interoperability is selected because it is both the highest RICE item
and a blocker: without it, Word-first authors must manually convert material
before entering Writing Buddy and cannot hand a familiar editable document to
an editor after writing.

## Gate A — bounded DOCX import

- Extend the existing native chooser with `.docx` while retaining Markdown and
  plain-text support.
- Treat a Word file as an untrusted ZIP container. Limit archive size,
  extracted XML size and entry count before parsing `word/document.xml`.
- Reject encrypted, malformed, empty or oversized documents and documents
  without a readable main body.
- Extract visible body text only. Preserve paragraph boundaries, tabs and line
  breaks without executing macros, relationships or embedded content.
- Return only the selected file name, format, byte count and extracted text;
  never persist the external source path.

## Gate B — truthful review and atomic creation

- Reuse the existing deterministic outline/manuscript preview and atomic
  staging transaction for extracted Word text.
- Label Word sources clearly and state that images, comments, footnotes,
  tracked changes and layout are not imported.
- For outline import, preserve the extracted original text as an internal text
  copy rather than claiming to preserve the original Word container.
- Keep cancellation and every validation failure write-free.

## Gate C — structured whole-work Word export

- Add a dedicated structured export request containing work, volume and
  chapter titles plus chapter bodies; do not reconstruct structure by parsing
  a Markdown export.
- Generate a standards-compatible `.docx` package with title, Heading 1 volume
  headings, Heading 2 chapter headings and Normal body paragraphs.
- XML-escape all author content, strip internal scene anchors and avoid
  duplicate opening chapter headings.
- Validate counts, titles and total content size before writing through the
  existing atomic-save path.
- Record an export receipt only after a successful save. Dialog cancellation
  and save failure must not produce a success receipt.

## Gate D — writer-centered UI and release

- Make `导出 Word 文档` the single primary History delivery action. Keep
  Markdown and plain text as secondary choices.
- Disable the active async action, keep errors adjacent to the action, use
  visible keyboard focus, at least 44 px targets and no narrow-window overflow.
- Cover DOCX ZIP/XML generation and parsing, Word preview/import, successful
  export, cancellation, dirty-save failure and receipt behavior.
- Run lint, TypeScript, all Vitest suites, production build, Rust tests, full
  self-test, Tauri/NSIS packaging and native executable smoke before release.

## Security and compatibility limits

- Import supports modern `.docx` only; legacy `.doc`, PDF, EPUB and
  password-protected/encrypted documents remain unsupported.
- Import is text-only. Images, comments, footnotes, headers/footers, equations,
  tracked-change history, styles and exact pagination are intentionally not
  reproduced.
- Export targets an editable, structured manuscript, not pixel-identical print
  layout or advanced publishing typography.
- No AI is used to infer missing headings, rewrite imported content or repair a
  malformed Word package.
