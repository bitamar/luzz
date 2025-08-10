# Luzz Monorepo

Tooling baseline

- Node: 22 (LTS). See `.nvmrc` and `.node-version` (current dev: 22.14.0)
- pnpm: 10.3.0

Quick start

```sh
pnpm i
pnpm -w build
```

Workspace structure (planned)

- apps/: Dock, Sail, HQ (SvelteKit)
- packages/: shared libs (api-sdk, auth, ui-tokens, ui-svelte, schemas, config)

Details: see `ops/FRONTEND_PLAN.md`.
