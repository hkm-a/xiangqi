export default [
  {
    ignores: ['dist/', 'node_modules/', 'public/tts/'],
  },
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Worker: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        AudioContext: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        Map: 'readonly',
        Promise: 'readonly',
        navigator: 'readonly',
        globalThis: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-undef': 'error',
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },
  {
    files: ['js/updater.js'],
    languageOptions: {
      globals: {
        globalThis: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        Promise: 'readonly',
      },
    },
  },
  {
    files: ['js/ai-worker.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        self: 'readonly',
        performance: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    // 纯逻辑模块：无 DOM / Web API
    files: [
      'js/ai.js',
      'js/game.js',
      'js/pieces.js',
      'js/perpetual.js',
      'js/fen.js',
      'js/constants.js',
      'js/notation.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        performance: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-undef': 'error',
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },
]
