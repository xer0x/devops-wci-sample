import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface loadBalancerArgs {
  domainName?: pulumi.Input<string>;
  zoneName?: pulumi.Input<string>;
  vpc: aws.ec2.Vpc;
  publicSubnetIds: pulumi.Input<string[]>
  tags?: { [key: string]: pulumi.Input<string> };
}

/**
 * LoadBalancer
 *
 * Creates an ALB with an HTTPS certificate with DNS verification
 *
 * Exports the target group, so it can be linked to the ECS Fargate container
 *
 * Refactoring ideas: extract DNS verification, security-groups, and maybe the listener configurations
 *
 * Built as a component following https://www.pulumi.com/blog/pulumi-components/
 */
export class LoadBalancer extends pulumi.ComponentResource {
  readonly targetGroup: aws.lb.TargetGroup;
  readonly securityGroup: aws.ec2.SecurityGroup;
  readonly dnsName: pulumi.Output<string>;
  readonly domainName: string;

  constructor(name: string, args: loadBalancerArgs, opts?: pulumi.ComponentResourceOptions) {
    super("mycomponents:index:loadbalancer", name, {}, opts);

    const { domainName, zoneName, vpc, publicSubnetIds } = args;

    this.domainName = domainName as unknown as string;

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
      name: zoneName as unknown as string,
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
    this.securityGroup = new aws.ec2.SecurityGroup("alb-sg", {
      vpcId: vpc.id,
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
      securityGroups: [this.securityGroup.id],
      subnets: publicSubnetIds,
      enableDeletionProtection: false,
      tags: {
        Name: "ALB for HTTP Service",
      },
    });

    this.dnsName = alb.dnsName;

    /// Assign target group to load balancer
    this.targetGroup = new aws.lb.TargetGroup("http-tg", {
      port: 80,
      protocol: "HTTP",
      targetType: "ip", // Important for Fargate
      vpcId: vpc.id,
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
    new aws.lb.Listener("https-listener", {
      loadBalancerArn: alb.arn,
      port: 443,
      protocol: "HTTPS",
      sslPolicy: "ELBSecurityPolicy-2016-08", // AWS recommended policy
      certificateArn: certificate.arn,
      defaultActions: [{
        type: "forward",
        targetGroupArn: this.targetGroup.arn,
      }],
    });

    /// Add http listener for port 80
    new aws.lb.Listener("http-listener", {
      loadBalancerArn: alb.arn,
      port: 80,
      defaultActions: [{
        type: "forward",
        targetGroupArn: this.targetGroup.arn,
      }],
    });

    /// Add DNS Alias for custom domain that points to ALB
    new aws.route53.Record("alb-aRecord", {
      zoneId: zone.then(z => z.zoneId),
      name: certificate.domainName,
      type: "A",
      aliases: [{
        name: alb.dnsName,
        zoneId: alb.zoneId,
        evaluateTargetHealth: true,
      }],
    });

    this.registerOutputs({
      targetGroup: this.targetGroup,
      securityGroup: this.securityGroup
    });
  }

}
