## Authentication and Authorization Plan (Token Exchange, Google OIDC)

This plan defines how we add Google sign‑in across multiple frontends by posting Google ID tokens to the API, which verifies and mints first‑party sessions.

### Current state (as of now)

- API key middleware in `api/src/middleware/auth.ts`:
  - `requireApiKey`, `optionalAuth`, `rateLimit`, `requestLogger`.
- Routing in `api/src/server.ts`:
  - Public: `GET /health`, `/public/*` (e.g., slots, invite booking).
  - Protected: `/studios`, `/customers`, `/children`, `/invites`, `/bookings`, `/admin` (API key).

### Goals

- Google sign‑in for users (studio owners/managers).
- Keep public flows (e.g., invite‑based booking) without login.
- Support many frontends/domains (children classes, barbers, etc.).
- Replace API key auth gradually with JWT‑based user sessions.

### High‑level model (Option B: Token Exchange)

1. Frontend obtains a Google ID token (One Tap / OAuth PKCE), per frontend’s own UX.
2. Frontend `POST /auth/google/token { idToken }` to the API.
3. API verifies Google ID token (issuer, audience ∈ allowed client IDs, signature, expiry, email_verified).
4. API upserts `users` row; issues:
   - Access token (short‑lived JWT, e.g., 15m) returned in body or as cookie.
   - Refresh token (httpOnly, Secure cookie, e.g., 30d) set on response.
5. Protected endpoints require `Authorization: Bearer <access>` (or cookie).
6. `POST /auth/refresh` to rotate access using the refresh cookie.
7. `POST /auth/logout` to revoke/clear refresh token.

### Data model changes

- `users` (table)
  - `id uuid primary key default gen_random_uuid()`
  - `google_sub text unique not null` (stable Google subject id)
  - `email text` (nullable if not provided)
  - `name text`, `avatar_url text`
  - `is_admin boolean default false`
  - `created_at timestamp with time zone default now()`
- `studio_owners` (table)
  - `studio_id uuid references studios(id) on delete cascade`
  - `user_id uuid references users(id) on delete cascade`
  - `role text check (role in ('owner','manager')) not null default 'owner'`
  - `created_at timestamptz default now()`
  - composite unique `(studio_id, user_id)`
- Optional (if server‑managed refresh sessions): `user_sessions`
  - `id uuid`, `user_id uuid`, `refresh_token_hash text`, `expires_at timestamptz`, `created_at timestamptz`, `revoked_at timestamptz`

### Secrets and configuration

- `GOOGLE_CLIENT_IDS` (comma‑separated allowlist for multiple frontends)
- `JWT_SECRET` (for HS256) or keypair if using RS256/EdDSA
- `ACCESS_TOKEN_TTL` (e.g., `15m`), `REFRESH_TOKEN_TTL` (e.g., `30d`)
- Cookie settings: `COOKIE_DOMAIN`, `SECURE_COOKIES=true`, `SAMESITE=None`
- CORS: allow your web origins; expose `Authorization`; allow credentials if using cookies

### New endpoints (backend)

- `POST /auth/google/token` → body `{ idToken: string }`
  - Verify Google ID token and audience ∈ `GOOGLE_CLIENT_IDS`
  - Upsert `users` (by `google_sub`)
  - Mint access JWT and httpOnly refresh cookie
  - Response: `{ accessToken, user: { id, email, name, avatarUrl, isAdmin } }`
- `POST /auth/refresh` (cookie‑based)
  - Verify refresh; rotate; return new access token
- `POST /auth/logout`
  - Revoke/clear refresh cookie (and DB session if stored)

### Middleware

- `requireUser` (access JWT verification):
  - Validates JWT, sets `req.user = { userId, isAdmin }`
  - 401 on failure
- `requireStudioOwner`:
  - Checks `studio_owners` for `(studioId, userId)`; 403 if missing
- Transition policy: for a limited time allow either API key or user JWT (to ease migration) on select routes.

### Route protection policy

- Public (no login):
  - `GET /public/:slug/slots?week=YYYY-WW`
  - `POST /public/invites/:hash/bookings`
- Auth required (user):
  - `POST /studios` (create studio)
  - `POST/PUT/DELETE /studios/:studioId/*` with `requireStudioOwner`
  - `POST/PUT/DELETE /customers`, `/children` as appropriate
- Admin only: `/admin/*` later via `is_admin`

### Libraries

- Verify Google ID tokens: `google-auth-library` (Node) or `jose`
- JWT signing/verify: `jsonwebtoken` or `jose`

### Implementation steps (TDD for each)

1. SQL schema
   - Add migrations for `users`, `studio_owners` (and optional `user_sessions`).
   - Tests: migration loads; constraints and uniqueness hold.
2. Token verification utility
   - `verifyGoogleIdToken(idToken, allowedClientIds)` using Google certs.
   - Tests: valid token (mock/stub), bad aud, expired, malformed.
3. JWT service
   - `signAccessToken(user)`; `verifyAccessToken(token)`; refresh helpers.
   - Tests: issuance, expiry claim, validation failures.
4. `/auth/google/token`
   - Upsert user by `google_sub`; return access + set refresh cookie.
   - Tests: new user upsert, existing user update, invalid token → 401.
5. `requireUser` middleware
   - Reads `Authorization: Bearer` (or cookie), validates, sets `req.user`.
   - Tests: valid/invalid/missing.
6. Protect `POST /studios` with `requireUser`
   - Tests: 401 when unauthenticated; 201 when authenticated.
7. `studio_owners` + `requireStudioOwner`
   - Add an owner on studio create; enforce on `PUT/DELETE` studio routes.
   - Tests: owner can, non‑owner 403.
8. Refresh/logout
   - `POST /auth/refresh` rotates access using refresh cookie.
   - `POST /auth/logout` clears refresh; revocation if stored.
   - Tests: refresh success/failure paths; logout clears cookie.
9. Transition: allow API key OR JWT on selected endpoints (temporary)
   - Feature flag/timeline to remove API key later.

### Testing strategy

- Unit tests (Vitest): services (Google verify stub), JWT, middleware.
- Route tests: happy/error flows for new endpoints and protected routes.
- Minimal integration: create studio flow end‑to‑end under test env.

### Operational notes

- CORS and cookies: in production, use HTTPS (already in place via Caddy); set `SameSite=None; Secure`.
- Secrets management: add `GOOGLE_CLIENT_IDS`, `JWT_SECRET` to deployment values/secrets.
- Key rotation: plan to rotate `JWT_SECRET` by overlapping validation keys (future).

### Rollout plan

1. Ship `/auth/google/token` and `requireUser`; protect only `POST /studios` initially.
2. Add `studio_owners` and apply `requireStudioOwner` to management routes.
3. Add refresh/logout.
4. Gradually phase out API key on non‑public endpoints.
