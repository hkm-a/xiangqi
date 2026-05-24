export default [
  {
    ignores: ['dist/', 'node_modules/'],
  },
  {
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },
]
