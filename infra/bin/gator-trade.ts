#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { GatorTradeStack } from "../lib/gator-trade-stack";

const app = new App();

new GatorTradeStack(app, "GatorTradeStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-2",
  },
});
