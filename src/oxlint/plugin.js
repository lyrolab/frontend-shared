/**
 * Oxlint JS plugin with the ESLint core rules Oxlint does not implement natively.
 * Rules use the ESLint rule API, so the plugin also loads in ESLint.
 */
const restrictedSyntax = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow syntax matched by ESLint selectors, like ESLint's no-restricted-syntax.",
    },
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          selector: { type: "string" },
          message: { type: "string" },
        },
        required: ["selector"],
        additionalProperties: false,
      },
    },
  },
  create(context) {
    return Object.fromEntries(
      context.options.map(({ selector, message }) => [
        selector,
        (node) =>
          context.report({
            node,
            message: message ?? `Using '${selector}' is not allowed.`,
          }),
      ]),
    )
  },
}

export default {
  meta: { name: "lyrolab" },
  rules: { "restricted-syntax": restrictedSyntax },
}
