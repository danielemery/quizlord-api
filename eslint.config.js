const config = require('@dtdot/eslint-config');

module.exports = [
  ...config.eslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Overriding/updating/adding rules over the base provided by @dtdot/eslint-config
      '@typescript-eslint/no-floating-promises': 'error',
    }
  },
  {
    ignores: ['build', 'dist', 'eslint.config.*', 'prettier.config.*', 'src/generated/*'],
  }
]
