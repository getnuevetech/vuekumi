# VUEKUMI Standalone Rebuild

This branch contains a separate rebuild under:

```txt
standalone/
```

It is intentionally isolated from the current application. The current app can keep running while this standalone rebuild is developed, tested, and deployed to a separate AWS service.

## Move it to a completely separate GitHub repo

Create an empty GitHub repo first, for example:

```txt
getnuevetech/vuekumi-standalone
```

Then run this from the current repo root:

```sh
bash scripts/export-standalone-repo.sh ../vuekumi-standalone git@github.com:getnuevetech/vuekumi-standalone.git
```

Or with an HTTPS remote:

```sh
bash scripts/export-standalone-repo.sh ../vuekumi-standalone https://github.com/getnuevetech/vuekumi-standalone.git
```

The script creates a clean repo containing only the standalone app files:

```txt
package.json
server.js
Dockerfile
public/
scripts/
.env.example
.gitignore
README.md
```

If you do not pass a remote URL, the script creates the local Git repo only and prints the commands to add a remote later.

## What is different

- Separate Node app: `standalone/server.js`
- Separate public frontend source: `standalone/public/index.html`, `app.js`, `styles.css`
- Separate admin backend/source: `standalone/public/admin.html`, `admin.js`, `admin.css`
- Separate local port: `4280`
- Separate local data file: `standalone/data/state.json`
- Separate Docker build context: `standalone/`
- Separate AWS defaults:
  - `APP_NAME=vuekumi-rebuild`
  - `STACK_NAME=vuekumi-rebuild-prod`
  - `ECR_REPO=vuekumi-rebuild`

## Run locally

```sh
cd standalone
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

## Admin-managed frontpage

The public frontpage is dynamic. Admin controls:

- navigation
- hero section
- section order
- enabled/disabled sections
- category strip
- masonry/asset selections
- contributors section
- plans
- footer
- SEO text
- assets shown publicly

Use:

```txt
/admin -> Frontpage
```

## Deploy standalone rebuild to AWS

This deploys a new stack and does not overwrite the current `vuekumi` service.

```sh
cd standalone
export AWS_REGION=us-east-1
export VPC_ID=vpc-xxxxxxxx
export PUBLIC_SUBNET_IDS=subnet-aaaaaaa,subnet-bbbbbbb
export ADMIN_ACCESS_KEY='new-standalone-admin-key'
npm run deploy:aws
```

Optional values:

```sh
export APP_NAME=vuekumi-rebuild
export STACK_NAME=vuekumi-rebuild-prod
export ECR_REPO=vuekumi-rebuild
export IMAGE_TAG=$(git rev-parse --short HEAD)
export CERTIFICATE_ARN=arn:aws:acm:...
```

After deploy, CloudFormation prints a new Load Balancer URL. This is separate from the current app URL.

## Important

Do not run the root deployment command if you want to keep the old app untouched:

```sh
npm run deploy:aws
```

For the standalone rebuild, run deployment from:

```txt
standalone/
```
