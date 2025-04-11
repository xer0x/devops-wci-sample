import { Vpc } from "../components/vpc";

//// Create basic VPC
//
// VPC uses 10.0.0.0/16
//
// 4 Public Subnets in us-west-2 for each availability zone
//   10.0.1.0/24, 10.0.3.0/24, 10.0.4.0/24, 10.0.5.0/24
// 1 Private Subnet in us-west-2a
//   10.0.2.0/24
// 1 Internet gateway

const myvpc = new Vpc("wci-vpc");

export const vpc = myvpc.vpc;
export const privateSubnetId = myvpc.privateSubnet.id;
export const publicSubnets = myvpc.publicSubnets;

