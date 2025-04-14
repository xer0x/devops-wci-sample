import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { ExecutionRole } from "./role"

//// Create an ECS Fargate cluster

export interface clusterArgs {
  vpc: pulumi.Input<aws.ec2.Vpc>;
  tags?: { [key: string]: pulumi.Input<string> };
}

/**
 * Cluster
 *
 * Built as a component following https://www.pulumi.com/blog/pulumi-components/
 */
export class Cluster extends pulumi.ComponentResource {
  public readonly cluster: aws.ecs.Cluster;
  //public readonly loadBalancerUrl: string;
  public readonly ecsTaskExecutionRole: aws.iam.Role;

  constructor(name: string, args: clusterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("mycomponents:index:cluster", name, {}, opts);

    const { tags } = args;

    /// Create cluster
    this.cluster = new aws.ecs.Cluster("cluster", {
      tags: {
        ...tags
      }
    });

    this.ecsTaskExecutionRole = new ExecutionRole('role', {
      tags
    }).ecsTaskExecutionRole;


    // TODO: move this to the ALB, the "cluster" does not need to know
    //this.loadBalancerUrl = 'https://' + args.alb.albDomainName;

    this.registerOutputs({
      //loadBalancerUrl: this.loadBalancerUrl
    });
  }
}
