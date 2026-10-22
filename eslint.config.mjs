import globals from "globals"

import { lyrolabFrontend } from "./src/eslint/index.js"

export default lyrolabFrontend({
  ignores: ["docs/**"],
  extend: [
    {
      files: ["test/**", "src/playwright/**"],
      languageOptions: { globals: globals.node },
    },
  ],
})
