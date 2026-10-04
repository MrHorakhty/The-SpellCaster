export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'src-tauri/**',
      '**/*.stackdump'
    ]
  },
  {
    // Node-side config files run outside the browser, so they get Node globals.
    // vite.config.js reads TAURI_DEV_HOST off the environment (line 5).
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly'
      }
    }
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        Audio: 'readonly',
        fetch: 'readonly',
        alert: 'readonly',
        navigator: 'readonly',
        ResizeObserver: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': 'warn'
    }
  }
]
