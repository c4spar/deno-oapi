import {
  basename,
  blue,
  bold,
  dim,
  dirname,
  join,
  // deno-lint-ignore camelcase
  OpenAPIV3_1,
  parseYaml,
  stringifyYaml,
  yellow,
} from "./deps.ts";

interface OapiOptions {
  verbose?: number;
}

export function stringify(file: string, options?: OapiOptions): Promise<string>;
export function stringify(
  document: OpenAPIV3_1.Document,
  options?: OapiOptions,
): string;
export function stringify(
  fileOrDocument: string | OpenAPIV3_1.Document,
  options?: OapiOptions,
): string | Promise<string> {
  if (typeof fileOrDocument === "string") {
    return bundle(fileOrDocument, options).then((content) =>
      stringifyYaml(content, { noRefs: true })
    );
  }
  return stringifyYaml(fileOrDocument, { noRefs: true });
}

export async function bundle(
  file: string,
  options?: OapiOptions,
): Promise<OpenAPIV3_1.Document> {
  const base = dirname(file);
  file = basename(file);

  const document = await loadSpec<OpenAPIV3_1.Document>(file, base, options);

  if (document.components) {
    await parseRefs(
      ".",
      document.components,
      base,
      document,
      document,
    );
  }

  if (document.paths) {
    for (const [path, def] of Object.entries(document.paths)) {
      if (def?.$ref && def.$ref.at(0) !== "#") {
        document.paths[path] = await parsePathRef(
          def.$ref,
          base,
          document,
        );
      }
    }
  }

  return document;
}

async function parsePathRef(
  file: string,
  base: string,
  document: OpenAPIV3_1.Document,
) {
  let [path, subPath] = file.split("#");
  subPath = subPath.replace(/\/paths\//g, "");

  const components = await loadSpec<
    OpenAPIV3_1.ComponentsObject & { paths: OpenAPIV3_1.PathsObject }
  >(path, base);

  const paths = subPath.length ? components.paths[subPath] : components.paths;

  return paths && await parseRefs(
    dirname(path),
    paths,
    base,
    components,
    document,
  );
}

async function parseRefs(
  parentPath: string,
  def: Record<string, unknown>,
  basePath: string,
  parentDef: Record<string, unknown>,
  document: OpenAPIV3_1.Document,
): Promise<Record<string, unknown>> {
  for (const [name, value] of Object.entries(def)) {
    if (isRecord(value)) {
      if (typeof value.$ref === "string") {
        if (value.$ref.at(0) === "#") {
          def[name] = parseRef(
            value.$ref,
            parentDef,
            document,
          );
        } else {
          def[name] = await parseExternalRef(
            parentPath,
            value.$ref,
            basePath,
            document,
          );
        }
      } else {
        def[name] = await parseRefs(
          parentPath,
          value,
          basePath,
          parentDef,
          document,
        );
      }
    }
  }

  return def;
}

function parseRef(
  file: string,
  // deno-lint-ignore no-explicit-any
  components: Record<string, any>,
  document: OpenAPIV3_1.Document,
) {
  const [_, subPath] = file.split("#/");
  const subPathParts = subPath.split("/");

  // deno-lint-ignore no-explicit-any
  let docComps: Record<string, any> = document.components ??= {};
  for (const path of subPathParts) {
    components = components[path];
    docComps[path] ??= {};
    docComps = docComps[path];
  }
  Object.assign(docComps, components);

  return { $ref: `#/components/${subPath}` };
}

async function parseExternalRef(
  parentDir: string,
  file: string,
  base: string,
  document: OpenAPIV3_1.Document,
) {
  const [path, subPath] = file.split("#/");
  const subPathParts = subPath.split("/");

  const components = await loadSpec<
    OpenAPIV3_1.ComponentsObject & { paths: OpenAPIV3_1.PathsObject }
  >(path, join(base, parentDir));

  // deno-lint-ignore no-explicit-any
  let comps: Record<string, any> = components;
  // deno-lint-ignore no-explicit-any
  let docComps: Record<string, any> = document.components ??= {};
  for (const path of subPathParts) {
    comps = comps[path];
    docComps[path] ??= {};
    docComps = docComps[path];
  }
  Object.assign(docComps, comps);

  await parseRefs(
    parentDir,
    components,
    base,
    components,
    document,
  );

  return { $ref: `#/components/${subPath}` };
}

function isRemote(file: string): boolean {
  return file.startsWith("http://") || file.startsWith("https://");
}

async function loadSpec<T extends unknown>(
  file: string,
  base: string,
  options?: OapiOptions,
): Promise<T> {
  const verbose = Number(options?.verbose);
  let content: string;

  try {
    if (isRemote(file) || isRemote(base)) {
      const url = isRemote(file) ? new URL(file) : new URL(file, base);
      verbose > 0 && console.log(bold("Load remote ref:"), blue(url.href));
      await Deno.permissions.request({
        name: "net",
        host: url.host,
      });
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${url} - ${await response.text()}`);
      }
      content = await response.text();
    } else {
      const path = join(base, file);
      verbose > 0 && console.log(bold("Load local ref:"), yellow(path));
      await Deno.permissions.request({
        name: "read",
        path: path,
      });
      content = await Deno.readTextFile(path);
    }
    verbose > 2 && console.log(bold("Content:"), dim(content));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`File not found: "${join(base, file)}"`, {
        cause: error,
      });
    } else if (error instanceof Deno.errors.PermissionDenied) {
      throw new Error(`Permission denied: "${join(base, file)}"`, {
        cause: error,
      });
    } else {
      throw error;
    }
  }

  return parseYaml(content) as T;
}

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return !!obj && typeof obj === "object";
}
