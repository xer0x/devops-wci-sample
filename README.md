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

Here are my notes on this submission. Originally, I thought I could follow the official Pulumi [example hello-ts-fargate](https://github.com/pulumi/examples/tree/master/aws-ts-hello-fargate) unfortunately it used @pulumi/awsx, and so I had to abandon it, and use the more primitive @pulumi/aws.

- [x] ECS Fargate cluster
- [x] Service definition for app
- [x] Auto-scaling
- [x] Secure HTTPS
- [x] Configurable DNS with `dev.wci-test.org` as a target, and uses the `exercise1` cname.
- [x] Deployable in `us-west-2`
- [x] Hello-world application
- [ ] Testing via [docs](https://www.pulumi.com/docs/iac/concepts/testing/)

## Configuration

To configure this to work set the `domainname` to match an existing Route53 zone in your AWS account.

```shell
pulumi config set domainname example1.dev.wci-test.org
```

Also remove the `aws:profile` value from the `Pulumi.dev.yaml`

```shell
pulumi config rm aws:profile
```

## Surprises

The forbidden Pulumi CrossWalk (@pulumi/awsx) looks like a much easier path.

The "@pulumi/docker-build" module builds a container named "latest", at least when following their docs. I got stuck building the container for awhile. The example code includes "caching", but it was not worth figuring out why it did not work.

The async promises code is semi-hidden in Pulumi. This totally confused me. `JSON.stringify({value: pulumi_value.apply(x => x + 1)})`` This code won't run the apply, until after the original value is used.  To fix it, I had to add a`pulumi.all()` call to force it to wait.

Researched auto-scaling, and it looks like "target" based is the simplest. We can have it increase the number of desired containers to run.

Setting up an Application Load Balancer with DNS took awhile to configure the DNS values, and get the verification working.

I started adding tests. However since everything loaded at once, I started refactoring into TypeScript classes using Pulumi's component library pattern. I'm hoping that this pattern helps make the system easier to write tests for.

I moved the Pulumi resources into the /deploy folder. It's an experiment to tidy up the root folder.

To rename items in the state file:

```
# Look up the URNs of resources in the stack:
$ pulumi stack -u
....

# Rename an item (example)
$ pulumi state rename "urn:pulumi:dev::wci-sample::aws:ecs/taskDefinition:TaskDefinition::httpTaskDefinition" http-task
```
