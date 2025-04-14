import * as aws from "@pulumi/aws";
import * as vpc from "./vpc";
import * as alb from "./load_balancer";

import { Cluster, Service } from "../components/cluster";
import { Image } from "../components/image"

const commonTags = {};

const appImage = new Image('wci-hello', {
  folder: "../app",
  container: "wci/hello-world",
  tag: "latest",
  tags: { ...commonTags }
})


const cluster = new Cluster('wci-dev', {
  vpc: vpc.vpc,
  //tags: { "foo": "bar" };
});

const logGroup = new aws.cloudwatch.LogGroup('logs');

const service = new Service('http', {
  cluster: cluster.cluster,
  taskExecutionRole: cluster.ecsTaskExecutionRole,
  vpc: vpc.vpc,
  alb: alb,
  app: { image: appImage.image, imageRef: appImage.image.ref },
  publicSubnets: vpc.publicSubnets,
  logGroup: logGroup,
  tags: { "magic": "foo" }
})

export const loadBalancerUrl = 'https://' + alb.albDomainName;
