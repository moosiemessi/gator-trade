// CLOUDFRONT_DOMAIN is server-only (SPEC.md section 9, no NEXT_PUBLIC
// prefix). Safe to read from any server component or next.config.ts, but
// must never be imported from a client component.
export function getCloudFrontDomain(): string {
  const domain = process.env.CLOUDFRONT_DOMAIN;
  if (!domain) {
    throw new Error("CLOUDFRONT_DOMAIN is not set");
  }
  return domain;
}

export function postImageUrl(s3Key: string): string {
  return `https://${getCloudFrontDomain()}/${s3Key}`;
}
