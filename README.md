# Obsidian security patch distributions

Reproducible, independently maintained security editions of seven community
plugins. These are **not upstream releases**. Original authors and MIT licenses
are retained under `vendor/<plugin>/LICENSE`.

| Plugin baseline | Patch |
| --- | --- |
| Functionplot 1.2.1 | Reject string literals before either compiler; reject invalid factorial arguments and return floating-point overflow immediately above 170. |
| Editing Toolbar 4.1.10 | Reconstruct approved inert HTML/SVG instead of adopting imported nodes. Remove active elements, event handlers and unsafe resource URLs; retain color tables and local SVG paint styles. |
| Dataview 0.5.68 | Require both JavaScript permissions in Live Preview. Execute DQL regex functions through a bounded nonbacktracking engine. |
| Numerals 1.10.2 | Limit ranges to 10,000 elements. Check dense/sparse constructors, resize, random, diagonal, multiplication, Kronecker product, concatenation and broadcast shapes before their reviewed allocations. |
| Tasks 8.5.0 | Execute query filter regexes through the same bounded engine. |
| Advanced Tables 0.23.2 | Reject source and destination formula ranges above 10,000 cells before materialization. |
| Excalidraw 2.29.0 | Bound compressed scene decoding in both the main bundle and worker. |

## Build and verify

Node.js is required. Run `npm ci --ignore-scripts`, then `npm run build`. The build verifies every immutable vendor bundle's
SHA-256 against `upstream-lock.json`, applies the narrowly checked transformations
in `src/harden.cjs`, and writes `dist/`. Acorn is pinned for static source-boundary recognition. A changed upstream boundary or digest stops the build.

`npm test` executes actual bundle paths for graph compilers, matrices, table formulas and worker decoding, plus regex differential/budget tests and the permission condition. The DOM regression test also requires
Playwright and a Chromium browser: set `SECURITY_PLAYWRIGHT` to its module path
(or install it locally), and optionally `SECURITY_CHROMIUM` to the executable.

The upstream repositories and inspected source revisions are recorded in the
lock file. The pinned **distribution bytes**, rather than a fresh upstream build,
are the baseline: this avoids importing unrelated unreleased changes. All changed
executable logic is visible in the transformation source. Vendor files contain
plugin code and static assets only; vault settings and user content are excluded.

## Install

Close Obsidian and copy `main.js`, `manifest.json` and, when present, `styles.css`
from one `dist/<plugin>/` directory into the existing plugin directory. Preserve
your `data.json`. Also copy `LICENSE` and `RE2JS-LICENSE` where present. Each manifest identifies its edition with `+security.N`.
An upstream plugin update may replace these files; compare its fixes before
replacing the patched edition. Dataview remains disabled unless you enable it.

## Scope and remaining limits

These editions retain the earlier fixes and address six third-party availability findings from the October 17 scan;
the PDF parser fix is published separately in
[obsidian-pdf-digital-signature](https://github.com/Benhaman9/obsidian-pdf-digital-signature).
The Numerals budget is 10,000 elements, rank 8, and 20,000 nested array slots at the checked boundaries. It does not bound every mathjs computation, repeated expression or total session memory. The DOM allowlist intentionally excludes active/custom HTML.
Plugins explicitly allowed to run scripts still run with Obsidian privileges.
No claim of complete sandboxing or absence of other vulnerabilities is made.

### Bounded regex compatibility

Dataview and Tasks bundle MIT-licensed RE2JS 2.8.6, pinned by digest in `regex-engine-lock.json`, with reviewed UTF-16, legacy case-folding and line-terminator adaptations. Native `RegExp` is used only to validate JavaScript grammar, never to execute supplied patterns. Common captures, replacements, split, Unicode and cursor behavior have differential tests. This is a restricted regex dialect: lookaround, backreferences, Unicode property escapes and some legacy/character-class escapes fail explicitly instead of falling back to a backtracking engine. Existing queries using these features need simpler patterns. Full JavaScript regex equivalence is not claimed. Dataview and Tasks require Obsidian 1.8.7 or later for the bundled engine.

Budgets: 2,048 pattern characters, 10,000 compiled instructions, 64 capture groups, 1 MiB input, 64 Mi instruction/character work estimate, 10,000 matches and 16 MiB replacement output. Excess work raises an error. Excalidraw decoding separately allows 16 Mi input characters, 32 Mi output characters, 262,144 dictionary entries, 64 Mi dictionary characters and 64 Mi decoding bit steps; budgets apply per decode, not across a whole session.
