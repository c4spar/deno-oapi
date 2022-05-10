import { log } from "./debug.ts";
import {
  blue,
  dim,
  dirname,
  grant,
  green,
  join,
  magenta,
  OpenAPIV3_1,
  parseYaml,
  stringifyYaml,
} from "./deps.ts";

interface Spec {
  file: string;
  base: string;
  document: OpenAPIV3_1.Document;
  cache: Record<string, boolean>;
  fileCache: Record<string, unknown>;
}

interface Context {
  file: string;
  base: string;
  document: Record<string, unknown>;
}

export interface BundleOptions {
  headers?: HeadersInit;
}

export function stringify(
  file: string,
  options?: BundleOptions,
): Promise<string>;
export function stringify(
  document: OpenAPIV3_1.Document,
): string;
export function stringify(
  fileOrDocument: string | OpenAPIV3_1.Document,
  options?: BundleOptions,
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
  options?: BundleOptions,
): Promise<OpenAPIV3_1.Document> {
  log.info(green("Bundle"), file);

  const fileCache = {};

  const document = await loadSpec<OpenAPIV3_1.Document>(
    file,
    fileCache,
    options,
  );

  const spec: Spec = {
    file,
    base: dirname(file),
    document,
    cache: {},
    fileCache,
  };

  if (document.components) {
    document.components = await parseRefs(
      ".",
      document.components,
      spec,
      spec,
      options,
    );
  }

  if (document.paths) {
    for (const [path, node] of Object.entries(document.paths)) {
      if (node?.$ref && node.$ref.at(0) !== "#") {
        document.paths[path] = await parsePathRef(node.$ref, spec, options);
      }
    }
  }

  return document;
}

async function parsePathRef(
  $ref: string,
  spec: Spec,
  options?: BundleOptions,
) {
  log.debugVerbose(
    "Parse path ref %s %s",
    blue(spec.file),
    magenta($ref),
  );
  const [$file, $path] = $ref.split("#/");

  const document = await loadSpec<
    OpenAPIV3_1.ComponentsObject & { paths: OpenAPIV3_1.PathsObject }
  >(
    $file,
    spec.fileCache,
    options,
    spec.base,
  );
  const context: Context = { file: $ref, base: dirname($file), document };

  const node = get($path, document);

  return parseRefs(
    dirname($file),
    node,
    context,
    spec,
    options,
  );
}

async function parseRefs(
  currentDir: string,
  node: Record<string, unknown>,
  context: Context,
  spec: Spec,
  options?: BundleOptions,
): Promise<Record<string, unknown>> {
  for (const [name, value] of Object.entries(node)) {
    if (isRecord(value)) {
      if (typeof value.$ref === "string") {
        if (value.$ref.at(0) === "#") {
          node[name] = await parseInternalRef(
            value.$ref,
            currentDir,
            context,
            spec,
            options,
          );
        } else {
          node[name] = await parseExternalRef(
            value.$ref,
            currentDir,
            context,
            spec,
            options,
          );
        }
      } else {
        node[name] = await parseRefs(
          currentDir,
          value,
          context,
          spec,
          options,
        );
      }
    }
  }

  return node;
}

async function parseInternalRef(
  $ref: string,
  currentDir: string,
  context: Context,
  spec: Spec,
  options?: BundleOptions,
) {
  const [_, $path] = $ref.split("#/");
  const cacheKey = context.file + $ref;
  if (spec.cache[cacheKey]) {
    log.debugUgly(
      "Parse int ref %s %s %s",
      blue(context.file),
      magenta($ref),
      dim("(From cache)"),
    );
    return { $ref: `#/${$path}` };
  }
  log.debugVerbose(
    "Parse int ref %s %s",
    blue(context.file),
    magenta($ref),
  );

  spec.document.components ??= {};
  const node = get($path, context.document);
  const docNode = get($path, spec.document, true);

  await parseRefs(
    currentDir,
    node,
    context,
    spec,
    options,
  );

  Object.assign(docNode, node);

  return { $ref: `#/${$path}` };
}

async function parseExternalRef(
  $ref: string,
  currentDir: string,
  parentContext: Context,
  spec: Spec,
  options?: BundleOptions,
) {
  const cacheKey = getPath($ref, spec.base, currentDir);
  const [$file, $path] = $ref.split("#/");

  if (spec.cache[cacheKey]) {
    log.debugUgly(
      "Parse ext ref %s %s %s",
      blue(parentContext.file),
      magenta($ref),
      dim("(From cache)"),
    );
    return { $ref: `#/${$path}` };
  }
  log.debugVerbose(
    "Parse ext ref %s %s",
    blue(parentContext.file),
    magenta($ref),
  );
  spec.cache[cacheKey] = true;

  const document = await loadSpec<
    OpenAPIV3_1.ComponentsObject & { paths: OpenAPIV3_1.PathsObject }
  >(
    $file,
    spec.fileCache,
    options,
    spec.base,
    currentDir,
  );
  const context: Context = { file: $file, base: dirname($file), document };

  spec.document.components ??= {};
  const node = get($path, document);
  const docNode = get($path, spec.document, true);

  await parseRefs(
    join(currentDir, dirname($file)),
    node,
    context,
    spec,
    options,
  );

  Object.assign(docNode, node);

  return { $ref: `#/${$path}` };
}

function get(path: string, context: Record<string, unknown>, create?: boolean) {
  const fullPath = [];
  const subPathParts = path.split("/");
  let node = context;
  for (const subPath of subPathParts) {
    fullPath.push(subPath);
    if (!node[subPath]) {
      if (create) {
        node[subPath] = {};
      } else {
        throw new ReferenceError(
          `Ref "${fullPath.join("/")}" not found ("${path}").\n${
            Deno.inspect(context, { colors: true })
          }`,
        );
      }
    }
    node = node[subPath] as Record<string, unknown>;
  }
  return node;
}

function getPath(
  file: string,
  base?: string,
  currentDir?: string,
) {
  if (isRemote(file) || (base && isRemote(base))) {
    const url = isRemote(file) ? new URL(file) : new URL(
      currentDir ? currentDir + "/" + file : file,
      base + "/",
    );
    return url.toString();
  }

  return base && currentDir ? join(base, currentDir, file) : (
    base ? join(base, file) : file
  );
}

async function loadSpec<T extends unknown>(
  file: string,
  fileCache: Record<string, unknown>,
  options?: BundleOptions,
  base?: string,
  currentDir?: string,
): Promise<T> {
  let content: string;
  const path = getPath(file, base, currentDir);

  if (fileCache[path]) {
    log.debugUgly(
      green("Load remote ref %s %s"),
      blue(path),
      dim("(From cache)"),
    );
    return fileCache[path] as T;
  }

  try {
    if (isRemote(path)) {
      log.debug(green("Load remote ref"), blue(path));
      await grant({
        name: "net",
        host: new URL(path).hostname,
      });

      const response = await fetch(path, {
        headers: options?.headers,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${path} - ${await response.text()}`);
      }

      content = await response.text();
    } else {
      log.debug(green("Load local ref"), blue(path));
      await grant({
        name: "read",
        path,
      });

      content = await Deno.readTextFile(path);
    }
  } catch (error) {
    log.debugVerbose(error);
    if (error instanceof Deno.errors.NotFound) {
      throw new Deno.errors.NotFound(
        `File not found: "${path}"`,
        { cause: error },
      );
    } else if (error instanceof Deno.errors.PermissionDenied) {
      throw new Deno.errors.PermissionDenied(
        `Permission denied: "${path}"`,
        { cause: error },
      );
    } else {
      throw error;
    }
  }

  fileCache[path] = parseYaml(content);

  return fileCache[path] as T;
}

function isRemote(file: string): boolean {
  return file.startsWith("http://") || file.startsWith("https://");
}

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return !!obj && typeof obj === "object";
}
