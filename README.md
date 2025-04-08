# devops-interview

Public repository for DevOps interview exercises

# AWS Fargate Challenge: Load-Balanced Web Service

## Objective

Deploy a dockerized application (NGINX, Busybox, or custom) to ECS Fargate with:

- Auto-scaling capabilities

- Secure HTTPS (assume DNS is configured in the target AWS account, and Route 53 public hosted zone ```dev.wci-test.org``` exists)

- Assume deployment to the ```us-west-2``` region

Application should display "Hello Pulumi world!" in browser when pointed to ```exercise1.dev.wci-test.org```.

Include any production grade features you deem appropriate.

## Constraints

- Use Pulumi IaC only, do not use Pulumi Cloud

- Language: TypeScript

- Do not use Pulumi CrossWalk (pulumi/awsx package)

## Submission

Here are my notes on this submission. I followed the Pulumi [example hello-ts-fargate](https://github.com/pulumi/examples/tree/master/aws-ts-hello-fargate) unfortunately it used pulumi/awsx so I used pulumi/aws calls instead.

- [x] ECS Fargate cluster
- [x] Service definition
- [x] Auto-scaling
- [ ] Secure HTTPS
- [ ] Configurable DNS with `dev.wci-test.org` as a target, and uses the `exercise1` cname.
- [x] Deployable in `us-west-2`
- [x] Hello-world application
- [ ] Testing via [docs](https://www.pulumi.com/docs/iac/concepts/testing/)

## Surprises

The forbidden Pulumi CrossWalk (@pulumi/awsx) looks like a much easier path.

The "@pulumi/docker-build" module builds a container named "latest", at least when following their docs. I got stuck building the container for awhile. The example code includes "caching", but it was not worth figuring out why it did not work.

The async promises code is semi-hidden in Pulumi. This totally confused me. `JSON.stringify({value: pulumi_value.apply(x => x + 1)})`` This code won't run the apply, until after the original value is used.  To fix it, I had to add a`pulumi.all()` call to force it to wait.

Researched auto-scaling, and it looks like "target" based is the simplest. We can have it increase the number of desired containers to run.

Setting up an Application Load Balancer with DNS to wrap this up. It's not done, and I'm over the time.
