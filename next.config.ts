import type { NextConfig } from "next";

// CLOUDFRONT_DOMAIN is unset for local dev without AWS configured
// (.env.example ships it empty) — remotePatterns just omits the entry
// rather than crashing the build.
const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: cloudfrontDomain
      ? [
          {
            protocol: "https",
            hostname: cloudfrontDomain,
            pathname: "/posts/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
