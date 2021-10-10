# OAPI

Simple OpenAPI Bundler

CLI usage:

```shell
deno install --allow-read -f -r https://deno.land/x/deno-oapi/oapi.ts

oapi --help
```

Module usage:

```typescript
import { bundle, stringify } from "https://deno.land/x/deno-oapi/mod.ts";

const documentStr = await stringify("openapi.yaml");

// of:

const document = await bundle("openapi.yaml");

const documentStr = stringify(document);
```
