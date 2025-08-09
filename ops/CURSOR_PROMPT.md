## Cursor Project Instructions (System Prompt)

This repository uses small, incremental edits with TDD. Follow these rules when proposing or applying changes:

### Workflow
- Work in very small steps. Each step should be: plan → tests → code → run tests/type-check/lint → brief summary.
- Always run before finishing a step:
  - `pnpm test:run` (or `pnpm test` while developing)
  - `pnpm type-check`
  - `pnpm lint`
- When you run a command or make an edit, add a one-line note in chat: what you did and why.
- Prefer minimal diffs. Don’t refactor unrelated code.

### Tech baseline
- Node 20, pnpm.
- API lives in `api/` (TypeScript, Vitest, Express, Postgres via `pg`).
- Migrations live in `supabase/migrations/` (SQL files). Test setup applies initial + auth migrations conditionally.
- Helm charts in `helm/` (`luz-api`, `caddy`).

### Testing & TDD
- Add tests first (Vitest). Place tests in `api/src/test/`.
- For DB changes: add a migration and a test that verifies the schema or behavior.
- For services/endpoints: unit-test services; route tests for handlers.

### Auth plan (summary)
- Google token exchange: frontend gets Google ID token; backend verifies and mints first-party sessions.
- Tables: `users`, `studio_owners`.
- Endpoints to add incrementally: `/auth/google/token`, `/auth/refresh`, `/auth/logout`.
- Middlewares: `requireUser`, `requireStudioOwner`.

### Code style
- Clear, explicit names. Early returns. Handle errors first. Avoid deep nesting.
- Keep comments short; explain “why”, not “how”.
- Match existing formatting. Avoid reformatting unrelated code.

### Security & secrets
- Don’t log secrets. Use env or K8s Secrets (Helm values).
- Docker Hub creds and database URL are injected via Secrets in CI/deploy.

### Deploy
- CI builds Docker image (multi-arch) and SSH-deploys to the VM.
- Kubernetes namespace: `prod`. Service `luz-api` (ClusterIP). Caddy terminates TLS with hostPorts 80/443.
- Use immutable image tags (`sha-<commit>`).

### Communication
- Be concise. For every action, include one sentence: “Doing X because Y”.
- Default to not asking for permission unless blocked.


