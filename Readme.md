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

The GitHub workflow runs Node/Wrangler CI. Production deploys apply D1 migrations, seed D1 from generated Markdown SQL, then deploy the Worker.
