import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as vpc from "./vpc";

/// TODO: Create certificate
//
// const certificate = new aws.acm.Certificate("my-certificate", {
//   domainName: "example1.dev.example.com",
//   validationMethod: "DNS",
// });

/// TODO: Create security group for alb
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

const alb = new aws.lb.LoadBalancer("wci-lb", {
  internal: false,
  loadBalancerType: "application",
  securityGroups: [albSg.id],
  subnets: vpc.publicSubnets.map(subnet => subnet.id),
  enableDeletionProtection: false,
  tags: {
    Name: "app-load-balancer",
  },
});

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

const httpListener = new aws.lb.Listener("http-listener", {
  loadBalancerArn: alb.arn,
  port: 80,
  // port: 443,
  // protocol: "HTTPS",
  // sslPolicy: "ELBSecurityPolicy-2016-08", // AWS recommended policy
  //  certificateArn: certificate.arn,
  defaultActions: [{
    type: "forward",
    targetGroupArn: targetGroup.arn,
  }],
});

export const dnsName = alb.dnsName;
export const albSecurityGroupId = albSg.id;
