# Stage 02 — Apple-inspired design system

Continues `audit/apple-ui-baseline-20261109` from `4e0677e4a76fe0e9392c63d8020efb34c490e3ee`. This stage changes presentation only and does not deploy. Stage 01 snapshots and migration guards remain byte-identical.

## Changes

- Expanded semantic colors for light/dark/system: text, surfaces, accent, control borders, focus, hover, pressed, accent-button text, warm and sage collection icons. The two dark-mode CSS paths use identical colors; existing pre-paint theme selection and persistence are retained.
- Established named UI/reading font families, type sizes, weights, leading, spacing, radii, shadows, control height and blur. Converted the former 20-line compressed stylesheet to readable component rules, with existing responsive and accessibility overrides retained. No CSS compiler, UI framework or new runtime dependency.
- Refined homepage typography, solid collection cards and their spacing, sidebar brand and selection state, reading canvas, search result hit areas, buttons and disclosure feedback. Theme changes avoid the low-contrast intermediate background interpolation observed during QA.
- Narrow bottom navigation now shows “Compare” and “Meanings” while retaining full accessible link names. Labels no longer split “Comparisons” over several lines. Decorative arrows use CSS chevrons, avoiding missing arrow glyphs on the preview host.
- Unified hover/press/focus/selected/open states. Selected navigation remains distinguishable from hover; disabled controls don't get hover styling. Search and lookup close controls use matching feedback. Existing short entrance animations, immediate dismissal, Escape and focus behavior remain; reduced-motion rules remain in force.
- Glass remains confined to the top navigation, mobile navigation, search dialog and lookup card. Reading, cards, vocabulary explanations, examples and tables are solid. Opaque fallback, reduced-transparency and increased-contrast rules remain.
- Promoted each article's primary title to h1 and updated the reading-title lookup selector so title words remain clickable. No title text, learning text, order, stable IDs, article URLs or search records changed.

References: Apple HIG [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). Books informs the reading surface, Dictionary the definition hierarchy, and Notes the restrained navigation. This is a static web implementation, not native Liquid Glass or Dynamic Type.

## Verification

Run from the repository root:

```sh
python3 scripts/audit_baseline.py --output /tmp/wordbook-stage02.json
python3 scripts/verify_design_tokens.py
git diff --check
```

The existing 15-command baseline and all three additional integrity/reproducibility gates pass. All frozen learning files and migration snapshots are unchanged. An additional HTMLParser comparison against the stage 01 commit confirmed identical visible text-node sequence across all six published HTML pages. All five readers have a single h1. No refresh of preservation hashes was needed.

The new contrast check covers 48 solid foreground/background combinations. Text pairs meet 4.5:1; control-border/focus pairs meet 3:1. Lowest ratio across all pairs is 3.51:1 (a control-border pair). It also checks explicit dark/system-dark token parity. Translucent compositing against arbitrary content is not covered by this numeric check; screenshots of light/dark navigation and dark search were inspected.

Browser validation used local Cloud Chrome and a temporary same-origin iframe harness, which was removed before final checks. Viewports: 320×568, 390×844, 430×932, 844×390, 1024×768 and 1363×936. Home, comparisons, meanings, reading directory and the nap reader were checked in both themes: 60 cases, zero page overflow or navigation-bounds failures. View readiness and requested theme were awaited before measurement. Iframe widths include the desktop browser scrollbar and do not simulate touch hardware.

Additional checks: 320px expanded comparison table remained 680px wide inside its 241px horizontal scroller with no page overflow; mobile dark productivity lookup showed both definitions and closed with Escape; mobile dark search returned eight credit results and its dialog stayed inside the viewport. System theme persisted after reload and followed this browser's light OS setting; explicit dark also persisted after reload. Desktop home, mobile home, dark reader and dark search were visually inspected. Full evidence summary, file hashes and command outputs: `stage02-validation.json`.

## Remaining work / boundaries

Physical iPhone/macOS Safari, VoiceOver, virtual keyboard, true safe-area insets, 200% zoom and live OS switching to dark were not tested. Static dark parity is not a substitute for that OS-switch test. No claim of complete WCAG compliance or performance certification.

Stage 01's per-word Tab-stop issue, unbounded search rendering, CI-list duplication and multi-pass generator architecture remain for later scoped work. This visual stage did not change keyboard navigation, search ranking, data loading or deployment workflows. Main, Pages and Sites were not updated. Stop after this commit; do not automatically begin the next stage.
