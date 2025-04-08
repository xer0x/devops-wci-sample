import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as vpc from "./vpc";

const certificate = new aws.acm.Certificate("my-certificate", {
  domainName: "example.com",
  validationMethod: "DNS",
});

const alb = new aws.lb.LoadBalancer("wci-lb", {
  internal: false,
  loadBalancerType: "application",
  // securityGroups: [albSg.id],
  subnets: vpc.publicSubnets.map(subnet => subnet.id),
  enableDeletionProtection: false,
  tags: {
    Name: "app-load-balancer",
  },
});

export const dnsName = alb.dnsName;
