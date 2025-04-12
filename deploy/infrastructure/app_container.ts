import * as pulumi from "@pulumi/pulumi"
import * as aws from "@pulumi/aws";
import * as docker_build from "@pulumi/docker-build";


// Create Amazon ECR to hold our containers
const repo = new aws.ecr.Repository("wci-repo", {
  name: "wci/hello",
  forceDelete: true,
});

// Grab auth credentials for ECR.
const authToken = aws.ecr.getAuthorizationTokenOutput({
  registryId: repo.registryId,
}, {
  dependsOn: [repo]
});

// Build and push an image to ECR with inline caching.
export const appImage = new docker_build.Image("hello-wci", {
  // Tag our image with our ECR repository's address.
  tags: [pulumi.interpolate`${repo.repositoryUrl}:latest`],
  context: {
    location: "../app",
  },
  // Use the pushed image as a cache source.
  cacheFrom: [{
    registry: {
      ref: pulumi.interpolate`${repo.repositoryUrl}:latest`,
    },
  }],
  // TODO: The cacheTo section causes an HTTP 400 error on PUT
  // cacheTo: [{
  //   registry: {
  //     ref: pulumi.interpolate`${repo.repositoryUrl}:latest`,
  //   },
  // }],
  // Build a multi-platform image manifest for ARM and AMD.
  platforms: [
    "linux/amd64",
    //    "linux/arm64",
  ],
  // Push the final result to ECR.
  push: true,
  // Provide our ECR credentials.
  registries: [{
    address: repo.repositoryUrl,
    password: authToken.password,
    username: authToken.userName,
  }],
}, {
  dependsOn: [repo]
});

// Export a ref for the pushed images so we can deploy it.
export const imageRef = appImage.ref;

