import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as docker_build from "@pulumi/docker-build";

export interface containerArgs {
  folder: pulumi.Input<string>;
  container: pulumi.Input<string>;
  push?: pulumi.Input<boolean>;
  tag?: pulumi.Input<string>;
  tags?: { [key: string]: pulumi.Input<string> };
}

/**
 * Container
 *
 * @param name
 * @param args.folder Expects a folder with a Dockerfile
 * @param args.container a name like 'wci/hello-world'
 * @param args.push if true, push to docker iamge repository
 * @param args.tag the docker defaults to "latest"
 * @param args.tags the aws resource tags
 *
 * Built as a component following https://www.pulumi.com/blog/pulumi-components/
 */
export class Container extends pulumi.ComponentResource {
  public readonly repository: aws.ecr.Repository;
  public readonly appImage: docker_build.Image;
  public readonly imageFullName: pulumi.Output<string>;

  constructor(name: string, args: containerArgs, opts?: pulumi.ComponentResourceOptions) {
    super("mycomponents:index:container", name, {}, opts);

    // Create Amazon ECR to hold our containers
    this.repository = new aws.ecr.Repository(`${name}-repo`, {
      name: args.container,
      forceDelete: true,
      tags: {
        ...args.tags
      },
    });

    // Grab auth credentials for ECR.
    const authToken = aws.ecr.getAuthorizationTokenOutput({
      registryId: this.repository.registryId,
    }, {
      dependsOn: [this.repository]
    });

    const tag = args.tag || "latest";
    this.imageFullName = pulumi.interpolate`${this.repository.repositoryUrl}:${tag}`;

    // Build and push an image to ECR with inline caching.
    this.appImage = new docker_build.Image(`${name}-img`, {
      // To publish the image, include the full repository url in the name tag
      tags: [this.imageFullName],
      context: {
        location: args.folder,
      },
      // Use the pushed image as a cache source.
      cacheFrom: [{
        registry: {
          ref: this.imageFullName,
        },
      }],
      // TODO: The cacheTo section causes an HTTP 400 error on PUT
      // cacheTo: [{
      //   registry: {
      //     ref: pulumi.interpolate`${repo.repositoryUrl}:latest`,
      //   },
      // }],
      // Build a multi-platform image manifest for ARM and AMD.
      // Note -- it is recommended to build one architecture at a time.
      platforms: [
        "linux/amd64",
        //    "linux/arm64",
      ],
      // Push the final result to ECR.
      push: args.push || true,
      // Provide our ECR credentials.
      registries: [{
        address: this.repository.repositoryUrl,
        password: authToken.password,
        username: authToken.userName,
      }],
    }, {
      dependsOn: [this.repository]
    });

    this.registerOutputs({
      repositoryUrl: this.repository.repositoryUrl,
      imageFullName: this.imageFullName
    });
  }
}
