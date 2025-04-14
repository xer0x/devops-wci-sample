import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

/// Create a new service on a ECS Fargate cluster

export interface serviceArgs {
  cluster: pulumi.Input<aws.ecs.Cluster>;
  taskExecutionRole: pulumi.Input<aws.iam.Role>;
  vpc: pulumi.Input<aws.ec2.Vpc>;
  app: pulumi.Input<any>;                          // temporary while refactoring
  publicSubnets: pulumi.Input<aws.ec2.Subnet[]>;
  alb: pulumi.Input<any>;                          // temporary while refactoring
  logGroup: pulumi.Input<aws.cloudwatch.LogGroup>;
  tags?: { [key: string]: pulumi.Input<string> };
}

/**
 * Cluster
 *
 * Built as a component following https://www.pulumi.com/blog/pulumi-components/
 */
export class Service extends pulumi.ComponentResource {
  public readonly cluster: pulumi.Output<aws.ecs.Cluster>;
  public readonly ecsTaskExecutionRole: pulumi.Output<aws.iam.Role>;
  public readonly logGroup: pulumi.Output<aws.cloudwatch.LogGroup>;

  constructor(name: string, args: serviceArgs, opts?: pulumi.ComponentResourceOptions) {
    super("mycomponents:cluster:service", name, {}, opts);

    const { tags } = args;

    this.cluster = pulumi.output(args.cluster);
    this.ecsTaskExecutionRole = pulumi.output(args.taskExecutionRole);
    this.logGroup = pulumi.output(args.logGroup);

    /// Create task definition for http hello-world service
    const httpTaskDefinition = new aws.ecs.TaskDefinition("httpTaskDefinition", {
      family: "http",
      requiresCompatibilities: ["FARGATE"],
      executionRoleArn: this.ecsTaskExecutionRole.apply(role => role.arn),
      networkMode: "awsvpc",
      cpu: "256", // 1024 CPU units == 1 vCPU
      memory: "512",
      runtimePlatform: {
        cpuArchitecture: 'X86_64', // ARM64'
        operatingSystemFamily: 'LINUX'
      },

      // TODO: make serviceLogGroup
      //
      /// 🤯 pulumi.all() makes this wait, so that apply actually happens on time. (race condition 🏎️)
      containerDefinitions: pulumi.all([args.app.imageName, this.logGroup.name]).apply(([imageName, logGroupName]) => {
        // Strip the '@SHA...' from `${repo}/${image}:${tag}@SHA...` if present.
        const shortImageName = imageName.split('@')[0];
        console.log('logGroup.name:', logGroupName)
        console.log('aws.config.region:', aws.config.region)
        console.log('name', name)
        return JSON.stringify([
          {
            name: "hello-world",
            image: shortImageName,
            //image: "696433927643.dkr.ecr.us-west-2.amazonaws.com/repo:latest",
            cpu: 256,
            memory: 512,
            essential: true,
            portMappings: [{
              containerPort: 80
            }],
            logConfiguration: {
              logDriver: "awslogs",
              options: {
                "awslogs-group": logGroupName,
                "awslogs-region": aws.config.region,
                "awslogs-stream-prefix": name,
              }
            }
          }
        ])
      }),
      tags
    }, {
      dependsOn: [args.app.image]
    });

    /// Network security group to ensure traffic gets from ALB -> ECS Service
    //
    // The ALB -> HTTP service were not talking to each other, because I made the security groups too strict.
    // I'm allowing all traffic for now.
    //
    const httpServiceSg = new aws.ec2.SecurityGroup("ecs-service-sg", {
      vpcId: pulumi.output(args.vpc).apply(vpc => vpc.id),
      description: "Security group for the ECS service",
      ingress: [
        {
          // swapped this to allow everything
          // protocol: "tcp",
          // fromPort: 80,
          // toPort: 80,
          // securityGroups: [alb.albSecurityGroupId], // Only allow traffic from the ALB
          protocol: "-1",
          fromPort: 0,
          toPort: 0,
          cidrBlocks: ["0.0.0.0/0"],
          description: "Allow HTTP traffic from ALB",
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
        Name: "ecs-service-security-group",
      },
    });

    /// Create service to run the hello-world server
    const httpService = new aws.ecs.Service("http", {
      name: "http",
      cluster: this.cluster.apply(c => c.id),
      launchType: "FARGATE",
      taskDefinition: httpTaskDefinition.arn,
      desiredCount: 3,
      networkConfiguration: {
        assignPublicIp: true,
        securityGroups: [httpServiceSg.id], // WHAT?!  This can cause a Pulumi AWS API error, but it is not clear why. To fix, comment out assignPublicIp and securityGroups
        subnets: pulumi.output(args.publicSubnets).apply(subnets => subnets.map(subnet => subnet.id)),
      },
      loadBalancers: [{
        containerName: "hello-world", // Must match the task containerName
        containerPort: 80,
        targetGroupArn: args.alb.targetGroup.arn
      }],
      availabilityZoneRebalancing: 'ENABLED',

      // Lower minimum to allow old tasks to be stopped even if new ones aren't fully healthy yet
      // Caution: this can cause deployments to fail when at 100
      deploymentMinimumHealthyPercent: 50,

      // Allow more headroom for new tasks to start up
      deploymentMaximumPercent: 200,

      // Circuit breaker to prevent endless failed deployments
      deploymentCircuitBreaker: {
        enable: true,
        rollback: true,
      },
    }, {
      dependsOn: [this.ecsTaskExecutionRole, args.alb.targetGroup],
    });

    /// Autoscaling configuration
    const httpTarget = new aws.appautoscaling.Target("http_target", {
      resourceId: pulumi.interpolate`service/${this.cluster.name}/${httpService.name}`,
      scalableDimension: "ecs:service:DesiredCount",
      minCapacity: 1,
      maxCapacity: 5,
      serviceNamespace: "ecs"
    });

    /// Using TargetTracking for its simplicity
    const ecsPolicy = new aws.appautoscaling.Policy("http_scaling_policy", {
      name: "scale-up",
      policyType: "TargetTrackingScaling",
      resourceId: httpTarget.resourceId,
      scalableDimension: httpTarget.scalableDimension,
      serviceNamespace: httpTarget.serviceNamespace,
      targetTrackingScalingPolicyConfiguration: {
        predefinedMetricSpecification: {
          predefinedMetricType: "ECSServiceAverageCPUUtilization",
        },
        targetValue: 70.0,            // Target 70% CPU utilization
        scaleInCooldown: 300,         // Wait 5 minutes before scaling in
        scaleOutCooldown: 60,         // Wait 1 minute before scaling out
      },
    });

    this.registerOutputs({
    });
  }

}
