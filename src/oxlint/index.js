import pluginQuery from "@tanstack/eslint-plugin-query"
import storybook from "eslint-plugin-storybook"
import { fileURLToPath } from "node:url"

import { recommendedRules, typeCheckedRules } from "./rules.js"

export { recommendedRules, typeCheckedRules } from "./rules.js"

// Oxlint resolves a JS plugin specifier from the consuming project, where pnpm's strict
// layout hides this package's dependencies, so every plugin is passed as an absolute path.
const pluginPath = (specifier) => fileURLToPath(import.meta.resolve(specifier))

/** The `lyrolab` JS plugin: `lyrolab/restricted-syntax`, a port of `no-restricted-syntax`. */
export const lyrolabPlugin = {
  name: "lyrolab",
  specifier: fileURLToPath(new URL("./plugin.js", import.meta.url)),
}

const QUERY_PLUGIN = "@tanstack/query"

const renamePrefix = (rules, from, to) =>
  Object.fromEntries(
    Object.entries(rules).map(([name, value]) => [
      name.replace(`${from}/`, `${to}/`),
      value,
    ]),
  )

const queryRules = renamePrefix(
  Object.assign(
    {},
    ...pluginQuery.configs["flat/recommended"].map((c) => c.rules),
  ),
  "@tanstack/query",
  QUERY_PLUGIN,
)

// eslint-plugin-react-hooks v7 `recommended-latest`, which Oxlint implements natively.
// `config` and `gating` validate React Compiler annotations and have no Oxlint equivalent.
const reactHooksRules = {
  "react/rules-of-hooks": "error",
  "react/exhaustive-deps": "warn",
  "react/error-boundaries": "error",
  "react/globals": "error",
  "react/immutability": "error",
  "react/incompatible-library": "warn",
  "react/preserve-manual-memoization": "error",
  "react/purity": "error",
  "react/refs": "error",
  "react/set-state-in-effect": "error",
  "react/set-state-in-render": "error",
  "react/static-components": "error",
  "react/unsupported-syntax": "warn",
  "react/use-memo": "error",
  "react/void-use-memo": "error",
}

const REACT_QUERY_MODULE = "@tanstack/react-query"

const REACT_QUERY_HOOKS = [
  "useQuery",
  "useSuspenseQuery",
  "useInfiniteQuery",
  "useSuspenseInfiniteQuery",
  "useMutation",
]

// The data layer is the lowest layer and must never depend on presentation.
const PRESENTATION_LAYER_BAN = {
  group: [
    "**/components/**",
    "**/pages/**",
    "**/entrypoints/**",
    "**/layout/**",
  ],
  message:
    "The data layer must not import the presentation layer (components/pages). Keep data at the lowest layer — see the frontend guidelines.",
}

const TEST_FILES = [
  "**/*.{test,spec}.{ts,tsx,js,jsx}",
  "**/__tests__/**",
  "**/__mocks__/**",
]

const STORY_FILES = ["**/*.stories.{ts,tsx}"]

const CONFIG_FILES = ["**/*.config.{js,mjs,cjs,ts,mts,cts}"]

const dirGlob = (dir) => `**/${dir.replace(/^\/+|\/+$/g, "")}/**`

/**
 * `no-restricted-imports` takes one option set per file group, and the last matching
 * override wins. To keep a wrapper's restriction active inside *another* wrapper's
 * allowed dir, every override re-declares the full restriction set minus the tags
 * it exempts — rather than simply turning the rule off.
 */
const buildRestriction = (
  restrictions,
  { exemptTags = [], extraPatterns = [] } = {},
) => {
  const active = restrictions.filter((r) => !exemptTags.includes(r.tag))

  const paths = active.filter((r) => r.path).map((r) => r.path)
  const patterns = [
    ...active.filter((r) => r.pattern).map((r) => r.pattern),
    ...extraPatterns,
  ]

  if (paths.length === 0 && patterns.length === 0) {
    return { "no-restricted-imports": "off" }
  }

  return {
    "no-restricted-imports": [
      "error",
      { ...(paths.length && { paths }), ...(patterns.length && { patterns }) },
    ],
  }
}

const i18nOverride = ({ ignoreWords = [], ignoreFiles = [] }) => ({
  files: ["**/*.{jsx,tsx}"],
  excludeFiles: [...TEST_FILES, ...STORY_FILES, ...ignoreFiles],
  jsPlugins: [
    {
      name: "i18next",
      specifier: fileURLToPath(new URL("./i18next-plugin.js", import.meta.url)),
    },
  ],
  rules: {
    "i18next/no-literal-string": [
      "error",
      { mode: "jsx-text-only", words: { exclude: ignoreWords } },
    ],
  },
})

const storybookOverride = () => {
  const { rules } = storybook.configs["flat/recommended"].find((c) =>
    c.name?.endsWith(":stories-rules"),
  )
  // The upstream preset also toggles rules of plugins this preset doesn't load (e.g. import-x).
  const storiesRules = renamePrefix(
    Object.fromEntries(
      Object.entries(rules).filter(([name]) =>
        ["storybook/", "react-hooks/"].some((prefix) =>
          name.startsWith(prefix),
        ),
      ),
    ),
    "react-hooks",
    "react",
  )

  return {
    files: STORY_FILES,
    jsPlugins: [
      { name: "storybook", specifier: pluginPath("eslint-plugin-storybook") },
    ],
    rules: {
      ...storiesRules,
      "react/no-multi-comp": "off",
      "max-lines-per-function": "off",
    },
  }
}

/**
 * Shared Lyrolab frontend Oxlint config, the Oxlint counterpart of the ESLint preset.
 *
 * @param {import("./index.d.ts").LyrolabFrontendOxlintOptions} [options]
 * @returns {import("oxlint").OxlintConfig}
 */
export function lyrolabFrontend({
  dataQueryDirs = ["data/queries"],
  restrictedWrapperImports = [],
  maxLinesPerFunction = 150,
  typeChecked = false,
  ignores = [],
  i18n = false,
  storybook: storybookEnabled = false,
  overrides = [],
} = {}) {
  const restrictions = [
    {
      tag: "react-query",
      path: {
        name: REACT_QUERY_MODULE,
        importNames: REACT_QUERY_HOOKS,
        message:
          "React Query hooks live only in data/queries wrappers, never in components. See frontend guidelines §3.3.",
      },
    },
    ...restrictedWrapperImports.map((w) => ({
      tag: `wrapper:${w.allowedDir}`,
      path: {
        name: w.name,
        message: w.message ?? `Import "${w.name}" only inside ${w.allowedDir}.`,
      },
      pattern: {
        group: [`${w.name}/*`],
        message: w.message ?? `Import "${w.name}" only inside ${w.allowedDir}.`,
      },
    })),
  ]

  return {
    plugins: ["typescript", "unicorn", "oxc", "react"],
    jsPlugins: [
      {
        name: QUERY_PLUGIN,
        specifier: pluginPath("@tanstack/eslint-plugin-query"),
      },
      lyrolabPlugin,
    ],
    categories: { correctness: "error" },
    env: { browser: true, es2024: true },
    ignorePatterns: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".output/**",
      ...ignores,
    ],
    ...(typeChecked && { options: { typeAware: true } }),
    rules: {
      ...recommendedRules,
      ...(typeChecked && typeCheckedRules),
      ...queryRules,
      ...reactHooksRules,
      "react/no-multi-comp": ["error", { ignoreStateless: false }],
      "typescript/no-explicit-any": "warn",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      ...(maxLinesPerFunction && {
        "max-lines-per-function": [
          "warn",
          {
            max: maxLinesPerFunction,
            skipBlankLines: true,
            skipComments: true,
          },
        ],
      }),
      ...buildRestriction(restrictions),
    },
    overrides: [
      { files: CONFIG_FILES, env: { node: true } },

      // Data dirs may import React Query hooks, but as the lowest layer must not
      // import presentation code; wrapper restrictions still apply.
      {
        files: dataQueryDirs.map(dirGlob),
        rules: buildRestriction(restrictions, {
          exemptTags: ["react-query"],
          extraPatterns: [PRESENTATION_LAYER_BAN],
        }),
      },

      // Each wrapper dir exempts its own module; every other restriction stays on.
      ...restrictedWrapperImports.map((w) => ({
        files: [dirGlob(w.allowedDir)],
        rules: buildRestriction(restrictions, {
          exemptTags: [`wrapper:${w.allowedDir}`],
        }),
      })),

      ...(i18n ? [i18nOverride(i18n === true ? {} : i18n)] : []),
      ...(storybookEnabled ? [storybookOverride()] : []),
      ...overrides,
    ],
  }
}

export default lyrolabFrontend
