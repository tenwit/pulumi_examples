import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { CidrBlock } from "@pulumi/awsx/ec2";

export interface PamsVpcArgs {
  cidrBlock: CidrBlock; // The VPC CIDR block. /18 to /23 only.
  ingressCidrBlocks: Map<string, CidrBlock>; // Named CIDR blocks to allow ingress from.
  // For example, [ ["93tt", "158.140.232.61/32"], ["ccl", "10.8.0.0/24"] ]
}

export interface PamsVpcSubnets {
  bastion: awsx.ec2.Subnet;
  isolated: awsx.ec2.Subnet;
}

export class PamsVpc extends pulumi.ComponentResource {
  // These are rarely needed; consider making these local variables in the constructor.
  public vpc: awsx.ec2.Vpc;
  public publicNacl: aws.ec2.DefaultNetworkAcl;
  public isolatedNacl: Promise<aws.ec2.NetworkAcl>;
  private readonly cidrBlock: CidrBlock;
  private readonly ingressCidrBlocks: Map<string, CidrBlock>;
  private readonly opts: Object;

  private parentOpts(parent: pulumi.Resource): any {
    return { ...this.opts, parent };
  }

  /**
    * One of the two pairs of subnets containing the PAMS instances.
    */
  public async blue(): Promise<PamsVpcSubnets> {
    return {
      bastion: (await this.vpc.publicSubnets)[0],
      isolated: (await this.vpc.isolatedSubnets)[0]
    }
  }

  /**
   * One of the two pairs of subnets containing the PAMS instances.
   */
  public async green(): Promise<PamsVpcSubnets> {
    return {
      bastion: (await this.vpc.publicSubnets)[1],
      isolated: (await this.vpc.isolatedSubnets)[1]
    }
  }

  /**
   * The public subnets (`blue().bastion` and `green().bastion`) allow
   * access only from the CIDRs passed in to the class constructor as the
   * "ingressCidrBlocks" parameter.
   */
  private configurePublicNacl(name: string, ingressCidrBlocks: Map<string, CidrBlock>): aws.ec2.DefaultNetworkAcl {
    var nacl = new aws.ec2.DefaultNetworkAcl(`${name}-public`, {
      defaultNetworkAclId: this.vpc.vpc.defaultNetworkAclId,
      subnetIds: this.vpc.publicSubnetIds
    }, this.parentOpts(this));
    let ruleNum = 200;
    ingressCidrBlocks.forEach((cidrBlock, key) =>
      new aws.ec2.NetworkAclRule(`${name}-${key}`, {
        ruleNumber: ruleNum++,
        ruleAction: "allow", protocol: "-1",
        networkAclId: nacl.id,
        cidrBlock: cidrBlock
      }, this.parentOpts(nacl))
    );
    return nacl;
  }

  private async createIsolatedNacl(name: string, ingressCidrBlocks: Map<string, CidrBlock>): Promise<aws.ec2.NetworkAcl> {
    // The isolated subnets allow access only from the public subnets.
    var nacl = new aws.ec2.NetworkAcl(`${name}-isolated`, {
      vpcId: this.vpc.id,
      subnetIds: this.vpc.isolatedSubnetIds
    }, this.parentOpts(this));

    new aws.ec2.NetworkAclRule(`${name}-blue`, {
      ruleNumber: 200,
      ruleAction: "allow", protocol: "-1",
      networkAclId: nacl.id,
      cidrBlock: (await this.blue()).bastion.subnet.cidrBlock
    }, this.parentOpts(nacl));
    new aws.ec2.NetworkAclRule(`${name}-green`, {
      ruleNumber: 201,
      ruleAction: "allow", protocol: "-1",
      networkAclId: nacl.id,
      cidrBlock: (await this.green()).bastion.subnet.cidrBlock
    }, this.parentOpts(nacl));

    return nacl;
  }

  constructor(name: string, args: PamsVpcArgs, opts: pulumi.ComponentResourceOptions = {}) {
    super("pams:vpc:PamsVpc", name, args, opts);
    this.opts = opts;
    this.cidrBlock = args.cidrBlock;
    this.ingressCidrBlocks = args.ingressCidrBlocks;

    this.vpc = new awsx.ec2.Vpc(name, {
      cidrBlock: args.cidrBlock,
      numberOfAvailabilityZones: 2,
      numberOfNatGateways: 0,
      subnets: [
        { type: "public", name: "bastion" },
        { type: "isolated", name: "pams" }
      ]
    }, { ...opts, parent: this });

    this.publicNacl = this.configurePublicNacl(name, args.ingressCidrBlocks);
    this.isolatedNacl = this.createIsolatedNacl(name, args.ingressCidrBlocks);
    this.registerOutputs();
  }
}
