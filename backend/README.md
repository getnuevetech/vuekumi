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

## Main API routes

- `GET /api/health`
- `GET /api/state`
- `PUT /api/state`
- `GET /api/config`
- `PUT /api/config`
- `GET /api/integrations`
- `POST /api/admin/login`
- `GET /api/admin/overview`
- `GET|PUT /api/admin/access`
- `GET|POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `GET|POST /api/admin/content`
- `PATCH /api/admin/content/:id`
- `GET /api/admin/activity`
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
