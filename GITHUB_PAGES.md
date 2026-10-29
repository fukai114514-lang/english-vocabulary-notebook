# GitHub Pages deployment

The site is generated from `content/` using Python 3.12. Push the full repository contents (including `.github/workflows/pages.yml`) to the `main` branch. In repository Settings > Pages, set Source to **GitHub Actions**. The workflow builds `dist/`, verifies content integrity, and deploys it.

Expected project site: https://fukai114514-lang.github.io/english-vocabulary-notebook/ (only after successful deployment).

For GitHub Free, switch the repository to Public only after checking that it contains no secrets or private material. Keep the source files and `migration/content-baseline.json` together. Future content edits require an explicitly reviewed baseline update to pass the integrity gate.

This project uses in-page hash navigation, not history-based client routes. Do not add a blanket SPA rewrite. Site availability in mainland China is not guaranteed.
