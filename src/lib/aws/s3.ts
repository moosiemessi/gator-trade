import { S3Client } from "@aws-sdk/client-s3";

// Region comes from AWS_REGION, which Amplify sets automatically at
// runtime and .env.local sets for local dev (SPEC.md section 9). Server
// only — this must never be imported from a client component.
export const s3Client = new S3Client({ region: process.env.AWS_REGION });

export function getPostImagesBucketName(): string {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error("S3_BUCKET_NAME is not set");
  }
  return bucket;
}
