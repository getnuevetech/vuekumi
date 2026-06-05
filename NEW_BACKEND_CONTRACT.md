# VUEKUMI New Backend Contract

The old platform backend is replaced by the domain backend under `/api/v2/*`.

The existing admin backend is retained only as a temporary compatibility surface:

```txt
admin.html + admin.js -> /api/admin/*
```

Do not build new contributor, buyer, upload, payment, or public marketplace features against old non-admin `/api/*` paths. Those paths are wrappers for the current overlay and should be migrated away from.

## New backend boundaries

| Domain | Route prefix | Purpose |
| --- | --- | --- |
| Platform metadata | `/api/v2/platform` | Config, categories, country rules, integration readiness, API contract |
| OTP auth | `/api/v2/auth/otp/*` | Mobile phone OTP challenge and contributor session issuing |
| Contributors | `/api/v2/contributors/*` | Contributor profile, African eligibility, verification, paid access |
| Assets | `/api/v2/assets` | Image upload/listing and category posting enforcement |
| Orders/licenses | `/api/v2/orders`, `/api/v2/licenses` | Buyer checkout, payment readiness, license records |
| Integrations | `/api/v2/integrations` | Payment, payout, SMS provider readiness by configured key reference |

## New API routes

### Health

```txt
GET /api/v2/health
```

Returns the new API version, route contract, and notes about retained legacy admin compatibility.

### Platform

```txt
GET /api/v2/platform
GET /api/v2/config
GET /api/v2/integrations
```

### Contributor OTP

```txt
POST /api/v2/auth/otp/send
POST /api/v2/auth/otp/verify
```

`verify` returns a contributor bearer token. Use it as:

```txt
Authorization: Bearer <token>
```

### Contributor profile and access

```txt
GET /api/v2/contributors/me
PUT /api/v2/contributors/me
PATCH /api/v2/contributors/me
POST /api/v2/contributors/me/face-match
POST /api/v2/contributors/me/access
```

Enforced rules:

- contributors must be from admin-approved African countries
- profile completion requires email, address, profile photo, government ID, face match, and required agreements
- paid access that requires verification is blocked until profile completion passes

### Assets

```txt
GET /api/v2/assets
POST /api/v2/assets
```

Enforced rules:

- contributor token required for uploads
- admin-configured contributor category determines allowed photo categories
- starter upload limit applies before paid access
- low-quality uploads create AI enhancement jobs
- uploads with faces create face/copyright approval cases

### Orders and licenses

```txt
GET /api/v2/orders
POST /api/v2/orders
POST /api/v2/orders/:id/pay
GET /api/v2/licenses
```

Payment behavior:

- provider names and API key references remain admin-configurable
- payment authorization stays pending until the matching environment secret is loaded
- successful authorization creates a license record

## Retained old admin backend

These routes stay until the new admin backend exists:

```txt
POST /api/admin/login
GET /api/admin/overview
GET|PUT /api/admin/access
GET|POST /api/admin/users
PATCH /api/admin/users/:id
GET|POST /api/admin/content
PATCH /api/admin/content/:id
GET /api/admin/activity
```

## Temporary wrappers to remove later

These are not the new backend contract:

```txt
GET /api/state
PUT /api/state
GET /api/config
PUT /api/config
GET /api/integrations
POST /api/auth/send-otp
POST /api/auth/verify-otp
PUT /api/contributor
POST /api/contributor/face-match
POST /api/subscriptions/contributor
GET /api/uploads
POST /api/uploads
PATCH /api/uploads/:id/moderate
POST /api/uploads/:id/enhance
GET /api/checkout
POST /api/checkout
POST /api/checkout/:id/pay
```

They currently forward into the redesigned domain logic or support the existing overlay. Migrate the public frontend to `/api/v2/*`, then remove these wrappers.
