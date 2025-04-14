import * as pulumi from "@pulumi/pulumi";
import * as cluster from "./infrastructure";

const config = new pulumi.Config();
const projectName = pulumi.getProject();
const stackName = pulumi.getStack();
const prefix = `${projectName}-${stackName}`;

export const { loadBalancerUrl } = cluster;
