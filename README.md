# Luzz Monorepo

Tooling baseline

- Node: 22 (LTS). See `.nvmrc` and `.node-version` (current dev: 22.14.0)
- pnpm: 10.3.0

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

# run tests (vitest projects)
pnpm vitest run

# optional
pnpm -w lint
pnpm -w typecheck
```

Workspace structure (planned)

- apps/: Dock, Sail, HQ (SvelteKit)
- packages/: shared libs (api-sdk, auth, ui-tokens, ui-svelte, schemas, config)

Details: see `ops/FRONTEND_PLAN.md`.
