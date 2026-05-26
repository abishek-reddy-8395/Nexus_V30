/**
 * Nexus V30 — ESLint Boundary Rules
 *
 * Enforces the architectural dependency rules from ARCHITECTURE_RULES.md
 * at the linter level. CI will fail if these rules are violated.
 *
 * Uses: eslint-plugin-import + eslint-plugin-boundaries
 *
 * Install: pnpm add -D eslint-plugin-boundaries eslint-plugin-import
 */

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import', 'boundaries'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],

  settings: {
    'boundaries/elements': [
      { type: 'frontend',    pattern: 'apps/web/src/**' },
      { type: 'sdk',         pattern: 'packages/sdk/**' },
      { type: 'shared-types',pattern: 'packages/shared-types/**' },
      { type: 'contracts',   pattern: 'packages/contracts/**' },
      { type: 'api',         pattern: 'backend/src/api/**' },
      { type: 'modules',     pattern: 'backend/src/modules/**' },
      { type: 'engines',     pattern: 'backend/src/engines/**' },
      { type: 'ai',          pattern: 'backend/src/ai/**' },
      { type: 'workers',     pattern: 'backend/src/workers/**' },
      { type: 'events',      pattern: 'backend/src/events/**' },
      { type: 'shared',      pattern: 'backend/src/shared/**' },
    ],
  },

  rules: {
    // ── Architecture boundary rules ──────────────────────────────────
    'boundaries/element-types': ['error', {
      default: 'disallow',
      rules: [
        // Frontend can only use the SDK and shared-types
        { from: 'frontend',  allow: ['sdk', 'shared-types', 'contracts'] },

        // SDK wraps api calls — depends on shared-types for typing
        { from: 'sdk',       allow: ['shared-types', 'contracts'] },

        // API routes delegate to modules only
        { from: 'api',       allow: ['modules', 'shared', 'contracts', 'shared-types'] },

        // Modules use engines and events — never each other directly
        { from: 'modules',   allow: ['engines', 'events', 'shared', 'shared-types'] },

        // Engines use shared only — never modules, never each other's internals
        { from: 'engines',   allow: ['shared', 'shared-types'] },

        // AI uses shared-types (sanitised inputs) — never engines directly
        { from: 'ai',        allow: ['shared', 'shared-types', 'contracts'] },

        // Workers use events + engines (for scheduled runs) + shared
        { from: 'workers',   allow: ['events', 'engines', 'modules', 'shared', 'shared-types'] },

        // Events use contracts + shared only
        { from: 'events',    allow: ['contracts', 'shared', 'shared-types'] },

        // Shared has zero external deps
        { from: 'shared',    allow: [] },

        // Contracts depend on nothing
        { from: 'contracts', allow: [] },
        { from: 'shared-types', allow: [] },
      ],
    }],

    // ── Standard rules ────────────────────────────────────────────────
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'import/no-cycle': 'error',         // circular deps fail CI
    'import/no-self-import': 'error',
  },

  overrides: [
    {
      // Tests can import anything (for mocking)
      files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**'],
      rules: { 'boundaries/element-types': 'off' },
    },
  ],
};
