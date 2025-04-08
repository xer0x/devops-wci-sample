import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Create basic VPC
// https://www.pulumi.com/answers/creating-an-aws-vpc-network-with-pulumi/



// Create a VPC
export const vpc = new aws.ec2.Vpc("wci-vpc", {
  cidrBlock: "10.0.0.0/16",
  enableDnsSupport: true,
  enableDnsHostnames: true,
  tags: {
    Name: "wci-vpc",
  },
});

// Create an Internet Gateway
const internetGateway = new aws.ec2.InternetGateway("internet-gateway", {
  vpcId: vpc.id,
  tags: {
    Name: "internet-gateway",
  },
});

// Create a public subnet
const publicSubnet1 = new aws.ec2.Subnet("public-subnet-2a", {
  vpcId: vpc.id,
  cidrBlock: "10.0.1.0/24",
  availabilityZone: "us-west-2a",
  mapPublicIpOnLaunch: true,
  tags: {
    Name: "public-subnet-2a",
  },
});

// Create a private subnet
const privateSubnet = new aws.ec2.Subnet("private-subnet", {
  vpcId: vpc.id,
  cidrBlock: "10.0.2.0/24",
  availabilityZone: "us-west-2a",
  tags: {
    Name: "private-subnet",
  },
});

const publicSubnet2 = new aws.ec2.Subnet("public-subnet-2b", {
  vpcId: vpc.id,
  cidrBlock: "10.0.3.0/24",
  availabilityZone: "us-west-2b",
  mapPublicIpOnLaunch: true,
  tags: {
    Name: "public-subnet-2b",
  },
});

const publicSubnet3 = new aws.ec2.Subnet("public-subnet-2c", {
  vpcId: vpc.id,
  cidrBlock: "10.0.4.0/24",
  availabilityZone: "us-west-2c",
  mapPublicIpOnLaunch: true,
  tags: {
    Name: "public-subnet-2c",
  },
});

// Create a route table for the public subnet
const publicRouteTable = new aws.ec2.RouteTable("public-route-table", {
  vpcId: vpc.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      gatewayId: internetGateway.id,
    },
  ],
  tags: {
    Name: "public-route-table",
  },
});

// Associate the public subnet with the public route table
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

// Create a route table for the private subnet
const privateRouteTable = new aws.ec2.RouteTable("private-route-table", {
  vpcId: vpc.id,
  tags: {
    Name: "private-route-table",
  },
});

// Associate the private subnet with the private route table
const privateRouteTableAssociation = new aws.ec2.RouteTableAssociation("private-route-table-association", {
  subnetId: privateSubnet.id,
  routeTableId: privateRouteTable.id,
});

// Export the VPC ID
export const vpcId = vpc.id;

// Export the public and private subnet IDs
// export const publicSubnetId = publicSubnet.id;
export const privateSubnetId = privateSubnet.id;

export const publicSubnets = [publicSubnet1, publicSubnet2, publicSubnet3]
