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

Frontend build/deploy (static-first)

- All SvelteKit apps use `@sveltejs/adapter-static` with `prerender = true` in root layouts.
- `pnpm -F @apps/<name> build` writes static assets to `apps/<name>/build/`.
- Deploy options:
  - CDN: upload `build/` to object storage (e.g., S3/GCS) fronted by a CDN.
  - k3s: serve `build/` from a tiny static container (NGINX/Caddy) per app and route via Caddy.
