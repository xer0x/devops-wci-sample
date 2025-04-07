import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Create cluster
const cluster = new aws.ecs.Cluster("cluster");

