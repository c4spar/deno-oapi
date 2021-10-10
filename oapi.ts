import { Command } from "https://deno.land/x/cliffy@v0.19.6/command/command.ts";
import { UpgradeCommand } from "https://deno.land/x/cliffy@v0.19.6/command/upgrade/upgrade_command.ts";
import { DenoLandProvider } from "https://deno.land/x/cliffy@v0.19.6/command/upgrade/provider/deno_land.ts";
import { stringify } from "./mod.ts";

export const oapi = new Command<void>()
  .name("oapi")
  .description("A Simple OpenAPI Bundler")
  .usage("bundle ./openapi.yaml")
  .command("bundle")
  .description(
    "Output an single openapi file with all external references.\n\n" +
      "  External references will be loaded from remote if <file> is an url.",
  )
  .option<{ verbose: number }>(
    "-v, --verbose",
    "Increase debug output.",
    {
      collect: true,
      value: (_, previus = 0) => ++previus,
    },
  )
  .arguments<[file: string]>("<file:string>")
  .action(async ({ verbose }, file: string) => {
    console.log(await stringify(file, { verbose }));
  })
  .command(
    "upgrade",
    new UpgradeCommand({
      provider: [new DenoLandProvider()],
    }),
  );

if (import.meta.main) {
  await oapi.parse();
}
