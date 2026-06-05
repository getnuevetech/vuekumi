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
```

## Checks

```sh
npm run check
```

## Notes

Runtime state is stored locally in `.data/` and is intentionally excluded from git. Live provider credentials should be supplied through environment variables and never committed.
