import { Command } from "https://deno.land/x/cliffy@v0.24.2/command/command.ts";
import { UpgradeCommand } from "https://deno.land/x/cliffy@v0.24.2/command/upgrade/upgrade_command.ts";
import { DenoLandProvider } from "https://deno.land/x/cliffy@v0.24.2/command/upgrade/provider/deno_land.ts";
import { EnumType } from "https://deno.land/x/cliffy@v0.24.2/command/types/enum.ts";
import { bold, red } from "./deps.ts";
import { stringify } from "./bundle.ts";
import { log } from "./debug.ts";

export const oapi = new Command()
  .name("oapi")
  .description("A Simple OpenAPI Bundler")
  .usage("bundle ./openapi.yaml")
  .command("bundle <file:string>")
  .description(
    "Output a single openapi file with all external references.\n\n" +
      "The entry file can be a local or a remote file.",
  )
  .type(
    "verbose",
    new EnumType([true, false, 0, 1, 2, 3]),
  )
  .env(
    "OAPI_VERBOSE=<verbose:verbose>",
    "Increase debug output.\n" +
      `${red(bold("-"))} 0|false: Disable all debug output.\n` +
      `${red(bold("-"))} 1|true: Prints url of loaded \$ref's.\n` +
      `${red(bold("-"))} 2: Prints debug informations.\n` +
      `${red(bold("-"))} 3: Prints more debug informations.`,
    {
      prefix: "OAPI_",
      value: (value) => Number(value),
    },
  )
  .option(
    "-v, --verbose",
    "Increase debug output.\n" +
      `${red(bold("-"))} -v:   Prints url of loaded \$ref's.\n` +
      `${red(bold("-"))} -vv:  Prints debug informations.\n` +
      `${red(bold("-"))} -vvv: Prints more debug informations.`,
    {
      collect: true,
      default: 1,
      // deno-lint-ignore no-inferrable-types
      value: (_: number | true, previus: number = 0) => ++previus,
      action: ({ verbose }) => log.setVerbose(Number(verbose)),
    },
  )
  .action(async (_, file: string) => {
    console.log(await stringify(file));
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
