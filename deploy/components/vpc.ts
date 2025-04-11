import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

//// Create basic VPC
//
// VPC uses 10.0.0.0/16
//
// 4 Public Subnets in us-west-2 for each availability zone
//   10.0.1.0/24, 10.0.3.0/24, 10.0.4.0/24, 10.0.5.0/24
// 1 Private Subnet in us-west-2a
//   10.0.2.0/24
// 1 Internet gateway

export interface vpcArgs {
  prefix?: pulumi.Input<string>;
  tags?: { [key: string]: pulumi.Input<string> };
}

/**
 * vpc
 *
 * Built as a component following https://www.pulumi.com/blog/pulumi-components/
 */
export class Vpc extends pulumi.ComponentResource {
  public readonly vpc: aws.ec2.Vpc;
  public readonly internetGateway: aws.ec2.InternetGateway;
  public readonly privateSubnet: aws.ec2.Subnet;
  public readonly publicSubnets: aws.ec2.Subnet[];

  constructor(name: string, args: vpcArgs = {}, opts?: pulumi.ComponentResourceOptions) {
    super("mycomponents:index:vpc", name, {}, opts);

    /// Create a VPC
    this.vpc = new aws.ec2.Vpc("wci-vpc", {
      cidrBlock: "10.0.0.0/16",
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: {
        Name: "wci-vpc",
        ...args.tags
      },
    });

    /// Create an Internet Gateway
    this.internetGateway = new aws.ec2.InternetGateway("internet-gateway", {
      vpcId: this.vpc.id,
      tags: {
        Name: "internet-gateway",
      },
    });

    /// Create a private subnet <unused>
    this.privateSubnet = new aws.ec2.Subnet("private-subnet", {
      vpcId: this.vpc.id,
      cidrBlock: "10.0.2.0/24",
      availabilityZone: "us-west-2a",
      tags: {
        Name: "private-subnet",
      },
    });

    /// Create a public subnet
    const publicSubnet1 = new aws.ec2.Subnet("public-subnet-2a", {
      vpcId: this.vpc.id,
      cidrBlock: "10.0.1.0/24",
      availabilityZone: "us-west-2a",
      mapPublicIpOnLaunch: true,
      tags: {
        Name: "public-subnet-2a",
      },
    });

    const publicSubnet2 = new aws.ec2.Subnet("public-subnet-2b", {
      vpcId: this.vpc.id,
      cidrBlock: "10.0.3.0/24",
      availabilityZone: "us-west-2b",
      mapPublicIpOnLaunch: true,
      tags: {
        Name: "public-subnet-2b",
      },
    });

    const publicSubnet3 = new aws.ec2.Subnet("public-subnet-2c", {
      vpcId: this.vpc.id,
      cidrBlock: "10.0.4.0/24",
      availabilityZone: "us-west-2c",
      mapPublicIpOnLaunch: true,
      tags: {
        Name: "public-subnet-2c",
      },
    });

    const publicSubnet4 = new aws.ec2.Subnet("public-subnet-2d", {
      vpcId: this.vpc.id,
      cidrBlock: "10.0.5.0/24",
      availabilityZone: "us-west-2d",
      mapPublicIpOnLaunch: true,
      tags: {
        Name: "public-subnet-2d",
      },
    });

    /// Create a route table for the public subnet
    const publicRouteTable = new aws.ec2.RouteTable("public-route-table", {
      vpcId: this.vpc.id,
      routes: [
        {
          cidrBlock: "0.0.0.0/0",
          gatewayId: this.internetGateway.id,
        },
      ],
      tags: {
        Name: "public-route-table",
      },
    });

    /// Associate the public subnet with the public route table
    const publicRouteTableAssociation1 = new aws.ec2.RouteTableAssociation("public-route-table-association-1", {
      subnetId: publicSubnet1.id,
      routeTableId: publicRouteTable.id,
    });

    const publicRouteTableAssociation2 = new aws.ec2.RouteTableAssociation("public-route-table-association-2", {
      subnetId: publicSubnet2.id,
      routeTableId: publicRouteTable.id,
    });

    const publicRouteTableAssociation3 = new aws.ec2.RouteTableAssociation("public-route-table-association-3", {
      subnetId: publicSubnet3.id,
      routeTableId: publicRouteTable.id,
    });

    const publicRouteTableAssociation4 = new aws.ec2.RouteTableAssociation("public-route-table-association-4", {
      subnetId: publicSubnet4.id,
      routeTableId: publicRouteTable.id,
    });

    /// Create a route table for the private subnet
    const privateRouteTable = new aws.ec2.RouteTable("private-route-table", {
      vpcId: this.vpc.id,
      tags: {
        Name: "private-route-table",
      },
    });

    /// Associate the private subnet with the private route table
    const privateRouteTableAssociation = new aws.ec2.RouteTableAssociation("private-route-table-association", {
      subnetId: this.privateSubnet.id,
      routeTableId: privateRouteTable.id,
    });

    this.publicSubnets = [publicSubnet1, publicSubnet2, publicSubnet3, publicSubnet4];

    this.registerOutputs({
      vpc: this.vpc,
      vpcId: this.vpc.id,
      privateSubnetId: this.privateSubnet.id,
      publicSubnets: this.publicSubnets
    });
  }
}
