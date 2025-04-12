/**
 * Load balancer
 *
 * This sets up a public facing application load balancer to send traffic to the
 * service running on the ECS Fargate cluster.
 *
 * It creates an AWS ACM TLS certificate oo provide for the HTTPS listener.
 *
 * The shared VPC and Subnets are imported from ./vpc.ts
 *
 * It exports the target group, security groups, and dns names to find it. I believe dnsName is the AWS domain name, and albDomainName uses the configured custom domain(wci-test.org).
 *
 */

import * as pulumi from "@pulumi/pulumi";

import { LoadBalancer } from "../components/load_balancer";
import { vpc, publicSubnets } from "./vpc";

const config = new pulumi.Config()
const domainName = config.require("domainname"); // "example1.dev.wci-test.org";
const zoneName = removeFirstSubdomain(domainName); // "dev.wci-test.org"

function removeFirstSubdomain(domain: string) {
  return domain.substring(domain.indexOf('.') + 1);
}

const alb = new LoadBalancer("wci-alb", {
  domainName,
  zoneName,
  vpc,
  publicSubnetIds: pulumi.output(publicSubnets.map(s => s.id))
});

export const dnsName = alb.dnsName;
export const albSecurityGroupId = alb.securityGroup.id;
export const albDomainName = domainName;
export const targetGroup = alb.targetGroup;
