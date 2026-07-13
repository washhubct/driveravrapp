// Lint minimale, zero dipendenze nel repo: eseguire con `npx eslint js/ sw.js`
export default [
  {
    files: ['js/**/*.js', 'sw.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
];
