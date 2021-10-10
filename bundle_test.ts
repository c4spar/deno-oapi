import { bundle, stringify } from "./bundle.ts";
import { assertEquals } from "./dev_deps.ts";

Deno.test({
  name: "stringify openapi.yaml",
  async fn() {
    const output = await stringify("example/openapi.yaml");
    const expected = await Deno.readTextFile("example/openapi.bundle.yaml");
    assertEquals(output + "\n", expected);
  },
});

Deno.test({
  name: "bundle openapi.yaml",
  async fn() {
    const document = await bundle("example/openapi.yaml");
    const output = await stringify(document);
    const expected = await Deno.readTextFile("example/openapi.bundle.yaml");
    assertEquals(output + "\n", expected);
  },
});
