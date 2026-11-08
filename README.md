# Stoneledge Luxury Homes — client portal

This site is Stoneledge's own layer on top of the shared portal engine
([teesheetapp/portal-engine](https://github.com/teesheetapp/portal-engine)).

| File | What it is |
|---|---|
| `index.html` | Page shell. Loads the engine at a fixed version (change `@v1.0.0` in two places to upgrade) |
| `settings.js` | Everything Stoneledge: brand, words, phases, draws, warranty, team duties, glossary, features, theme, sign-in, pages |
| `theme.css` | Stoneledge-only styling (loads after the engine, so it wins) |
| `logos/` | Logos, app icons |
| `manifest.webmanifest` | Home-screen app name and icon |

Features, database, and email live in the engine repository. See its README for how customization works
and how to set up a new builder.
