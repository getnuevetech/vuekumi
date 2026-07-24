#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-vuekumi-rebuild}"
STACK_NAME="${STACK_NAME:-${APP_NAME}-prod}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO="${ECR_REPO:-${APP_NAME}}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
TEMPLATE_FILE="${TEMPLATE_FILE:-../aws/vuekumi-ecs-fargate.yml}"
DESIRED_COUNT="${DESIRED_COUNT:-1}"
CPU="${CPU:-512}"
MEMORY="${MEMORY:-1024}"
CERTIFICATE_ARN="${CERTIFICATE_ARN:-}"

require() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  fi
}

require VPC_ID
require PUBLIC_SUBNET_IDS
require ADMIN_ACCESS_KEY

ADMIN_TOKEN_SECRET="${ADMIN_TOKEN_SECRET:-$(generate_secret)}"
CONTRIBUTOR_TOKEN_SECRET="${CONTRIBUTOR_TOKEN_SECRET:-$(generate_secret)}"
BUYER_TOKEN_SECRET="${BUYER_TOKEN_SECRET:-$(generate_secret)}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${APP_DIR}/.." && pwd)"
TEMPLATE_PATH="${APP_DIR}/${TEMPLATE_FILE}"
if [[ ! -f "${TEMPLATE_PATH}" ]]; then
  TEMPLATE_PATH="${REPO_ROOT}/aws/vuekumi-ecs-fargate.yml"
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text --region "${AWS_REGION}")"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
IMAGE_URI="${ECR_URI}:${IMAGE_TAG}"

if ! aws ecr describe-repositories --repository-names "${ECR_REPO}" --region "${AWS_REGION}" >/dev/null 2>&1; then
  aws ecr create-repository \
    --repository-name "${ECR_REPO}" \
    --image-scanning-configuration scanOnPush=true \
    --region "${AWS_REGION}" >/dev/null
fi

aws ecr get-login-password --region "${AWS_REGION}" |
  docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

docker build --platform linux/amd64 -t "${IMAGE_URI}" "${APP_DIR}"
docker push "${IMAGE_URI}"

aws cloudformation deploy \
  --region "${AWS_REGION}" \
  --stack-name "${STACK_NAME}" \
  --template-file "${TEMPLATE_PATH}" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    AppName="${APP_NAME}" \
    ContainerImage="${IMAGE_URI}" \
    VpcId="${VPC_ID}" \
    PublicSubnetIds="${PUBLIC_SUBNET_IDS}" \
    DesiredCount="${DESIRED_COUNT}" \
    Cpu="${CPU}" \
    Memory="${MEMORY}" \
    AdminAccessKey="${ADMIN_ACCESS_KEY}" \
    AdminTokenSecret="${ADMIN_TOKEN_SECRET}" \
    ContributorTokenSecret="${CONTRIBUTOR_TOKEN_SECRET}" \
    BuyerTokenSecret="${BUYER_TOKEN_SECRET}" \
    CertificateArn="${CERTIFICATE_ARN}"

aws cloudformation describe-stacks \
  --region "${AWS_REGION}" \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs" \
  --output table
