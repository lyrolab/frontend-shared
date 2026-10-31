import i18next from "eslint-plugin-i18next"
import i18nextDefaults from "eslint-plugin-i18next/lib/options/defaults.js"

/**
 * eslint-plugin-i18next for Oxlint. Oxlint passes rule options as JSON, so the
 * plugin's default word excludes, which are RegExp objects (e.g. emoji-only text),
 * are prepended here instead of in the config.
 */
const noLiteralString = i18next.rules["no-literal-string"]

const withDefaultWords = (context) => {
  const [options = {}] = context.options
  const words = options.words ?? {}
  const merged = [
    {
      ...options,
      words: {
        ...words,
        exclude: [...i18nextDefaults.words.exclude, ...(words.exclude ?? [])],
      },
    },
  ]
  // Oxlint freezes the context, so the options are shadowed on a derived object.
  return Object.create(context, { options: { value: merged } })
}

export default {
  meta: { name: "i18next" },
  rules: {
    "no-literal-string": {
      ...noLiteralString,
      create: (context) => noLiteralString.create(withDefaultWords(context)),
    },
  },
}
