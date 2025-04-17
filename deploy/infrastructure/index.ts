import * as pulumi from "@pulumi/pulumi";
import { Cluster, Service } from "../components/cluster";
import { Image } from "../components/image"
import { LoadBalancer } from "../components/load_balancer";
import { Vpc } from "../components/vpc";

function removeFirstSubdomain(domain: string) {
  return domain.substring(domain.indexOf('.') + 1);
}

const config = new pulumi.Config();

const projectName = pulumi.getProject();
const stackName = pulumi.getStack();
const prefix = `${projectName}-${stackName}`;

const domainName = config.require("domainname"); // "example1.dev.wci-test.org";
const zoneName = removeFirstSubdomain(domainName); // "dev.wci-test.org"

const commonTags = {
  project: projectName,
  stack: stackName
};

const appImage = new Image('wci-hello', {
  folder: "../app",
  container: "wci/hello-world",
  tag: "latest",
  tags: { ...commonTags }
})

const myvpc = new Vpc("wci-vpc");

const alb = new LoadBalancer("wci-alb", {
  domainName,
  zoneName,
  vpc: myvpc.vpc,
  publicSubnetIds: pulumi.output(myvpc.publicSubnets.map(s => s.id))
});

const cluster = new Cluster('wci-dev', {
  vpc: myvpc.vpc,
  tags: commonTags
});

new Service('http', {
  cluster: cluster.cluster,
  taskExecutionRole: cluster.ecsTaskExecutionRole,
  vpc: myvpc.vpc,
  alb: alb,
  app: { image: appImage.image },
  publicSubnets: myvpc.publicSubnets,
  tags: commonTags
})

export const loadBalancerUrl = 'https://' + alb.domainName;
