#!/usr/bin/env bash
set -euo pipefail

DEST_DIR="${1:-}"
REMOTE_URL="${2:-}"

if [[ -z "${DEST_DIR}" ]]; then
  echo "Usage: bash scripts/export-standalone-repo.sh <destination-directory> [new-github-repo-url]" >&2
  echo "Example: bash scripts/export-standalone-repo.sh ../vuekumi-standalone git@github.com:getnuevetech/vuekumi-standalone.git" >&2
  exit 1
fi

if [[ ! -d "standalone" ]]; then
  echo "Run this script from the root of the current vuekumi repository." >&2
  exit 1
fi

if [[ -e "${DEST_DIR}" && -n "$(ls -A "${DEST_DIR}" 2>/dev/null || true)" ]]; then
  echo "Destination exists and is not empty: ${DEST_DIR}" >&2
  exit 1
fi

mkdir -p "${DEST_DIR}"

copy_file() {
  local source="$1"
  local target="$2"
  mkdir -p "$(dirname "${DEST_DIR}/${target}")"
  cp "${source}" "${DEST_DIR}/${target}"
}

copy_file "standalone/package.json" "package.json"
copy_file "standalone/server.js" "server.js"
copy_file "standalone/Dockerfile" "Dockerfile"
copy_file "standalone/scripts/deploy-aws-standalone.sh" "scripts/deploy-aws-standalone.sh"

mkdir -p "${DEST_DIR}/public"
cp standalone/public/* "${DEST_DIR}/public/"

cat > "${DEST_DIR}/.gitignore" <<'GITIGNORE'
.DS_Store
node_modules/
.env
.env.*
!.env.example
data/
.data/
GITIGNORE

cat > "${DEST_DIR}/.env.example" <<'ENVEXAMPLE'
NODE_ENV=development
PORT=4280
DATA_DIR=data
STATE_FILE=

ADMIN_ACCESS_KEY=
ADMIN_TOKEN_SECRET=
CONTRIBUTOR_TOKEN_SECRET=
BUYER_TOKEN_SECRET=
TOKEN_TTL_MS=28800000

STRIPE_SECRET_KEY=
PAYSTACK_SECRET_KEY=
FLUTTERWAVE_SECRET_KEY=
TERMII_API_KEY=
HUBTEL_API_KEY=
AFRICASTALKING_API_KEY=

AWS_REGION=us-east-1
APP_NAME=vuekumi-rebuild
STACK_NAME=vuekumi-rebuild-prod
ECR_REPO=vuekumi-rebuild
IMAGE_TAG=
VPC_ID=
PUBLIC_SUBNET_IDS=
ADMIN_ACCESS_KEY=
CERTIFICATE_ARN=
ENVEXAMPLE

cat > "${DEST_DIR}/README.md" <<'README'
# VUEKUMI Standalone

Standalone rebuild of the VUEKUMI African stock photo platform.

## Run locally

```sh
npm install
npm start
```

Open:

```txt
http://localhost:4280/
http://localhost:4280/admin
http://localhost:4280/api/health
```

Local admin login:

```txt
Identifier: admin@vuekumi.local
Access key: VUEKUMI-STANDALONE-LOCAL
```

## Deploy to AWS

This deploys to a separate ECS/Fargate stack by default:

```txt
APP_NAME=vuekumi-rebuild
STACK_NAME=vuekumi-rebuild-prod
ECR_REPO=vuekumi-rebuild
```

```sh
export AWS_REGION=us-east-1
export VPC_ID=vpc-xxxxxxxx
export PUBLIC_SUBNET_IDS=subnet-aaaaaaa,subnet-bbbbbbb
export ADMIN_ACCESS_KEY='new-standalone-admin-key'
npm run deploy:aws
```
README

chmod +x "${DEST_DIR}/scripts/deploy-aws-standalone.sh"

(
  cd "${DEST_DIR}"
  git init
  git add .
  git commit -m "Initial VUEKUMI standalone rebuild"
  if [[ -n "${REMOTE_URL}" ]]; then
    git branch -M main
    git remote add origin "${REMOTE_URL}"
    git push -u origin main
  fi
)

echo "Standalone repository created at: ${DEST_DIR}"
if [[ -n "${REMOTE_URL}" ]]; then
  echo "Pushed to: ${REMOTE_URL}"
else
  echo "No remote URL supplied. Add one with:"
  echo "  cd ${DEST_DIR}"
  echo "  git remote add origin <new-github-repo-url>"
  echo "  git branch -M main"
  echo "  git push -u origin main"
fi
