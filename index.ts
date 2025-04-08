import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

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
  containerDefinitions: JSON.stringify([
    {
      name: "hello-world",
      image: "skyzyx/nginx-hello-world",
      cpu: 10,
      memory: 512,
      essential: true,
      portMappings: [{
        containerPort: 80,
        hostPort: 80,
      }],
    }
  ])
});

/// Create service to run the hello-world server
const httpService = new aws.ecs.Service("http", {
  name: "http",
  cluster: cluster.id,
  taskDefinition: httpTaskDefinition.arn,
  desiredCount: 3,
  // iamRole: fooAwsIamRole.arn,
  // orderedPlacementStrategies: [{
  //   type: "binpack",
  //   field: "cpu",
  // }],
  // loadBalancers: [{
  //   targetGroupArn: fooAwsLbTargetGroup.arn,
  //   containerName: "mongo",
  //   containerPort: 8080,
  // }],
  // placementConstraints: [{
  //   type: "memberOf",
  //   expression: "attribute:ecs.availability-zone in [us-west-2a, us-west-2b]",
  // }],
}, {
  dependsOn: [ecsTaskExecutionRole],
});
