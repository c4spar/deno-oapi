# OAPI

A Simple OpenAPI Bundler

### CLI usage

#### Install

```shell
deno install --allow-read --allow-net -f -r https://raw.githubusercontent.com/c4spar/deno-oapi/main/oapi.ts
```

You can also omit the permission flag than the permissions will be requested if
needed:

```shell
deno install -f -r https://raw.githubusercontent.com/c4spar/deno-oapi/main/oapi.ts
```

#### Usage

```shell
oapi bundle ./openapi.yaml > ./openapi.bundle.yaml
```

or with a rmote file:

```shell
oapi bundle https://raw.githubusercontent.com/c4spar/deno-oapi/main/example/openapi.yaml
```

### Module usage

```typescript
import {
  bundle,
  stringify,
} from "https://raw.githubusercontent.com/c4spar/deno-oapi/main/mod.ts";

const documentStr = await stringify("openapi.yaml");

// or:

const document = await bundle("openapi.yaml");

const documentStr = stringify(document);
```
