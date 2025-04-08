import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as docker_build from "@pulumi/docker-build";

import * as vpc from "./vpc";
import * as app from "./app_container";
import * as alb from "./load_balancer";


/// Create cluster
const cluster = new aws.ecs.Cluster("cluster");

/// Create ecsTaskExecutionRole to pull Amazon ECR images (https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html)
const ecsTaskExecutionRole = new aws.iam.Role("ecsTaskExecutionRole", {
  name: "ecsTaskExecutionRole",
  assumeRolePolicy: JSON.stringify({
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "",
        "Effect": "Allow",
        "Principal": {
          "Service": "ecs-tasks.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }),
  tags: {
    "tag-key": "tag-value",
  },
});

/// Attach AWS managed policy for execution tasks (we may need more permissions to fetch configuration values)
const attach = new aws.iam.RolePolicyAttachment("ecsRolePolicyAttachment", {
  role: ecsTaskExecutionRole.name,
  policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
});

/// Create task definition for http hello-world service
const httpTaskDefinition = new aws.ecs.TaskDefinition("httpTaskDefinition", {
  family: "http",
  requiresCompatibilities: ["FARGATE"],
  executionRoleArn: ecsTaskExecutionRole.arn,
  networkMode: "awsvpc",
  cpu: "256", // 1024 CPU units == 1 vCPU
  memory: "512",
  /// 🤯 TODO: learn how pulumi.all() makes this wait, so that apply actually happens on time. (race condition 🏎️)
  containerDefinitions: pulumi.all([app.imageRef]).apply(([imageRef]) => {
    const shortImageRef = imageRef.split('@')[0];
    return JSON.stringify([
      {
        name: "hello-world",
        image: shortImageRef,
        //image: "696433927643.dkr.ecr.us-west-2.amazonaws.com/repo:latest",
        cpu: 256,
        memory: 512,
        essential: true,
        portMappings: [{
          containerPort: 80
        }],
      }
    ])
  })
}, {
  dependsOn: [app.appImage]
});

// Security group for HTTP service (This is probably way to strict)
// const allowHttp = new aws.ec2.SecurityGroup("allow_http", {
//   name: "allow_http",
//   description: "Allow http inbound traffic and all outbound traffic",
//   vpcId: vpc.vpcId,
//   tags: {
//     Name: "allow_http",
//   },
// });
//
// const allowHttpIpv4 = new aws.vpc.SecurityGroupIngressRule("allow_tls_ipv4", {
//   securityGroupId: allowHttp.id,
//   cidrIpv4: vpc.vpc.cidrBlock,
//   fromPort: 80,
//   ipProtocol: "tcp",
//   toPort: 80,
// });
//
// const allowAllTrafficIpv4 = new aws.vpc.SecurityGroupEgressRule("allow_all_traffic_ipv4", {
//   securityGroupId: allowHttp.id,
//   cidrIpv4: "0.0.0.0/0",
//   ipProtocol: "-1",
// });


/// Network security group to ensure traffic gets from ALB -> ECS Service
//
// The ALB -> HTTP service are not connected, or getting requests yet.  Hopefully this fixes it.
//
const httpServiceSg = new aws.ec2.SecurityGroup("ecs-service-sg", {
  vpcId: vpc.vpc.id,
  description: "Security group for the ECS service",
  ingress: [
    {
      /// swapped this to allow everything
      protocol: "-1",
      //protocol: "tcp",
      // fromPort: 80,
      // toPort: 80,
      fromPort: 0,
      toPort: 0,
      // securityGroups: [alb.albSecurityGroupId], // Only allow traffic from the ALB
      //securityGroups: [alb.albSecurityGroupId], // Only allow traffic from the ALB
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
  cluster: cluster.id,
  launchType: "FARGATE",
  taskDefinition: httpTaskDefinition.arn,
  desiredCount: 3,
  networkConfiguration: {
    assignPublicIp: true,
    // securityGroups: [allowHttp.id], // WHAT?!  This can cause a Pulumi AWS API error, but it is not clear why. To fix, comment out assignPublicIp and securityGroups
    securityGroups: [httpServiceSg.id], // WHAT?!  This can cause a Pulumi AWS API error, but it is not clear why. To fix, comment out assignPublicIp and securityGroups
    subnets: vpc.publicSubnets.map(subnet => subnet.id),
  },
  loadBalancers: [{
    containerName: "hello-world", // Must match the task containerName
    containerPort: 80,
    targetGroupArn: alb.targetGroup.arn
  }],
  availabilityZoneRebalancing: 'ENABLED',
  // Set deployment settings (this might smooth auto-scaling around deployments?)
  //deploymentMinimumHealthyPercent: 100,
  //deploymentMaximumPercent: 200,
}, {
  dependsOn: [ecsTaskExecutionRole, alb.targetGroup],
});

/// Autoscaling
const httpTarget = new aws.appautoscaling.Target("http_target", {
  resourceId: pulumi.interpolate`service/${cluster.name}/${httpService.name}`,
  scalableDimension: "ecs:service:DesiredCount",
  minCapacity: 1,
  maxCapacity: 5,
  serviceNamespace: "ecs"
});

/// I chose TargetTracking for its simplicity
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
