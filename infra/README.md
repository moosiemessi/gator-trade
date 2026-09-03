# Gator Trade infra

Standalone AWS CDK app, TypeScript, separate from the Next.js app in `src/`.
Deploys `GatorTradeStack` to `us-east-2`: an S3 bucket for post images
behind a CloudFront distribution using origin access control.

This stack does not create the presigned-upload code path or any IAM
users. It only provisions the bucket and distribution that step 10's
upload code will target.

## Prerequisites

- AWS credentials for the target account, available to the CLI (for
  example via `aws configure` or environment variables). Never commit
  credentials.
- Node.js and npm.

## Install

```
cd infra
npm install
```

## Bootstrap (once per account/region)

```
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-2
```

## Deploy

```
npm run synth   # cdk synth, sanity check the generated template
npm run diff    # cdk diff against what's currently deployed
npm run deploy  # cdk deploy
```

After deploy, take the `BucketName` and `DistributionDomainName` outputs
and set them as `S3_BUCKET_NAME` and `CLOUDFRONT_DOMAIN` in Amplify
environment variables (see `.env.example` at the repo root).

Do not set `AWS_REGION` in Amplify. Amplify reserves the `AWS_` prefix
and sets `AWS_REGION` itself at runtime, which already matches this
stack's `us-east-2`. `AWS_REGION` only needs to be set locally, in
`.env.local`.
