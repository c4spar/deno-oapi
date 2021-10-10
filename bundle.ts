import {
  basename,
  dirname,
  join,
  // deno-lint-ignore camelcase
  OpenAPIV3_1,
  parseYaml,
  stringifyYaml,
} from "./deps.ts";

export async function stringify(file: string | OpenAPIV3_1.Document) {
  return stringifyYaml(
    typeof file === "string" ? await bundle(file) : file,
    { noRefs: true },
  );
}

export async function bundle(file: string): Promise<OpenAPIV3_1.Document> {
  const base = dirname(file);
  file = basename(file);

  const document = await loadSpec<OpenAPIV3_1.Document>(file, base);

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
): Promise<T> {
  let content: string;

  try {
    if (isRemote(file)) {
      const response = await fetch(file);
      content = await response.text();
    } else if (isRemote(base)) {
      const response = await fetch(new URL(file, base));
      content = await response.text();
    } else {
      content = await Deno.readTextFile(join(base, file));
    }
  } catch (error) {
    throw new Error(`File not found: "${join(base, file)}"`, { cause: error });
  }

  return parseYaml(content) as T;
}

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return !!obj && typeof obj === "object";
}
