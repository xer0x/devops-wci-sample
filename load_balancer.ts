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
import * as aws from "@pulumi/aws";
import * as vpc from "./vpc";

const config = new pulumi.Config()
const domainName = config.require("domainname"); // "example1.dev.wci-test.org";
const zoneName = removeFirstSubdomain(domainName); // "dev.wci-test.org"

function removeFirstSubdomain(domain: string) {
  return domain.substring(domain.indexOf('.') + 1);
}

/// Create certificate
const certificate = new aws.acm.Certificate("alb-certificate", {
  domainName,
  validationMethod: "DNS",
  tags: {
    Name: "Cert for WCI-ALB"
  }
});

/// Get the DNS zone, so we can use it to validatation
const zone = aws.route53.getZone({
  name: zoneName,
  privateZone: false,
});

/// Create the DNS validation records
const validationRecords = certificate.domainValidationOptions.apply(options => {
  return options.map(option => {
    return new aws.route53.Record(`validation-${option.domainName}`, {
      name: option.resourceRecordName,
      records: [option.resourceRecordValue],
      ttl: 60,
      type: option.resourceRecordType,
      zoneId: zone.then(z => z.zoneId),
      allowOverwrite: true,
    });
  });
});

/// Sync validation process
const awsCertificateValidation = new aws.acm.CertificateValidation('http-cert-validation', {
  certificateArn: certificate.arn,
  validationRecordFqdns: validationRecords.apply(records => records.map(record => record.fqdn)),
});

/// Create security group for alb
const albSg = new aws.ec2.SecurityGroup("alb-sg", {
  vpcId: vpc.vpc.id,
  description: "Security group for the application load balancer",
  ingress: [
    {
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
      cidrBlocks: ["0.0.0.0/0"],
      description: "Allow HTTP traffic",
    },
    {
      protocol: "tcp",
      fromPort: 443,
      toPort: 443,
      cidrBlocks: ["0.0.0.0/0"],
      description: "Allow HTTPS traffic",
    },
  ],
  egress: [
    {
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      cidrBlocks: ["0.0.0.0/0"],
      description: "Allow all outbound traffic",
    },
  ],
  tags: {
    Name: "alb-security-group",
  },
});

/// TODO: Ensure that Fargate Service only listens to ALB traffic <maybe?>

/// Create the Load Balancer
const alb = new aws.lb.LoadBalancer("wci-lb", {
  internal: false,
  loadBalancerType: "application",
  securityGroups: [albSg.id],
  subnets: vpc.publicSubnets.map(subnet => subnet.id),
  enableDeletionProtection: false,
  tags: {
    Name: "ALB for HTTP Service",
  },
});

/// Assign target group to load balancer
export const targetGroup = new aws.lb.TargetGroup("http-tg", {
  port: 80,
  protocol: "HTTP",
  targetType: "ip", // Important for Fargate
  vpcId: vpc.vpc.id,
  healthCheck: {
    enabled: true,
    path: "/",
    port: "traffic-port",
    healthyThreshold: 3,
    unhealthyThreshold: 3,
    timeout: 5,
    interval: 30,
    matcher: "200",
  },
  tags: {
    Name: "app-target-group",
  },
});

/// Add https listener for port 443
const httpsListener = new aws.lb.Listener("https-listener", {
  loadBalancerArn: alb.arn,
  port: 443,
  protocol: "HTTPS",
  sslPolicy: "ELBSecurityPolicy-2016-08", // AWS recommended policy
  certificateArn: certificate.arn,
  defaultActions: [{
    type: "forward",
    targetGroupArn: targetGroup.arn,
  }],
});

/// Add http listener for port 80
const httpListener = new aws.lb.Listener("http-listener", {
  loadBalancerArn: alb.arn,
  port: 80,
  defaultActions: [{
    type: "forward",
    targetGroupArn: targetGroup.arn,
  }],
});

/// Add DNS Alias for custom domain that points to ALB
const aRecord = new aws.route53.Record("alb-aRecord", {
  zoneId: zone.then(z => z.zoneId),
  name: certificate.domainName,
  type: "A",
  aliases: [{
    name: alb.dnsName,
    zoneId: alb.zoneId,
    evaluateTargetHealth: true,
  }],
});

export const dnsName = alb.dnsName;
export const albSecurityGroupId = albSg.id;
export const albDomainName = domainName;
