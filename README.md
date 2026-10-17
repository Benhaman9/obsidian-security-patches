# Obsidian security patch distributions

Reproducible, independently maintained security editions of four community
plugins. These are **not upstream releases**. Original authors and MIT licenses
are retained under `vendor/<plugin>/LICENSE`.

| Plugin baseline | Patch |
| --- | --- |
| Functionplot 1.2.1 | Reject string literals in the shared mathematical lexer before either JavaScript compiler. Numeric, implicit and interval plots remain supported. |
| Editing Toolbar 4.1.10 | Reconstruct approved inert HTML/SVG instead of adopting imported nodes. Remove active elements, event handlers and unsafe resource URLs; retain color tables and local SVG paint styles. |
| Dataview 0.5.68 | Require both general and inline JavaScript permissions in Live Preview, matching Reading View. |
| Numerals 1.10.2 | Limit each materialized range to 10,000 elements, including typed ranges, colon syntax and Range iteration. Larger ranges fail explicitly. |

## Build and verify

Node.js is required. `npm run build` verifies every immutable vendor bundle's
SHA-256 against `upstream-lock.json`, applies the narrowly checked transformations
in `src/harden.cjs`, and writes `dist/`. No download or dependency install is
needed for the build. A changed upstream boundary or digest stops the build.

`npm test` executes the actual graph compilers, the range allocator and permission
condition from the generated bundles. The DOM regression test also requires
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
your `data.json`. Each manifest identifies the edition with `+security.1`.
An upstream plugin update may replace these files; compare its fixes before
replacing the patched edition. Dataview remains disabled unless you enable it.

## Scope and remaining limits

These changes close the five-source-path review's four third-party findings;
the PDF parser fix is published separately in
[obsidian-pdf-digital-signature](https://github.com/Benhaman9/obsidian-pdf-digital-signature).
The Numerals guard bounds range materialization, not every mathjs computation or
matrix allocation. The DOM allowlist intentionally excludes active/custom HTML.
Plugins explicitly allowed to run scripts still run with Obsidian privileges.
No claim of complete sandboxing or absence of other vulnerabilities is made.
