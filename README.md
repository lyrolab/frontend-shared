# @lyrolab/frontend-shared

Shared ESLint / Prettier / TypeScript presets and architecture guidelines for Lyrolab web
frontends. The frontend counterpart to [`@lyrolab/nest-shared`](https://github.com/lyrolab/nest-shared).

## Install

```bash
npm i -D @lyrolab/frontend-shared
```

## Usage

### ESLint (`eslint.config.mjs`)

```js
import { lyrolabFrontend } from "@lyrolab/frontend-shared/eslint"

export default lyrolabFrontend({
  dataQueryDirs: ["data/queries"],
  restrictedWrapperImports: [
    { name: "posthog-js", allowedDir: "modules/analytics" },
  ],
  ignores: ["src/routeTree.gen.ts", "src/clients/**"],
})
```

Options:

| Option                     | Default            | Purpose                                                                                                                |
| -------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `dataQueryDirs`            | `["data/queries"]` | Dirs where React Query hooks may be imported. These dirs are also the data layer and may not import presentation code. |
| `restrictedWrapperImports` | `[]`               | Modules confined to one dir (e.g. an analytics client → its wrapper dir).                                              |
| `maxLinesPerFunction`      | `150`              | Warn threshold for function length. Pass `false` to disable.                                                           |
| `typeChecked`              | `false`            | Enables the type-checked tier (`no-floating-promises`, etc.). Set `tsconfigRootDir` too.                               |
| `ignores`                  | `[]`               | Extra ignore globs (generated files, build output).                                                                    |
| `extend`                   | `[]`               | Extra flat configs appended after the preset.                                                                          |

The preset bundles: `@eslint/js` recommended, `typescript-eslint`, `eslint-plugin-react-hooks`
(rules-of-hooks + exhaustive-deps), `react/no-multi-comp` (one component per file),
`max-lines-per-function` (warn), `@tanstack/eslint-plugin-query`, Prettier, and the architecture
guardrails: React Query and wrapper-only imports are confined to their dirs, and the data layer
may not import the presentation layer (`components/`, `pages/`, `entrypoints/`, `layout/`).

### Prettier (`prettier.config.mjs`)

```js
import config from "@lyrolab/frontend-shared/prettier" with { type: "json" }
export default config
```

### TypeScript (`tsconfig.json`)

```jsonc
{ "extends": "@lyrolab/frontend-shared/tsconfig" }
```

## Guidelines

The full architecture guidelines ship in [`GUIDELINES.md`](./GUIDELINES.md) and are readable from
`node_modules/@lyrolab/frontend-shared/GUIDELINES.md` (also exported as
`@lyrolab/frontend-shared/guidelines`).

## Releasing

Automated via semantic-release on push to `main` (conventional commits, npm Trusted Publishing
via OIDC). No manual version bumps — the `version` field stays `0.0.0-semantically-released`.
