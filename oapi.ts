import { Command } from "https://deno.land/x/cliffy@v0.24.2/command/command.ts";
import { UpgradeCommand } from "https://deno.land/x/cliffy@v0.24.2/command/upgrade/upgrade_command.ts";
import { DenoLandProvider } from "https://deno.land/x/cliffy@v0.24.2/command/upgrade/provider/deno_land.ts";
import { EnumType } from "https://deno.land/x/cliffy@v0.24.2/command/types/enum.ts";
import { ValidationError } from "https://deno.land/x/cliffy@v0.24.2/command/_errors.ts";
import { bold, red } from "./deps.ts";
import { stringify } from "./bundle.ts";
import { log } from "./debug.ts";

const oapi = new Command()
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
  .type(
    "header",
    (type): [string, string] => {
      if (!type.value.includes(":")) {
        throw new ValidationError(`Invalid header format: ${type.value}`);
      }
      const [name, ...value] = type.value.split(":");
      return [name.trim(), value.join(":").trim()];
    },
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
  .env(
    "OAPI_HEADER=<header:header[]>",
    "Add request header for authentication.",
    { prefix: "OAPI_" },
  )
  .option(
    "-v, --verbose",
    "Increase debug output.\n" +
      `${red(bold("-"))} -v:   Prints url of loaded \$ref's.\n` +
      `${red(bold("-"))} -vv:  Prints debug informations.\n` +
      `${red(bold("-"))} -vvv: Prints more debug informations.`,
    {
      collect: true,
      // deno-lint-ignore no-inferrable-types
      value: (_, previus: number = 0) => ++previus,
      action: ({ verbose = 0 }) => log.setVerbose(verbose),
    },
  )
  .option(
    "-H, --header <header:header>",
    "Add request header for authentication.",
    { collect: true },
  )
  .action(async (options, file: string) => {
    console.log(
      await stringify(file, {
        headers: options.header,
      }),
    );
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
