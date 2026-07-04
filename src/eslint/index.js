import js from "@eslint/js"
import pluginQuery from "@tanstack/eslint-plugin-query"
import prettierRecommended from "eslint-plugin-prettier/recommended"
import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

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

const dirGlob = (dir) => `**/${dir.replace(/^\/+|\/+$/g, "")}/**`

/**
 * `no-restricted-imports` needs one config per file group, and the last matching
 * config wins. To keep a wrapper's restriction active inside *another* wrapper's
 * allowed dir, every override re-declares the full restriction set minus the tags
 * it exempts — rather than simply turning the rule off. `extraPatterns` layers on
 * group-scoped bans (e.g. the presentation-layer ban inside data dirs).
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

/**
 * Shared Lyrolab frontend flat ESLint config.
 *
 * @param {object} [options]
 * @param {string[]} [options.dataQueryDirs] Dirs where React Query hooks may be imported.
 *   These dirs are also treated as the data layer and may not import presentation code.
 * @param {{ name: string, allowedDir: string, message?: string }[]} [options.restrictedWrapperImports]
 *   Modules confined to a single wrapper dir (e.g. an analytics client in a wrapper dir).
 * @param {number|false} [options.maxLinesPerFunction] Warn threshold for function length
 *   (default 150). Pass false to disable.
 * @param {boolean} [options.typeChecked] Enable the type-checked tier (needs tsconfigRootDir).
 * @param {string} [options.tsconfigRootDir] Root dir for type-checked parsing.
 * @param {string[]} [options.ignores] Extra ignore globs (generated files, build output).
 * @param {import("eslint").Linter.Config[]} [options.extend] Extra configs appended last.
 */
export function lyrolabFrontend({
  dataQueryDirs = ["data/queries"],
  restrictedWrapperImports = [],
  maxLinesPerFunction = 150,
  typeChecked = false,
  tsconfigRootDir,
  ignores = [],
  extend = [],
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

  const tsConfigs = typeChecked
    ? tseslint.configs.recommendedTypeChecked
    : tseslint.configs.recommended

  const config = [
    {
      ignores: [
        "node_modules/**",
        "dist/**",
        "build/**",
        ".output/**",
        ...ignores,
      ],
    },

    js.configs.recommended,
    ...tsConfigs,
    ...pluginQuery.configs["flat/recommended"],
    prettierRecommended,

    {
      files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
      plugins: { react, "react-hooks": reactHooks },
      settings: { react: { version: "detect" } },
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
        "react/no-multi-comp": ["error", { ignoreStateless: false }],
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": [
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
    },

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
  ]

  if (typeChecked) {
    config.push({
      files: ["**/*.{ts,tsx}"],
      languageOptions: {
        parserOptions: {
          projectService: true,
          ...(tsconfigRootDir && { tsconfigRootDir }),
        },
      },
    })
  }

  return [...config, ...extend]
}

export default lyrolabFrontend
