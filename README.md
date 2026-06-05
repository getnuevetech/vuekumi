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
BUYER_TOKEN_SECRET=
BUYER_TOKEN_TTL_MS=604800000
OTP_TTL_MS=600000
```

## Deploy Online

The frontend and backend deploy together as one Node web service. See [DEPLOYMENT.md](./DEPLOYMENT.md) for Render, Docker, and generic Node-host instructions.

For AWS, use the ECS Fargate + EFS deployment in [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md).

## Platform Access Model

- The supplied public VUEKUMI visual template remains the public marketplace layout.
- Contributors start with mobile OTP verification and receive a contributor session token.
- Admin-configured contributor categories control which photo categories each contributor can post.
- Contributors from admin-approved African countries can upload the starter allocation first, then must complete deeper profile verification and paid access for more uploads.
- Admin backend APIs enforce role permissions for overview, access, users, content, and activity sections.
- Payment and SMS providers stay configurable by admin-managed API key references; live authorization waits for matching environment secrets.

## Backend Direction

The old platform backend has been replaced by the new `/api/v2/*` backend contract. The existing admin backend remains available at `/api/admin/*` only until a new admin backend is built. See [NEW_BACKEND_CONTRACT.md](./NEW_BACKEND_CONTRACT.md).

## Checks

```sh
npm run check
```

## Notes

Runtime state is stored in `DATA_DIR` and is intentionally excluded from git. Use a persistent disk for online deployments. Live provider credentials should be supplied through environment variables and never committed.
