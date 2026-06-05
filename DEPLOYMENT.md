# Deploy VUEKUMI Online

VUEKUMI deploys as one Node web service. The same process serves:

- the public frontend template at `/` and `/index.html`
- the admin frontend at `/admin.html`
- the backend API under `/api/*`

## Required production environment variables

Set these before running with `NODE_ENV=production`:

```txt
NODE_ENV=production
PORT=10000
DATA_DIR=/data
ADMIN_ACCESS_KEY=<strong private admin login key>
ADMIN_TOKEN_SECRET=<random 32+ character secret>
CONTRIBUTOR_TOKEN_SECRET=<random 32+ character secret>
BUYER_TOKEN_SECRET=<random 32+ character secret>
ADMIN_TOKEN_TTL_MS=28800000
CONTRIBUTOR_TOKEN_TTL_MS=604800000
BUYER_TOKEN_TTL_MS=604800000
OTP_TTL_MS=600000
```

Optional live-provider variables can be added when integrations are ready:

```txt
STRIPE_SECRET_KEY=
PAYSTACK_SECRET_KEY=
FLUTTERWAVE_SECRET_KEY=
NG_PAYSTACK_SECRET=
GH_FLW_SECRET=
KE_MPESA_SECRET=
ZA_OZOW_SECRET=
RW_FLW_SECRET=
TERMII_API_KEY=
HUBTEL_API_KEY=
AFRICASTALKING_API_KEY=
CLICKATELL_API_KEY=
KYC_PROVIDER_API_KEY=
FACE_MATCH_API_KEY=
AI_IMAGE_ENHANCEMENT_API_KEY=
CONTENT_MODERATION_API_KEY=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
CDN_HOSTNAME=
EMAIL_PROVIDER_API_KEY=
```

## Persistent data

The backend stores platform state in JSON. For online deployment, `DATA_DIR` must point to a persistent disk/volume.

- Local default: `.data/vuekumi-state.json`
- Recommended production path: `/data/vuekumi-state.json`

If the host provides one exact writable file path instead of a directory, set `STATE_FILE`.

## Deploy on Render

This repo includes `render.yaml`.

1. Push the branch to GitHub.
2. In Render, choose **New > Blueprint**.
3. Select this repository.
4. Render will create one web service named `vuekumi`.
5. Set `ADMIN_ACCESS_KEY` when prompted.
6. Let Render generate the token secrets.
7. Deploy.

Render settings from `render.yaml`:

- build command: `npm install`
- start command: `npm start`
- health check: `/api/health`
- persistent disk: `/data`

After deployment:

- public site: `https://<your-render-domain>/`
- admin backend: `https://<your-render-domain>/admin.html`
- health check: `https://<your-render-domain>/api/health`

## Deploy with Docker

Build:

```sh
docker build -t vuekumi .
```

Run:

```sh
docker run --rm -p 4180:4180 \
  -e NODE_ENV=production \
  -e PORT=4180 \
  -e DATA_DIR=/data \
  -e ADMIN_ACCESS_KEY="$ADMIN_ACCESS_KEY" \
  -e ADMIN_TOKEN_SECRET="$ADMIN_TOKEN_SECRET" \
  -e CONTRIBUTOR_TOKEN_SECRET="$CONTRIBUTOR_TOKEN_SECRET" \
  -e BUYER_TOKEN_SECRET="$BUYER_TOKEN_SECRET" \
  -v vuekumi-data:/data \
  vuekumi
```

## Deploy on AWS

Use ECS Fargate with EFS persistence and an Application Load Balancer:

```sh
npm run deploy:aws
```

See [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) for AWS prerequisites, environment variables, CloudFormation details, SSL/domain setup, and update workflow.

## Deploy on Railway/Fly/other Node hosts

Use the same runtime values:

- Node: `>=20`
- build: `npm install`
- start: `npm start`
- health path: `/api/health`
- persistent volume mounted to `DATA_DIR`

## First admin login

The seeded admin identifier is:

```txt
admin@vuekumi.local
```

Use the production `ADMIN_ACCESS_KEY` you configured in the host dashboard.

Change seeded users and platform rules from the admin backend after first login.
