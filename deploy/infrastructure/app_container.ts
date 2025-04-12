
import { Container } from "../components/container"

const commonTags = {};

export const appImage = new Container('wci-hello', {
  folder: "../app",
  container: "wci/hello-world",
  tag: "latest",
  tags: { ...commonTags }
})

// Export a ref for the pushed images so we can deploy it.
export const imageRef = appImage.imageFullName;

