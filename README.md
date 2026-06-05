# VUEKUMI

VUEKUMI is a stock photo marketplace platform prototype with the supplied public website template and a protected local admin backend.

## Run Locally

```sh
npm start
```

Open:

- Public site: `http://localhost:4180/index.html`
- Admin backend: `http://localhost:4180/admin.html`

## Admin Access

Local development defaults:

- Identifier: `admin@vuekumi.local`
- Access key: `VUEKUMI-ADMIN-LOCAL`

For production, configure:

```sh
ADMIN_ACCESS_KEY=
ADMIN_TOKEN_SECRET=
ADMIN_TOKEN_TTL_MS=28800000
CONTRIBUTOR_TOKEN_SECRET=
CONTRIBUTOR_TOKEN_TTL_MS=604800000
OTP_TTL_MS=600000
```

## Platform Access Model

- The supplied public VUEKUMI visual template remains the public marketplace layout.
- Contributors start with mobile OTP verification and receive a contributor session token.
- Admin-configured contributor categories control which photo categories each contributor can post.
- Contributors from admin-approved African countries can upload the starter allocation first, then must complete deeper profile verification and paid access for more uploads.
- Admin backend APIs enforce role permissions for overview, access, users, content, and activity sections.
- Payment and SMS providers stay configurable by admin-managed API key references; live authorization waits for matching environment secrets.

## Checks

```sh
npm run check
```

## Notes

Runtime state is stored locally in `.data/` and is intentionally excluded from git. Live provider credentials should be supplied through environment variables and never committed.
