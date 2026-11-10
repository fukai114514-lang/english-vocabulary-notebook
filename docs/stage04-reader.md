# Stage 04 — reading and contextual dictionary

Branch: audit/apple-ui-baseline-20261109. Parent/recovery point: f7045e81f31bf20e1b0fe291659c7ffb48f50b9a. Date: 2026-11-10.

## Changes

- A solid reading canvas, serif article titles, a 62ch maximum paragraph measure, calmer leading and paragraph spacing, and translations with a 16px minimum font. Existing 17/20/23px controls and persistence remain.
- One non-modal dictionary remains open across word changes. Mobile uses a bottom panel with stable height (42% of visual viewport, capped at 360px). Desktop positions a 400px floating panel near the word with viewport bounds. Close stays outside the internally scrolling definitions; mobile navigation is hidden while the panel is open.
- If the mobile panel covers the selected line, an exact excerpt from the source paragraph is displayed within the panel. This is a text slice, not a generated definition. No automatic article scrolling is introduced to make room.
- Stronger hierarchy for the headword, speech control/status, context/POS, Chinese meaning, English definition and additional senses. No entrance animation on the dictionary, including when switching words.
- Opening/dismissal preserve scroll and use preventScroll focus restoration. Escape returns to the latest word. Keyboard activation moves into the panel. Paragraphs/headings have a roving word Tab stop; Left/Right and Home/End select words, Enter opens definitions. Hidden keyboard instructions, dialog relationships and a polite headword announcement support assistive technology.
- Switching words or closing cancels existing speech. Existing accent selection and speech failure feedback remain. The lookup candidate order and curated contextual overrides are unchanged.

Only reader.js/search.css and their generated copies change production behavior. All six generated HTML pages, all article/translation/dictionary/index JSON, learning source files and preservation snapshots are unchanged. Independent article URLs, paragraph anchors, reading vocabulary and reference disclosure behavior are retained. No dependencies, deployment configuration or main branch changes.

## Repeatable validation

Run `python3 scripts/audit_baseline.py --output /tmp/reader-baseline.json`, `python3 scripts/verify_design_tokens.py`, and `git diff --check`.

For browser checks, copy `scripts/reader-qa.html` to `dist/__qa.html` after building, serve dist locally and press Run regressions. Do not rebuild while the browser suite runs: the multi-pass generator temporarily writes intermediate HTML. Remove the temporary dist file before integrity checks/committing. The harness runs the prior 60-layout matrix (six widths/orientations, light/dark, five views), plus scroll/disclosure/history/search checks and reader-specific assertions for persistent panel identity/geometry, bilingual definitions, Escape/focus, roving keyboard focus, translations, font changes and an exact curated `turn off` context. It is a local test artifact and is not shipped in dist.

## Limits

Validation uses Chromium on Linux, not physical iPhone/macOS Safari. Safe-area hardware, actual keyboard/toolbar resizing and VoiceOver need device checks. The speech button was activated manually: it entered Reading aloud then reported that speech was unavailable. Audible pronunciation could not be verified in this environment; error feedback was verified. Manual navigation from the article to Reading and browser Back restored the article. Light mobile and dark desktop dictionary positioning were checked. Inline words remain inline-size touch targets to preserve prose layout. The non-modal bottom sheet overlays the lower page; a selected-line excerpt provides context when necessary, and Close remains available without scrolling its content. No publication occurred.
