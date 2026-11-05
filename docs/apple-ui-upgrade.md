# Reference interface upgrade — 2026-11-05

## Result

A shared static design system and app shell replaces the published legacy style stack. Desktop uses a sidebar; narrow and short landscape viewports use a safe-area-aware bottom navigation. The homepage presents the three existing Parts, recent comparisons and an article entry. There are no tasks, points, accounts or new runtime dependencies.

Light/dark/system selection is applied before CSS and persisted. Glass is limited to controls and floating interfaces, with solid fallback and reduced transparency/motion support. Reading stays on a solid canvas with adjustable typography, paragraph navigation and existing inline/full translations.

Search retains the existing matcher and index, adds title-substring matches, a shared modal with keyboard navigation and Command/Ctrl+K, and routes all five articles correctly. Dictionary cards support context-aware placement, outside click/Escape dismissal, successive words without reopening, and device speech. Existing IPA fields are displayed if present; missing IPA was not fabricated or added to the learning data.

## Preservation

All published JSON was compared to the pre-upgrade snapshot and remained exactly equal. 136 comparison groups, 323 comparison rows / 318 unique word IDs, 74 polysemy words / 408 senses, five independent articles and 61 original/translated paragraphs are retained. Existing URLs and anchor IDs remain. Article tokenization preserves punctuation and whitespace, and is confined to readers.

## Changed source

- `content/interface.py`: shared HTML shell, homepage and reader wrapping.
- `content/interface.js`: navigation, state, themes and disclosure feedback.
- `content/theme.js`: pre-paint theme boot.
- `content/search.css`: unified tokens and component styles (replaces the old stylesheet).
- `content/search.js`: shared search dialog and complete article routing.
- `content/reader.js`: dictionary placement, closing, speech and keyboard behavior.
- `content/render.py`: final interface build stage.
- `scripts/verify_interface.py`, `scripts/verify_migration.py`: stronger preservation checks.
- `migration/ui-content-baseline.json`, `migration/reviewed-changes-3.0.json`: exact data baseline and reviewed presentation changes.
- Generated `dist/index.html`, five article HTML files, `search.css`, `search.js`, `reader.js`, `interface.js`, `pronunciation.js`.

The older content generators remain for stable learning markup and IDs. Their legacy inline CSS and scripts are discarded from published pages. Historical inactive learning-app source is retained and never loaded.

## Validation performed

- `python3 content/render.py`: pass; repeat build produces identical dist bytes.
- `python3 scripts/verify_migration.py`: pass, including exact frozen-data and paragraph checks.
- `python3 scripts/verify_preservation.py`: pass.
- `python3 scripts/verify_upgrade.py`: pass, every search target and indexed field.
- `python3 scripts/verify_article_dictionary.py`: pass, 1,346 distinct article tokens have bilingual definitions.
- `python3 scripts/verify_reading_context.py`: pass, contextual phrases and translation anchors.
- `node scripts/test_search.cjs`: pass, case/prefix/inflection/ranking and hostile input.
- `node --check` for interface, theme, reader, search, pronunciation: pass.
- Actual Chrome interactions: search/highlights/ArrowDown/Enter, word reveal, theme persistence after reload, disclosure (scroll Y remained 0), article navigation, lookup/continuous updates/Escape, empty results, mobile search Escape; no site-owned console errors observed.
- Responsive iframe viewports 320×568, 390×844, 430×932, 844×390 and 1024×768: no horizontal overflow; navigation fully in viewport. Desktop 1363px also inspected.
- A temporary `/english-vocabulary-notebook/` mount verified relative CSS/JS/data, reading links and lookup. Test harness and mount removed before publication.

## Limits

No physical iPhone or Mac Safari was available. Virtual keyboard, real safe-area insets, VoiceOver, pronunciation audio quality and a complete WCAG 2.2 AA audit remain unverified. The browser tests are Chrome tests, not Safari certification. Existing content review notes, including the incomplete source sentence in Motherhood, are preserved. No missing phonetic data was guessed.
