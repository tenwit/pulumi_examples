import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

import { registerAutoTags } from "./autotag";
import { PamsVpc } from "./PamsVpc";

// Automatically inject tags.
registerAutoTags({
  "user:Project": pulumi.getProject(),
  "user:Stack": pulumi.getStack(),
  "Env": "PoC",
});

// const vpc = new awsx.ec2.Vpc("PoC", {
//   cidrBlock: "192.168.96.0/23",
//   numberOfAvailabilityZones: 2,
//   numberOfNatGateways: 0,
//   subnets: [
//     { type: "public", name: "bastion" },
//     { type: "isolated", name: "private" }
//   ]
// });
const vpc = new PamsVpc("VpcPoc", {
  cidrBlock: "192.168.96.0/23",
  ingressCidrBlocks: new Map([
    ["datacom", "10.8.0.0/24"],
    ["ccl", "120.136.4.242/32"],
    ["93tt", "158.140.232.61/32"],
    ["paul-vodafone", "27.252.192.0/19"],
    ["glen", "101.98.188.0/24"],
    ["daniel", "203.109.197.0/24"]
  ])
}, {})

export { }
export const vpc_poc_id = vpc.vpc.id;
export const vpc_poc_PrivateSubnetIds = vpc.isolatedNacl.then(nacl => nacl.subnetIds);
export const vpc_poc_PublicSubnetIds = vpc.publicNacl.subnetIds;