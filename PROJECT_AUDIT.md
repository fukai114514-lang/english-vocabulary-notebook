# Project audit — 2026-10-26

- Source: `content/base.html`, `content/comparisons.txt`, `content/english-captions.txt`, `content/selection-notes.txt`, `content/pronunciation.js/css`, `content/render.py`; generated output: `dist/index.html`.
- Stack: static HTML/CSS/JavaScript, Python standard-library generator. No package manager, framework, server database, lint, typecheck, or automated test script in the original project. Hosting manifest: `.openai/hosting.json`.
- Baseline: 108 numbered groups, 266 group-word appearances, 261 distinct spellings. Repeated across groups: arrange, deputy, immense, contract, staff. These are valid relationships, not redundant groups.
- Original interactions: search, fold/unfold, recent filter, comparison tables, browser speech synthesis and accent setting. Only the accent preference uses localStorage; no existing learning records or IndexedDB schema.
- Format: pipe-delimited records with five fields and separate one-line English definitions and group notes; rich content is embedded in base HTML. No IPA, verified dictionary provenance, or review status. Content fields have uneven coverage.
- Recovery: Git tag `checkpoint-before-2.0`; archive `backups/pre-2.0-source.tar.gz`. The original numbered groups and source records must remain intact.
- Default decisions: static, local-first progressive enhancement; unverified IPA and exam tags remain empty rather than invented. Repeated spellings share a stable word ID and retain all group memberships.

## Content audit — 2026-10-27

Read all 112 comparison groups, their selection notes, English captions and inherited prose. This is a consistency/content review, not a claim that every dictionary sense has been exhaustively certified.

14 revised groups: 2, 6, 9, 19, 40, 42, 43, 64, 77, 81, 87, 109, 111, 112. Added approximate in group 40; retained all group IDs, old word IDs and memberships. 277 group-word rows remain in 112 groups. Recovery tag: checkpoint-before-content-audit-20261027.

Corrections include dive's financial-fall sense, clip's hit/glancing-collision sense, revolve's axial rotation, approximate versus approximately word classes, non-absolute foresee guidance, intent versus motive, and complete inherited prose for wheel/fireplace/relentless. Replaced a misleading precision/resolution example. Country guidance now allows constituent-country use. Group-specific structured entries preserve distinct senses of repeated words (contract, staff, etc.). Existing nonempty examples retained. Build rejects disagreements between source tables and structured meanings, definitions, notes, collocations and examples.

Dictionary evidence consulted via retrieved dictionary entries (some full-page requests returned 403):
- https://dictionary.cambridge.org/dictionary/english/dive — sharp decrease in value.
- https://dictionary.cambridge.org/dictionary/english/clip — hit sense.
- https://dictionary.cambridge.org/us/dictionary/english-german/revolve — rotation around a central point or axis.
- https://dictionary.cambridge.org/dictionary/english/approximate — adjective and verb.
- https://dictionary.cambridge.org/dictionary/english/intent — aim/intention.
- https://dictionary.cambridge.org/dictionary/english/foresee — anticipation of an event.
- https://dictionary.cambridge.org/dictionary/learner-english/relentless — continuation without easing.
- https://dictionary.cambridge.org/us/grammar/british-grammar/word-choice-country-land-nation-or-state — usage comparison.

Validation: generator and structured-data checks passed; all previous IDs/memberships retained; JavaScript syntax passed; no task/quiz UI included. Browser QA confirmed 14-group filter and dive search/expand rendering. iPhone Safari and device audio were not directly tested.
