import type { Linter } from "eslint"

export interface RestrictedWrapperImport {
  /** Module name confined to a single dir, e.g. "posthog-js". */
  name: string
  /** Dir (relative, e.g. "modules/analytics") where the module may be imported. */
  allowedDir: string
  /** Custom lint message. */
  message?: string
}

export interface I18nOptions {
  /** Extra word patterns (regex sources) allowed as literal JSX text. */
  ignoreWords?: string[]
  /** Extra file globs excluded from the rule (tests and stories are always excluded). */
  ignoreFiles?: string[]
}

export interface LyrolabFrontendOptions {
  /**
   * Dirs where React Query hooks may be imported. These dirs are also treated as
   * the data layer and may not import presentation code. Default: ["data/queries"].
   */
  dataQueryDirs?: string[]
  /** Modules confined to a single wrapper dir. */
  restrictedWrapperImports?: RestrictedWrapperImport[]
  /** Warn threshold for function length (default 150). Pass false to disable. */
  maxLinesPerFunction?: number | false
  /** Enable the type-checked tier (`no-floating-promises`, etc.). */
  typeChecked?: boolean
  /** Root dir for type-checked parsing. */
  tsconfigRootDir?: string
  /** Extra ignore globs. */
  ignores?: string[]
  /**
   * Flag literal JSX text (not attributes) via `i18next/no-literal-string`, outside
   * test and story files. Default: false.
   */
  i18n?: boolean | I18nOptions
  /**
   * Storybook recommended rules for `*.stories.@(ts|tsx)`, with `react/no-multi-comp`
   * and `max-lines-per-function` turned off there. Default: false.
   */
  storybook?: boolean
  /** Extra flat configs appended after the preset. */
  extend?: Linter.Config[]
}

export function lyrolabFrontend(
  options?: LyrolabFrontendOptions,
): Linter.Config[]

export default lyrolabFrontend
