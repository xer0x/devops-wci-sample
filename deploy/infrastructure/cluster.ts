import * as vpc from "./vpc";
import * as app from "./app_container";
import * as alb from "./load_balancer";

import { Cluster } from "../components/cluster";

const cluster = new Cluster('wci-dev', {
  vpc: vpc.vpc,
  app: app,
  publicSubnets: vpc.publicSubnets,
  alb: alb
  //tags: { "foo": "bar" };
});

export const loadBalancerUrl = 'https://' + alb.albDomainName;
