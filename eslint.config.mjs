// eslint.config.mjs — ESLint 9 flat config (replaces .eslintrc.js)
import js        from '@eslint/js';
import tsPlugin  from '@typescript-eslint/eslint-plugin';
import tsParser  from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react':              reactPlugin,
      'react-hooks':        reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any':    'warn',
      '@typescript-eslint/no-unused-vars':     ['error', { argsIgnorePattern: '^_' }],
      'react/react-in-jsx-scope':              'off',   // not needed in React 17+
      'react/prop-types':                      'off',   // TypeScript handles this
      'no-console':                            'warn',
    },
  },
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**'],
  },
];
