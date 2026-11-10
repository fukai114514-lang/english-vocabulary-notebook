# Stage 05 — desktop and English interface refinement

Date: 2026-11-10. Branch: audit/apple-ui-baseline-20261109.
Recovery parent: b0e0027fa11929ef5c60cf64a4d38d0bd805b4b6.

## Implementation

- Explicit desktop main/reader widths and centering, compact 220px sidebar at 761–1100px, horizontal collection cards in compact desktop windows, and three-column collections at larger widths. Sidebar scrolling is contained; search result focus and navigation hover states are clearer. Existing small-screen and short-landscape navigation are retained.
- Removed three duplicated light-color token bundles from responsive/increased-contrast rules. These repeated entire base palettes and could override system-dark colors. The normal light, explicit-dark and system-dark palette definitions remain; opacity fallbacks and increased-contrast opaque surfaces remain.
- Added IME composition and held-shortcut guards to Search. Command/Ctrl+K, result arrow navigation, Enter and Escape retain the existing matcher/anchors and scroll restoration.
- `content/ui-labels.json` is the authoritative legacy label catalog plus shared runtime strings. Python consumes this catalog and generates the embedded legacy lookup mapping and the runtime UI text object. The legacy key order is intentionally retained so the frozen index HTML does not change. Theme bootstrap still runs before paint; no runtime fetch or new dependency is needed.
- The English UI parser now skips learning subtrees (article paragraphs, table bodies/cells, senses, translations, English examples, definitions and captions). Added collision tests where actual learning text is identical to a UI label. UI calls reference catalog entries explicitly; no client-side text replacement traverses learning content.
- Nap article statistics now read “Original · A–T · 32 vocabulary items · 33 phrases”. Search uses singular/plural match labels. Chinese meanings, sentence translations, bilingual article translations and learning pronunciation labels remain learning data, not UI translation targets.

## Checks

Run the existing audit baseline, `python3 scripts/test_ui_labels.py`, `python3 scripts/verify_design_tokens.py`, and `git diff --check`.

The extended `scripts/reader-qa.html` is a reusable local browser harness. Copy it to `dist/__qa.html` after building; open it on the local preview and run regressions. Remove the dist copy before build/integrity checks. Never rebuild concurrently with the browser suite because the generator has intermediate output passes.

The matrix now includes 320, 375, 390, 430, 844 landscape, 900, 1024, 1363 and 1728px widths, light/dark and five page types. It retains reference and reader interaction checks and adds Command+K, arrows, Escape, Enter, IME Enter, explicit theme persistence across reload/article navigation, and system-theme persistence/palette checks. Browser evidence and baseline output are in stage05-validation.json.

## Boundaries

Only the nap article's UI statistics change in generated HTML. The frozen index, all learning data and source snapshots remain unchanged. No migration hashes were refreshed. All existing URLs and anchors remain. The English catalog centralizes legacy conversions and shared runtime labels; some older generator-specific English literals remain inline for a later scoped template cleanup. Legacy parser fallback still supports historical templates, so new learning containers should be marked/protected and tested rather than relying on global labels.

Validation uses Linux Chromium, not native macOS/Safari, VoiceOver or an Apple keyboard. The system-theme test follows the browser's current OS preference; live OS theme switching is not simulated. Actual speech availability and iPhone hardware restrictions from stage 04 remain. This stage does not change search ranking or bound very large result sets. No deployment, main merge or publication.
