# Luzz Monorepo

Tooling baseline

- Node: 22 (LTS). Recommended: 22.14.0
- pnpm: 10.14.0

Quick start

```sh
# install
pnpm i

# run any app in dev
pnpm -F @apps/dock dev
pnpm -F @apps/sail dev
pnpm -F @apps/hq dev

# build all (turbo)
pnpm -w build

# run frontend tests (Vitest projects)
pnpm test:fe

# optional
pnpm -w lint
pnpm -w typecheck

# format frontend apps (Svelte-aware Prettier)
pnpm format

# format backend API only
pnpm --filter api run format
```

Workspace structure (planned)

- apps/: Dock, Sail, HQ (SvelteKit)
- packages/: shared libs (api-sdk, auth, ui-tokens, ui-svelte, schemas, config)

Details: see `ops/FRONTEND_PLAN.md`.

Frontend build/deploy (GitHub Pages)

- All SvelteKit apps use `@sveltejs/adapter-static` with `prerender = true` in root layouts.
- `pnpm -F @apps/<name> build` writes static assets to `apps/<name>/build/`.
- GitHub Pages: use `.github/workflows/deploy-pages.yml`, which builds all apps and publishes under `/dock`, `/sail`, `/hq`. Each app uses `BASE_PATH` to set `paths.base` at build time and `fallback: '404.html'` for SPA routing.
- Enable Pages: Settings → Pages → Source: GitHub Actions. The workflow publishes automatically on merges to `main`.
- Local preview with base path:
  ```sh
  BASE_PATH=/dock pnpm -F @apps/dock preview
  BASE_PATH=/sail pnpm -F @apps/sail preview
  BASE_PATH=/hq pnpm -F @apps/hq preview
  ```
