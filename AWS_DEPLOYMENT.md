# Deploy VUEKUMI on AWS

This AWS deployment runs the frontend and backend together as one containerized Node service:

- public site: `/`
- admin backend: `/admin.html`
- API: `/api/*`
- health check: `/api/health`

## Recommended AWS architecture

The repository includes CloudFormation for:

- Amazon ECR for the Docker image, created by the deploy script if missing
- Amazon ECS Fargate for the VUEKUMI container
- Amazon EFS mounted at `/data` for persistent backend state
- Application Load Balancer for public HTTP/HTTPS access
- CloudWatch Logs for container logs
- Security groups for ALB, ECS, and EFS

EFS is included because the current backend stores platform state in a JSON file. The container uses:

```txt
DATA_DIR=/data
```

## Prerequisites

Install and configure:

```sh
aws --version
docker --version
```

Authenticate AWS CLI:

```sh
aws configure
```

You also need:

- an AWS account with permissions for ECR, ECS, EFS, EC2 security groups, IAM roles, CloudFormation, CloudWatch Logs, and Elastic Load Balancing
- a VPC ID
- at least two public subnet IDs in that VPC
- optional ACM certificate ARN in the same region for HTTPS

## Required environment variables

```sh
export AWS_REGION=us-east-1
export VPC_ID=vpc-xxxxxxxx
export PUBLIC_SUBNET_IDS=subnet-aaaaaaa,subnet-bbbbbbb
export ADMIN_ACCESS_KEY='replace-with-a-strong-private-admin-key'
```

Optional:

```sh
export APP_NAME=vuekumi
export STACK_NAME=vuekumi-prod
export ECR_REPO=vuekumi
export IMAGE_TAG=$(git rev-parse --short HEAD)
export DESIRED_COUNT=1
export CPU=512
export MEMORY=1024
export CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/...
```

If you do not provide token secrets, the deployment script generates them for the CloudFormation deployment:

```sh
export ADMIN_TOKEN_SECRET=$(openssl rand -hex 32)
export CONTRIBUTOR_TOKEN_SECRET=$(openssl rand -hex 32)
export BUYER_TOKEN_SECRET=$(openssl rand -hex 32)
```

## Deploy

Run:

```sh
npm run deploy:aws
```

The script will:

1. create the ECR repository if it does not exist
2. build the Docker image for linux/amd64
3. push the image to ECR
4. deploy `aws/vuekumi-ecs-fargate.yml`
5. print CloudFormation outputs including the service URL

## Validate

After deployment, open:

```txt
http://<load-balancer-dns>/
http://<load-balancer-dns>/admin.html
http://<load-balancer-dns>/api/health
```

If `CERTIFICATE_ARN` was set, use HTTPS:

```txt
https://<load-balancer-dns>/
```

## First admin login

Identifier:

```txt
admin@vuekumi.local
```

Access key:

```txt
the ADMIN_ACCESS_KEY value used during deployment
```

## Domain setup

To use your own domain:

1. Create or validate an ACM certificate for the domain in the deployment region.
2. Redeploy with `CERTIFICATE_ARN`.
3. Create a Route 53 alias record pointing your domain to the ALB DNS name from CloudFormation outputs.

## Updating the app

After code changes:

```sh
export IMAGE_TAG=$(git rev-parse --short HEAD)
npm run deploy:aws
```

CloudFormation updates the ECS task definition and rolls the service to the new image.

## Notes

- The CloudFormation template uses public subnets with public task IPs for simplicity.
- For a stricter production network, place ECS tasks in private subnets with NAT and keep only the ALB public.
- Provider API keys such as Stripe, Paystack, Flutterwave, Termii, and verification services are still supplied as environment variables or can be moved to AWS Secrets Manager in a future hardening pass.
