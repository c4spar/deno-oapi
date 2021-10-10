<h1 align="center">OpenAPI Bundler</h1>

<p align="center">
  <a href="https://github.com/c4spar/deno-oapi/actions/workflows/test.yml">
    <img alt="Build status" src="https://github.com/c4spar/deno-oapi/workflows/Test/badge.svg?branch=main" />
  </a>
  <a href="https://codecov.io/gh/c4spar/deno-oapi">
    <img src="https://codecov.io/gh/c4spar/deno-oapi/branch/main/graph/badge.svg"/>
  </a>
  <a href="../LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/c4spar/deno-oapi?logo=github" />
  </a>
</p>

<p align="center">
  <b>A Simple OpenAPI Bundler</b>
</p>

### CLI

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

### Module

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
