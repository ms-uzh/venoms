# venoMS

venoMS is migrating from a Hugo site plus standalone Go FRIOC calculator into one Cloudflare Workers application.

Markdown and assets remain the editorial source of truth:

- `content/` contains canonical Markdown.
- `static/` is the legacy Hugo asset source.
- `public/` contains Workers Static Assets, copied from `static/` plus generated `content/` and `data/`.
- `data/calc/` contains the imported calculator YAML and generated calculator JSON.
- `migrations/` contains the derived D1 search schema.
- `scripts/` generates synced assets, redirects, calculator data, search seed SQL, and validation reports.
- `src/` contains the Hono Worker, SSR renderer, search route, and calculator port.

## Local Development

Install dependencies:

```sh
npm install
```

Generate Worker types, sync content/assets, migrate local D1, and seed the search index:

```sh
npm run setup:local
```

Start the Worker locally:

```sh
npm run dev
```

Open `http://localhost:8787`.

## Common Commands

```sh
npm run prepare:assets
npm run validate
npm test
npm run build
npm run db:migrate
npm run db:seed
npm run smoke
npm run legacy:taxonomy
```

`prepare:assets` generates calculator JSON, content indexes, redirects, and `public/content/**`.

`validate` checks Markdown parsing, duplicate slugs, local asset references, content sync parity, and Workers Static Assets paid-plan limits.

`db:seed` builds `.generated/search-seed.sql` from Markdown and loads it into local D1. D1 is derived only; pages render from Markdown assets even if search is stale.

## Routes

- `/` home and search entry.
- `/<slug>` SSR Markdown page.
- `/search?q=...` D1 full-text search with facets.
- `/calc` FRIOC calculator.
- `POST /calc` uncached calculator result.
- `/img/**`, `/img_MSMS/**`, `/img_Rules/**`, `/pdf/**`, and `/csv/**` served directly from Workers Static Assets.

## Deployment

Before merging this migration, configure **Settings > Builds** for the `venoms` Worker with these commands:

- Build command: `npm run deploy:build`
- Production deploy command: `npm run deploy:production`
- Non-production deploy command: `npm run deploy:preview`

Workers Builds stores these commands in the Cloudflare project rather than `wrangler.jsonc`. The build command validates the app, applies D1 migrations, and seeds an inactive search version. The production deploy command uploads the Worker first and only then promotes that search version. Leaving the default `npx wrangler deploy` command in place would deploy the Worker without activating its new search index.

That misconfiguration is silent — pages render from static assets, so only search goes stale. `npm run check:search-version` compares the built content version against the live `meta.active_version` and fails loudly when they diverge; `npm run verify:deploy` runs the smoke checks against production and then that check. Run either after a production deploy.

`legacy:taxonomy` refreshes the committed legacy-route snapshot from `origin/gh-pages`; normal builds do not depend on that remote branch.
