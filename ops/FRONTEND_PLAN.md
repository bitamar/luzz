# Frontend architecture and TDD plan (SvelteKit + Bits UI)

## App names and scope

- **Dock**: for business owners/managers to run their location (formerly “studio owner”).
- **Sail**: for end customers/parents to manage children, bookings, invites (formerly “client”).
- **HQ**: for company-wide ops, auditing, configurations.

Alternatives you can swap later without breaking architecture:

- Dock → Port / Harbor / Marina
- Sail → Skiff / Dinghy / Ferry
- HQ → Beacon / Light / Tower / Core

Subdomains (example):

- `dock.yourdomain` → Dock
- `sail.yourdomain` → Sail
- `hq.yourdomain` → HQ

## Monorepo layout (pnpm + Turborepo)

```txt
/ (repo root)
- api/                                 # existing backend
- apps/
  - dock/                              # SvelteKit app
  - sail/                              # SvelteKit app
  - hq/                                # SvelteKit app
- packages/
  - api-sdk/                           # generated TS client from OpenAPI
  - auth/                              # shared auth/domain logic (cookies, guards)
  - auth-svelte/                       # Svelte helpers/hooks/components for auth UX
  - ui-tokens/                         # design tokens → CSS vars + TS types
  - ui-svelte/                         # your styled components (built on Bits UI)
  - schemas/                           # Zod schemas shared FE/BE
  - config/                            # runtime config loader
  - tsconfig/                          # base tsconfigs
  - eslint-config/                     # shared ESLint rules
- tooling/
  - turbo.json
  - pnpm-workspace.yaml
```

## Tech choices

- **Framework**: SvelteKit (SSR by default, disable CSR where you want ultra-light pages)
- **Components**: Bits UI (headless, accessible primitives)
- **Styling**: Vanilla Extract + CSS variables from `ui-tokens` (no Tailwind required)
- **Types/validation**: TypeScript + Zod
- **Data**: typed `api-sdk` from OpenAPI; use `event.fetch` on server loads/actions
- **Testing**: Vitest (unit), @testing-library/svelte (component), Playwright (E2E), contract tests for OpenAPI
- **Build/CI**: Turborepo + pnpm, per-app Docker images; Helm/Caddy for routing
- **Build tool routing (decision)**: Use Vite for build/dev/preview commands; use `svelte-kit` only for `sync`.
  - Each app must include `src/app.html` (SvelteKit 2 requirement) and set `tsconfig.json` to extend `./.svelte-kit/tsconfig.json`.
  - Root `vitest.config.ts` will define named projects so CI can filter reliably.

## Auth and sessions

- Backend issues httpOnly refresh + short-lived access token; cookie `Domain=.yourdomain`, `SameSite=Lax`, `Secure`.
- SvelteKit `hooks.server.ts` reads/refreshes session → sets `event.locals.user` and `roles`.
- Route guards in each app’s `+layout.server.ts` via shared helpers from `@luzz/auth`.
- Login is a redirect to backend (`/auth/google` etc.), then return with `returnTo` param.

## Data layer patterns

- Use `api-sdk` for client-side calls; on server, prefer `event.fetch` so cookies flow naturally.
- Start with SvelteKit `load` + form `actions` for CRUD; add state libs only for highly interactive views.

## Design system with Bits UI

- `ui-tokens`: define tokens (colors, spacing, radius, shadow, motion) → build CSS vars + TS types.
- `ui-svelte`: wrap Bits primitives into branded components (`Button`, `Field`, `Select`, `Dialog`, `Toast`, `Sheet`, `Tabs`).
- Theming: tokens via CSS vars; apps can override via data-attributes (e.g., dark mode) or brand scopes.

## Runtime config

- Serve an app-local `/config.json` (per subdomain) and load via `@luzz/config`.
- Shape example: `{ "API_BASE_URL": "https://api.yourdomain", "ENV": "prod" }`.

## Ultra-light invite flow (in Sail)

- Route: `src/routes/invite/[token]/` with `export const csr = false;` to avoid hydrating JS.
- Validate token and create account/child in `+page.server.ts` with form `actions` and Zod.
- Progressive enhancement: add a small island only if needed (code-split Svelte component).

---

## TDD plan

### Testing layers (from fast to slow)

1. **Unit (packages)**
   - Scope: pure functions, auth helpers, token parsing, schema validation, API client utilities.
   - Tools: Vitest + ts-node/tsup; 95–100% coverage target on small utilities.

2. **Component (apps + `ui-svelte`)**
   - Scope: Bits-based components (focus, keyboard nav), form widgets, dialogs.
   - Tools: @testing-library/svelte + Vitest; add `axe-core`/`vitest-axe` for a11y checks on key components.

3. **Integration (SvelteKit)**
   - Scope: route `load`/`actions` with mocked `api-sdk` and cookies; auth guards in `hooks.server`.
   - Tools: Vitest running SvelteKit in test mode; MSW (or SDK-level mocks) for HTTP.

4. **E2E (per app)**
   - Scope: critical journeys (login, invite accept, book slot, create slot, admin views).
   - Tools: Playwright; run against ephemeral test env seeded via existing `api/scripts/*`.

#### TDD workflow per story

- Define acceptance criteria as E2E specs first (Playwright) → expect failures.
- Drive route-level behavior with integration tests until green.
- Fill in component gaps with component tests (focus traps, a11y, edge UI states).
- Backfill/keep unit tests for shared logic and edge cases.

### CI and quality gates

- Pipelines per package/app with Turborepo caching.
- Gates:
  - Lint + typecheck must pass.
  - Unit + component + integration tests must pass with coverage ≥ 90% for `packages/*`, ≥ 80% for `apps/*`.
  - Playwright smoke suite must pass on PR (full E2E nightly).
  - Contract check: OpenAPI drift detection; regenerate `api-sdk` and fail if diff not committed.
- Vitest projects are named in `vitest.config.ts` and CI runs `pnpm test:fe` (or equivalent `--project` filters matching names).

### Test organization

```txt
packages/
  auth/__tests__/*.test.ts
  ui-svelte/src/**/*.test.tsx           # component tests
  api-sdk/__tests__/contract.test.ts    # SDK shapes vs OpenAPI
apps/
  dock/tests/e2e/*.spec.ts              # Playwright
  dock/src/**/__tests__/*               # component/integration
  sail/tests/e2e/*.spec.ts
  hq/tests/e2e/*.spec.ts
```

### Initial milestones (TDD-driven)

1. Workspace setup: Turborepo, pnpm, SvelteKit scaffolds, adapter-node, Vitest/Playwright setup.
   - Red: failing CI skeleton (no tests) → Green: minimal sanity test per app.
2. `ui-tokens` + `ui-svelte` base (Button, Input, Select, Dialog, Toast).
   - Start with component tests for focus/keyboard/a11y; then wire into a sample page.
3. Auth foundation: `@luzz/auth`, `@luzz/auth-svelte`, `hooks.server` guard, login redirect.
   - Integration tests for guard + role redirects; Playwright test for login flow.
4. Sail invite flow (no CSR): form validation, token verify, account/child creation.
   - E2E: open invite link → successful signup → redirect to dashboard; integration tests for actions.
5. Dock: slots CRUD with actions; optimistic UX optional later.
   - Component tests for form widgets; integration for actions; E2E happy path.
6. HQ: read-only dashboards → management tools next.
   - E2E smoke; integration tests for access control.

### Milestone 1 — Workspace setup (detailed checklist)

#### Repo and tooling

- [x] Ensure Node LTS (document in `.nvmrc`/`.node-version`)
- [x] Enable pnpm in repo (document version in `README`)
- [x] Add `pnpm-workspace.yaml` covering `apps/*` and `packages/*`
- [x] Add `turbo.json` with pipelines for build/test/lint/typecheck
- [ ] Add `turbo` as a root devDependency so `turbo build` works in scripts/CI
- [x] Root `README` section for dev setup and commands

#### Monorepo structure

- [x] Create directories: `apps/dock`, `apps/sail`, `apps/hq`, `packages/*`
- [x] Add `packages/tsconfig` with base `tsconfig.base.json`
- [x] Add `packages/eslint-config` and wire ESLint to use it
- [x] Add `packages/config` with runtime config types and a loader stub

#### SvelteKit apps scaffolding

- [x] Scaffold SvelteKit in `apps/dock`
- [x] Scaffold SvelteKit in `apps/sail`
- [x] Scaffold SvelteKit in `apps/hq`
- [x] Install `@sveltejs/adapter-node` in each app and configure `svelte.config.js`
- [x] Add `src/routes/+layout.svelte` with a minimal shell and `src/routes/+page.svelte` smoke
- [x] Add per-app `static/config.json` placeholder
- [x] Add `src/app.html` to each app (required by SvelteKit 2)
- [x] Update each app `tsconfig.json` to `extends: "./.svelte-kit/tsconfig.json"`

#### Shared UI/design scaffolding

- [ ] Create `packages/ui-tokens` with initial tokens JSON and build script to emit CSS vars + TS types
- [ ] Create `packages/ui-svelte` library with Bits UI as peer dep
- [ ] Add a minimal `Button` wrapper using tokens (component + story/example page in one app)

#### Testing (unit, component)

- [x] Add root `vitest.config.ts` with projects for `apps/*` and `packages/*`
- [ ] Add `name` for each project in `vitest.config.ts` (so CI filters match)
- [x] Ensure CI uses named project filters or `pnpm test:fe`
- [x] Add `@testing-library/svelte` setup for component tests
- [x] Add first unit tests in `packages/config`
- [ ] Add first unit tests in `packages/ui-tokens`
- [ ] Add first component test for `Button` in `packages/ui-svelte`
- [x] Add initial smoke tests in each app

#### Testing (integration, E2E)

- [ ] Add Playwright to repo with projects for Dock, Sail, HQ
- [ ] Add a smoke spec per app (open home page, check title)
- [ ] Document how to run E2E locally vs CI (baseURL/env)

#### CI setup

- [x] Add CI workflow to install pnpm, use cache, run frontend tests only
- [x] Update CI test step to run `pnpm test:fe` or align `--project` filters with named projects
- [ ] Enforce coverage thresholds (packages ≥ 90%, apps ≥ 80%)
- [ ] Add an E2E smoke job that runs Playwright headless (optional initially)

#### Scripts and DX

- [x] Root scripts: `build`, `dev`, `lint`, `typecheck`, `test`, `test:e2e`
- [ ] Pre-commit hooks (Husky + lint-staged) for lint/typecheck on changed files (optional)

#### Adapters, Docker, Helm (baseline)

- [ ] Verify `adapter-node` builds for all apps (after adding `src/app.html` and updating `tsconfig`)
- [ ] Add minimal Dockerfiles per app (Node runtime) and ignore files
- [ ] Note: Helm/Caddy routes to be added in a later milestone

#### Definition of done for Milestone 1

- [x] `pnpm i` works and `pnpm -w build` succeeds across workspace (requires `turbo` installed) or per-app `vite build` succeeds
- [x] `pnpm -w test` runs unit/component tests and produces coverage reports
- [x] Each app runs locally (`pnpm -F @apps/dock dev`, etc.) and shows a smoke page
- [x] CI pipeline runs: lint, typecheck, unit/component tests; optional E2E smoke
- [x] Each app contains `src/app.html` and extends `./.svelte-kit/tsconfig.json`

---

### Selected route now

- Proceed with multi-app SvelteKit 2 setup using Vite for build/dev.
- Immediately add `src/app.html` and update `tsconfig.json` in all apps to enable builds.
- Name Vitest projects in `vitest.config.ts` and update CI to use `pnpm test:fe` (or matching `--project` filters).
- Then continue Milestone 2 (`ui-tokens` + `ui-svelte`) before Auth, so shared UI is in place for all apps.

### Tooling specifics

- Vitest config shared in `packages/eslint-config` and base `vitest.workspace.ts`.
- Playwright projects per app; single command to run smoke across subdomains.
- MSW for SDK mocks in component/integration tests; real API only in E2E against seeded env.

### Naming in code

- Apps: `apps/dock`, `apps/sail`, `apps/hq`.
- Packages: `@luzz/ui-tokens`, `@luzz/ui-svelte`, `@luzz/auth`, `@luzz/auth-svelte`, `@luzz/api-sdk`, `@luzz/schemas`, `@luzz/config`.

---

If you prefer different names, we can swap them globally without changing any technical decisions.
