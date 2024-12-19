const config = require('@dtdot/eslint-config');

module.exports = [
  ...config.eslint.configs.recommended,
  {
    rules: {
      // Place any rule overrides in here
    }
  },
  {
    ignores: ['build', 'dist', 'eslint.config.*', 'prettier.config.*', 'src/generated/*'],
  }
]
