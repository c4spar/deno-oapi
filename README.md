# OAPI

Simple OpenAPI Bundler

### CLI usage

#### Install

```shell
deno install --allow-read --allow-net -f -r https://deno.land/x/openapi_bundler/oapi.ts
```

You can also omit the permission flag than the permissions will be requested if
needed:

```shell
deno install -f -r https://deno.land/x/openapi_bundler/oapi.ts
```

#### Usage

```shell
oapi bundle ./openapi.yaml > ./openapi.bundle.yaml
```

### Module usage

```typescript
import { bundle, stringify } from "https://deno.land/x/openapi_bundler/mod.ts";

const documentStr = await stringify("openapi.yaml");

// or:

const document = await bundle("openapi.yaml");

const documentStr = stringify(document);
```
