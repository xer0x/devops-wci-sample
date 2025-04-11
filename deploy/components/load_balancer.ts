import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface loadBalancerArgs {
  prefix?: pulumi.Input<string>;
  tags?: { [key: string]: pulumi.Input<string> };
}

/**
 * vpc
 *
 * Built as a component following https://www.pulumi.com/blog/pulumi-components/
 */
export class LoadBalancer extends pulumi.ComponentResource {

  constructor(name: string, args: loadBalancerArgs = {}, opts?: pulumi.ComponentResourceOptions) {
    super("mycomponents:index:loadbalancer", name, {}, opts);
  }

}
