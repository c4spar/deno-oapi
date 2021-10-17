import {
  basename,
  blue,
  dim,
  dirname,
  green,
  join,
  // deno-lint-ignore camelcase
  OpenAPIV3_1,
  parseYaml,
  stringifyYaml,
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
  console.error(green("Bundle"), file);
  const base = dirname(file);
  file = basename(file);

  const document = await loadSpec<OpenAPIV3_1.Document>(
    file,
    base,
    undefined,
    options,
  );

  if (document.components) {
    await parseRefs(
      ".",
      document.components,
      base,
      document,
      document,
      options,
    );
  }

  if (document.paths) {
    for (const [path, def] of Object.entries(document.paths)) {
      if (def?.$ref && def.$ref.at(0) !== "#") {
        document.paths[path] = await parsePathRef(
          def.$ref,
          base,
          document,
          options,
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
  options?: OapiOptions,
) {
  let [path, subPath] = file.split("#");
  subPath = subPath.replace(/\/paths\//g, "");

  const components = await loadSpec<
    OpenAPIV3_1.ComponentsObject & { paths: OpenAPIV3_1.PathsObject }
  >(path, base, undefined, options);

  const paths = components.paths[subPath];

  if (!paths) {
    throw new Error(`Path ref "${file}" not found.`);
  }

  return paths && await parseRefs(
    dirname(path),
    paths,
    base,
    components,
    document,
    options,
  );
}

async function parseRefs(
  parentPath: string,
  def: Record<string, unknown>,
  basePath: string,
  parentDef: Record<string, unknown>,
  document: OpenAPIV3_1.Document,
  options?: OapiOptions,
): Promise<Record<string, unknown>> {
  for (const [name, value] of Object.entries(def)) {
    if (isRecord(value)) {
      if (typeof value.$ref === "string") {
        if (value.$ref.at(0) === "#") {
          def[name] = parseInternalRef(
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
            options,
          );
        }
      } else {
        def[name] = await parseRefs(
          parentPath,
          value,
          basePath,
          parentDef,
          document,
          options,
        );
      }
    }
  }

  return def;
}

function parseInternalRef(
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
    if (!components[path]) {
      throw new ReferenceError(`Ref "${file}" not found.`);
    }
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
  options?: OapiOptions,
) {
  const [path, subPath] = file.split("#/");
  const subPathParts = subPath.split("/");

  const components = await loadSpec<
    OpenAPIV3_1.ComponentsObject & { paths: OpenAPIV3_1.PathsObject }
  >(path, base, parentDir, options);

  // deno-lint-ignore no-explicit-any
  let comps: Record<string, any> = components;
  // deno-lint-ignore no-explicit-any
  let docComps: Record<string, any> = document.components ??= {};
  for (const path of subPathParts) {
    if (!comps[path]) {
      throw new ReferenceError(`External ref "${file}" not found.`);
    }
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
    options,
  );

  return { $ref: `#/components/${subPath}` };
}

async function loadSpec<T extends unknown>(
  file: string,
  base: string,
  parentDir?: string,
  options?: OapiOptions,
): Promise<T> {
  const verbose = Number(options?.verbose);
  let content: string;

  try {
    if (isRemote(file) || isRemote(base)) {
      const url = isRemote(file)
        ? new URL(file)
        : new URL(parentDir ? parentDir + "/" + file : file, base + "/");

      verbose > 0 && console.error(green("Load remote ref"), blue(url.href));

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
      const path = parentDir ? join(base, parentDir, file) : join(base, file);

      verbose > 0 && console.error(green("Load local ref"), blue(path));

      await Deno.permissions.request({
        name: "read",
        path,
      });

      content = await Deno.readTextFile(path);
    }

    verbose > 2 && console.error(dim(content));
  } catch (error) {
    verbose > 2 && console.error(error);
    if (error instanceof Deno.errors.NotFound) {
      throw new Deno.errors.NotFound(
        `File not found: "${join(base, file)}"`,
        { cause: error },
      );
    } else if (error instanceof Deno.errors.PermissionDenied) {
      throw new Deno.errors.PermissionDenied(
        `Permission denied: "${join(base, file)}"`,
        { cause: error },
      );
    } else {
      throw error;
    }
  }

  return parseYaml(content) as T;
}

function isRemote(file: string): boolean {
  return file.startsWith("http://") || file.startsWith("https://");
}

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return !!obj && typeof obj === "object";
}
