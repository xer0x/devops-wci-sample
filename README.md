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

Here are my notes on this submission. I followed the Pulumi [example hello-ts-fargate](https://github.com/pulumi/examples/tree/master/aws-ts-hello-fargate)

- [ ] Auto-scaling
- [ ] Secure HTTPS
- [ ] Configurable DNS with `dev.wci-test.org` as a target
- [ ] Deployable in `us-west-2`
- [ ] Hello-world application
