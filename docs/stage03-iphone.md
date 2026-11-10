# Stage 03 — iPhone navigation and reference layout

Date: 2026-11-09. Branch: `audit/apple-ui-baseline-20261109`.
Parent / recovery point: `834475071509cc24a09a4d1d8f60740a68076722`.

## Scope

- Bottom navigation contains four destinations with persistent current-page feedback. Search is a separate thumb-reachable action; desktop Search remains a separate sidebar action. Full accessible link names are explicit, even when mobile labels are abbreviated.
- Mobile comparison tables become vertical word cards using the original table cells, headers and ordering. “Full comparison” toggles the original horizontal table. Desktop keeps the table. Explicit table roles preserve relationships when CSS changes display modes. Without JavaScript, the original table remains available.
- Polysemy summaries stay compact; meaning counts, part-of-speech labels, headings and bilingual examples have clearer spacing and size hierarchy. No meaning or example text was edited.
- Navigation, Search, close buttons, comparison toggles, disclosure summaries and normal controls have at least 44px target height. Navigation links also meet 44px width. Inline article word targets deliberately retain normal text flow rather than inserting 44px boxes into prose.
- Topbar height is measured for anchor clearance. Safe-area padding, a compact landscape navigation, visual-viewport dialog bounds and keyboard-aware navigation hiding address narrow and changing viewports. Mobile selects use 16px text. Existing reduced-motion rules and native disclosure behavior are retained.
- Selecting the current destination no longer resets scroll. One hash-change handler and manual history scroll restoration avoid duplicate Back/Forward position writes. Ordinary disclosure toggles do not explicitly scroll or focus. Search dismissal restores its previous scroll position; intentional search-result/paragraph navigation still reveals its target.

Only `interface.js`, `search.js` and `search.css` and their generated copies changed in production. All six HTML files, content data, URLs, anchor IDs, migration snapshots, build pipeline and deployment workflows remain byte-for-byte unchanged. No framework or runtime dependency was added.

## Repeatable checks

From the repository root:

```sh
python3 content/render.py
python3 scripts/audit_baseline.py --output /tmp/wordbook-stage03.json
python3 scripts/verify_design_tokens.py
git diff --check
```

For browser regression checks, copy `scripts/mobile-qa.html` to `dist/__qa.html`, serve `dist` locally, open `__qa.html` and choose **Run regressions**. The same harness can run in Safari. It checks six viewports, two themes, five page types, expanded reference content, card/table switching, navigation target sizes, separation of Search, disclosure scroll stability, history restoration, search results/dismissal and article lookup. Its controls also support manual inspection. Remove `dist/__qa.html` before running the integrity baseline or committing output; the clean-build gate intentionally rejects extra generated files. This harness is not published.

The viewport set is 320×568, 375×667, 390×844, 430×932, 844×390 and 1363×936. Desktop Chromium scrollbars reduce the inner document width by 15px; this is a responsive layout test, not hardware emulation. A full table need not overflow in landscape when there is sufficient space.

## Verification and limits

The 15-command baseline and all three integrity/reproducibility gates pass. The 48 solid-color contrast checks pass. Frozen learning data and preservation guards are unchanged; generated HTML is identical to the parent commit. Exact command output and browser results are summarized in `stage03-validation.json`.

Manual browser interaction confirmed 120px scroll remained 120px across expand, collapse, current-tab selection and returning to Meanings; Back returned Home to 0px and Forward restored Meanings to 120px. Mobile Search returned eight `credit` matches and closing restored 453px to 453px. Expanded light/dark layouts and the mobile card/full comparison control were inspected.

Safari and physical iPhone hardware are unavailable in this Linux environment. Real address-bar collapse, notch/home-indicator safe areas, virtual-keyboard pan/resize, pinch zoom, VoiceOver and OS Reduced Motion toggling still require device testing. VisualViewport and safe-area handling are implemented, but Chromium iframe checks cannot certify those Safari behaviors. Inline word Tab stops and unbounded search rendering remain the previously identified later-stage issues. No main merge, Pages deployment or Sites publication occurred.
