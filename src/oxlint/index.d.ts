import type { OxlintConfig, OxlintOverride } from "oxlint"

import type { RestrictedWrapperImport, I18nOptions } from "../eslint/index.js"

export type { RestrictedWrapperImport, I18nOptions }

export interface LyrolabFrontendOxlintOptions {
  /**
   * Dirs where React Query hooks may be imported. These dirs are also treated as
   * the data layer and may not import presentation code. Default: ["data/queries"].
   */
  dataQueryDirs?: string[]
  /** Modules confined to a single wrapper dir. */
  restrictedWrapperImports?: RestrictedWrapperImport[]
  /** Warn threshold for function length (default 150). Pass false to disable. */
  maxLinesPerFunction?: number | false
  /** Type-aware rules (`no-floating-promises`, …) through oxlint-tsgolint. Default: false. */
  typeChecked?: boolean
  /** Extra ignore globs. */
  ignores?: string[]
  /** Flag literal JSX text via `i18next/no-literal-string`, outside tests and stories. */
  i18n?: boolean | I18nOptions
  /** Storybook recommended rules for `*.stories.{ts,tsx}`. Default: false. */
  storybook?: boolean
  /** Extra overrides appended after the preset's. Later overrides win. */
  overrides?: OxlintOverride[]
}

/** Oxlint equivalents of `@eslint/js` and `typescript-eslint` recommended. */
export const recommendedRules: Record<string, "error">
/** Oxlint equivalents of `typescript-eslint` recommendedTypeChecked's extra rules. */
export const typeCheckedRules: Record<string, "error">
/** The `lyrolab` JS plugin entry (`lyrolab/restricted-syntax`). */
export const lyrolabPlugin: { name: "lyrolab"; specifier: string }

export function lyrolabFrontend(
  options?: LyrolabFrontendOxlintOptions,
): OxlintConfig

export default lyrolabFrontend
