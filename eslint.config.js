import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.worker },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'InkDoze must not make network requests.' },
        { name: 'XMLHttpRequest', message: 'InkDoze must not make network requests.' },
        { name: 'WebSocket', message: 'InkDoze must not make network requests.' },
        { name: 'EventSource', message: 'InkDoze must not make network requests.' },
      ],
    },
  },
  {
    files: ['scripts/**/*.ts', 'e2e/**/*.ts', '*.config.{ts,js}', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-globals': 'off' },
  },
);
