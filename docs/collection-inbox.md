# TAsLEXICON Collection Inbox

The candidate adds a stand-alone `inbox/` route. Build with `python3 content/render.py` and `python3 content/collection_inbox.py`, then serve with `python3 -m http.server 8000 --directory dist`; then open `http://localhost:8000/inbox/`. In a repository-scoped site it is relative to the existing site root. All existing public pages keep their routes and content. This route is intentionally independent of the public site’s navigation and search index.

Import an extension JSON archive, inspect new items and duplicate/conflict statuses, then confirm the preview. The Inbox allows private edits, review acceptance, rejection with confirmation, sorting, filtering, and re-export. A private review acceptance stays on that browser. Transfers preserve the normalized records; acceptance state is local to this Inbox.

## Mapping

| Collection target | Existing website relationship | Private conversion and any editorial prerequisites |
| --- | --- | --- |
| Vocabulary | Word Comparisons | Individual words stay in Inbox. A public comparison requires an editorial group, alternatives, usage notes and examples. |
| Phrases | Phrases | Maps to `phrase`, `meaningZh`, `definitionEn`, and bilingual `examples`. A future editor supplies the ID and usage fields. |
| Collocations | Collocations | Maps to `phrase`, `meaningZh`, and `excerpt`. A future editor verifies the website article ID and paragraph anchor. The renderer checks the excerpt against that paragraph. |
| Word Meanings | Word Meanings | Explicitly selected words map to `word`, `notes`, and individual sense fields. A future editor verifies IDs and review metadata. |
| Articles | Reading | Maps to ordered text blocks, title, author, date and source. A separate editorial workflow requires rights, article ID and stable paragraph anchors. |

Word Families, Word Patterns, Phrasal Verbs, Common Mistakes, Register & Tone, Idioms & Expressions and Pronunciation Lab retain their existing content contracts. This phase leaves them available in the public site and uses the established Inbox targets for incoming drafts.

## Boundaries

- IndexedDB database `taslexicon-website-collection-inbox` is private to the browser profile and origin. It is independent of extension storage and persists until the user removes records or clears site data.
- The standalone route loads only packaged scripts and CSS and disallows network connections through CSP. Same-origin JavaScript is trusted by the browser’s storage model, so a future release must preserve the existing site’s same-origin security.
- Imported text is validated and rendered as text. The separate Inbox build copies a fixed list of UI assets into `dist/inbox/`. It does not read browser data or exported archives.
- Private items and article full text flow only through explicit user-managed JSON files. The website has no sync service, write API, repository credentials or public publish action.

## Verify

Run `python3 scripts/audit_baseline.py` for the existing content, anchors, search index and clean rebuild. Run `python3 scripts/test_integration_browser.py` with Python Playwright for the website UI regressions. The extension’s Chromium suite can drive this exact build with `INBOX_DIST=/path/to/dist/inbox`.

The public renderer and frozen content manifest remain byte-identical. The validation gate runs the two builds independently in both the checkout and a clean temporary directory. The candidate does not modify the Pages workflow.

The website rollback tag `website-before-extension-integration` refers to `17795450973b124b22558f0c7d8bca520b4911ef`.
