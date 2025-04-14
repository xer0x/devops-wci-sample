import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface executionRoleArgs {
  tags?: { [key: string]: pulumi.Input<string> };
}

/**
 * role
 *
 * Creates the execution role used to execute Fargate containers
 *
 * Built as a component following https://www.pulumi.com/blog/pulumi-components/
 */
export class ExecutionRole extends pulumi.ComponentResource {
  public readonly ecsTaskExecutionRole: aws.iam.Role;

  constructor(name: string, args: executionRoleArgs = {}, opts?: pulumi.ComponentResourceOptions) {
    super("mycomponents:cluster:role", name, {}, opts);

    /// Create ecsTaskExecutionRole, used to start/deploy tasks, not by the running task
    //  It is used to pull Amazon ECR images (https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html)
    this.ecsTaskExecutionRole = new aws.iam.Role("ecsTaskExecutionRole", {
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
        ...args.tags
      },
    });

    /// Attach AWS managed policy for execution tasks (we may need more permissions to fetch configuration values)
    new aws.iam.RolePolicyAttachment("ecsRolePolicyAttachment", {
      role: this.ecsTaskExecutionRole.name,
      policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
    });

    this.registerOutputs({
      ecsTaskExecutionRole: this.ecsTaskExecutionRole
    });
  }
}

