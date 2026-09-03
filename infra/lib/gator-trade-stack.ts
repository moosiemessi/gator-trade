import { CfnOutput, Duration, Stack, StackProps } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

const AMPLIFY_ORIGIN = "https://main.d1ylz90b9t7gnv.amplifyapp.com";
const LOCAL_DEV_ORIGIN = "http://localhost:3000";

export class GatorTradeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const postImagesBucket = new s3.Bucket(this, "PostImagesBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          expiration: Duration.days(400),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: [AMPLIFY_ORIGIN, LOCAL_DEV_ORIGIN],
          allowedHeaders: ["*"],
        },
      ],
    });

    const distribution = new cloudfront.Distribution(this, "PostImagesDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(postImagesBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    });

    new CfnOutput(this, "BucketName", {
      value: postImagesBucket.bucketName,
      description: "S3 bucket holding post images",
    });

    new CfnOutput(this, "DistributionDomainName", {
      value: distribution.distributionDomainName,
      description: "CloudFront domain to read post images from",
    });
  }
}
