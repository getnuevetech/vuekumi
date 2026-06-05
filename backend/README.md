# VUEKUMI Backend

Run from the project root:

```sh
npm start
```

The backend serves the VUEKUMI marketplace and API at:

```txt
http://localhost:4180
```

Main API routes:

- `GET /api/health`
- `GET /api/state`
- `PUT /api/state`
- `GET /api/config`
- `PUT /api/config`
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

The current integrations are provider-ready local adapters. Real SMS, payment, ID verification, facial recognition, AI enhancement, file storage, and payout providers can be connected behind these routes once provider credentials are available.

See `../LIVE_INTEGRATION_REQUIREMENTS.md` for the live provider checklist and `../.env.example` for the expected credential references.
