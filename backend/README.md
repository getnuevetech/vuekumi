# VUEKUMI Backend

Run from the project root:

```sh
npm start
```

The backend serves the VUEKUMI marketplace and API at:

```txt
http://localhost:4180
```

## Architecture

The backend is organized around the platform requirements instead of a single prototype state blob:

- `defaults.js` - VUEKUMI platform defaults, user categories, roles, contributor rules, provider key references, plans, and seeds.
- `store.js` - local JSON persistence, schema normalization, old-state migration, and audit helpers.
- `auth.js` - admin/contributor/buyer token helpers and OTP generation.
- `platform.js` - domain policies for African contributor eligibility, category posting rules, starter limits, verification, uploads, orders, licenses, and provider readiness.
- `server.js` - HTTP router, static serving, and API route groups.

## New backend API routes

The new backend contract lives under `/api/v2/*`. New frontend, contributor, buyer, mobile, and future admin work should use this namespace.

- `GET /api/health`
- `GET /api/v2/health`
- `GET /api/v2/platform`
- `GET /api/v2/config`
- `GET /api/v2/integrations`
- `POST /api/v2/auth/otp/send`
- `POST /api/v2/auth/otp/verify`
- `GET /api/v2/contributors/me`
- `PUT|PATCH /api/v2/contributors/me`
- `POST /api/v2/contributors/me/face-match`
- `POST /api/v2/contributors/me/access`
- `GET /api/v2/assets`
- `POST /api/v2/assets`
- `GET /api/v2/orders`
- `POST /api/v2/orders`
- `POST /api/v2/orders/:id/pay`
- `GET /api/v2/licenses`
- `POST /api/v2/admin/login`
- `GET /api/v2/admin/dashboard`
- `GET|PUT /api/v2/admin/access`
- `GET|PUT /api/v2/admin/config`
- `GET|POST /api/v2/admin/users`
- `PATCH /api/v2/admin/users/:id`
- `GET /api/v2/admin/contributors`
- `GET|POST /api/v2/admin/assets`
- `PATCH /api/v2/admin/assets/:id`
- `POST /api/v2/admin/assets/:id/enhance`
- `GET /api/v2/admin/commerce`
- `GET|PUT /api/v2/admin/integrations`
- `GET /api/v2/admin/activity`

## New admin backend

The new admin backend UI is:

```txt
/admin-v2.html
/admin-v2
/new-admin
/command-center
```

It uses `/api/v2/admin/*` and manages platform dashboard, access, users, contributors, content moderation, commerce, integrations, and activity.

## Legacy admin backend retained

The existing admin backend is intentionally preserved as a fallback while the new admin backend is reviewed:

- `POST /api/admin/login`
- `GET /api/admin/overview`
- `GET|PUT /api/admin/access`
- `GET|POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `GET|POST /api/admin/content`
- `PATCH /api/admin/content/:id`
- `GET /api/admin/activity`

These routes support `admin.html` and `admin.js`.

## Temporary public compatibility wrappers

The old non-admin public API routes are transition wrappers over the new backend domain handlers so the current public overlay can keep working while it is migrated:

- `GET /api/state`
- `PUT /api/state`
- `GET /api/config`
- `PUT /api/config`
- `GET /api/integrations`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `PUT /api/contributor`
- `POST /api/contributor/face-match`
- `POST /api/subscriptions/contributor`
- `GET /api/uploads`
- `POST /api/uploads`
- `PATCH /api/uploads/:id/moderate`
- `POST /api/uploads/:id/enhance`
- `GET /api/checkout`
- `POST /api/checkout`
- `POST /api/checkout/:id/pay`

Data is stored locally at:

```txt
.data/vuekumi-state.json
```

## Enforced backend rules

- Admin APIs require signed admin tokens and per-section permissions.
- Contributor APIs require OTP-issued contributor tokens.
- Contributors must be from admin-approved African countries.
- Contributor categories determine which photo categories each user can post.
- OTP-verified contributors can upload the configured starter allocation first.
- Deeper profile verification and paid access are required for higher upload limits.
- Human-face uploads generate face/copyright approval cases.
- Below-threshold uploads generate AI enhancement jobs.
- Payment and SMS providers are configurable by key reference; live authorization waits for the matching environment secret.

See `../LIVE_INTEGRATION_REQUIREMENTS.md` for the live provider checklist and `../.env.example` for the expected credential references.
