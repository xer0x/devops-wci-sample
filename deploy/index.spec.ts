// Configuration is mocked via ENV VAR
// See: https://github.com/pulumi/pulumi/issues/4472
process.env.PULUMI_CONFIG = '{ "project:domainname": "mock.hostname.net" }'

import * as pulumi from "@pulumi/pulumi";
import "jest";

// promiseOf
//
// Takes a `pulumi.Output<T>` and returns promise that waits for it to `apply()`.
//
// Borrowed from @Pulumi/examples because it helps us use async/await
//
function promiseOf<T>(output: pulumi.Output<T>): Promise<T> {
  return new Promise(resolve => output.apply(resolve));
}

describe("My cluster", () => {

  let infra: typeof import("./index")

  beforeAll(() => {

    // Put Pulumi in unit-test mode, mocking all calls to cloud-provider APIs.
    pulumi.runtime.setMocks({

      // Mock calls to create new resources and return a canned response.
      newResource: (args: pulumi.runtime.MockResourceArgs): { id: string, state: any, domainValidationOptions?: any } => {

        // Here, we're returning a same-shaped object for all resource types.
        // We could, however, use the arguments passed into this function to
        // customize the mocked-out properties of a particular resource.
        // See the unit-testing docs for details:
        // https://www.pulumi.com/docs/guides/testing/unit
        console.log(args)

        if (args.type === 'aws:acm/certificate:Certificate') {
          console.log('MATCH ==========================================================')
          return {
            id: `${args.name}-id`,
            state: args.inputs,
            domainValidationOptions: new Promise(resolve => resolve([]))
          }
        }

        return {
          id: `${args.name}-id`,
          state: args.inputs,
        };
      },

      // Mock function calls and return whatever input properties were provided.
      call: (args: pulumi.runtime.MockCallArgs) => {
        return args.inputs;
      },
    });

  });

  beforeEach(async () => {

    // Dynamically import the resources module.
    infra = await import("./index");
    expect(infra).toBeTruthy();
  });

  it("should be happy", () => {
    const happy = false;
    expect(happy).toBe(true);
  })
})
