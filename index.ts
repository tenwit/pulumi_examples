import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

import { registerAutoTags } from "./autotag";

// Automatically inject tags.
registerAutoTags({
  "user:Project": pulumi.getProject(),
  "user:Stack": pulumi.getStack(),
  "Env": "PoC",
});

const vpc = new awsx.ec2.Vpc("PoC", {
  cidrBlock: "192.168.96.0/23",
  numberOfAvailabilityZones: 2,
  numberOfNatGateways: 0,
  subnets: [
    { type: "public", name: "bastion" },
    { type: "isolated", name: "private" }
  ]
});

export const vpc_poc_id = vpc.id;
export const vpc_poc_PrivateSubnetIds = vpc.privateSubnetIds;
export const vpc_poc_PublicSubnetIds = vpc.publicSubnetIds;