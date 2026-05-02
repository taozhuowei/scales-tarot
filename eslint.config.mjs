/**
 * ESLint flat config — Mini Program safety rules
 * Targets app/src/ only. Forbids Web-only DOM APIs that crash in WeChat Mini Program.
 * Server and test code are excluded since they run in Node.
 */

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import sonarjs from 'eslint-plugin-sonarjs'

/** DOM globals forbidden in Mini Program runtime */
const FORBIDDEN_GLOBALS = [
  'window', 'document', 'navigator', 'location', 'history',
  'alert', 'confirm', 'prompt',
  'localStorage', 'sessionStorage',
  'HTMLElement', 'Element', 'Node',
  'requestAnimationFrame', 'cancelAnimationFrame',
].map(name => ({ name, message: `"${name}" is not available in WeChat Mini Program. Use uni-app APIs instead.` }))

export default tseslint.config(
  // Global ignores
  { ignores: ['node_modules/', 'dist/', 'app/dist/'] },

  // Base recommended rules
  js.configs.recommended,

  // TypeScript recommended
  ...tseslint.configs.recommended,

  // Vue 3 essential (not recommended — avoids opinionated formatting rules)
  ...pluginVue.configs['flat/essential'],

  // SonarJS — cognitive complexity, code smells, SOLID-adjacent rules.
  // Applied to source code only (skips tests / configs).
  //
  // Ratchet plan (TODO.md 阶段 8):
  // The five rules below are at 'warn' to keep the existing baseline from
  // blocking CI. Each will be ratcheted to 'error' on a fixed date once the
  // remaining warnings are resolved (currently: ~9 across app/src + server/src).
  // The ratchet schedule lives in TODO.md so the deadline is auditable; do
  // not silently leave 'warn' here forever.
  //
  //   void-use                      → error after the 3 fire-and-forget sites
  //                                   are reviewed (real intent vs missing await).
  //   no-small-switch               → error after the legacy switch in
  //                                   reading_provider.ts is fully retired.
  //   no-nested-conditional         → error after parseServerError-style
  //                                   refactors land for the remaining 4 hits.
  //   no-all-duplicated-branches    → error after no-small-switch is fixed
  //                                   (paired finding).
  //   slow-regex                    → error after the theme.ts regex is
  //                                   already removed (now down to 0 hits;
  //                                   keep guarding for future regressions).
  {
    files: ['app/src/**/*.{ts,vue}', 'server/src/**/*.ts'],
    plugins: { sonarjs: sonarjs },
    rules: {
      ...sonarjs.configs.recommended.rules,
      // Existing-codebase grandfather list. Track upgrades in TODO.md 阶段 8.
      'sonarjs/void-use': 'warn',
      'sonarjs/no-small-switch': 'warn',
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/no-all-duplicated-branches': 'warn',
      'sonarjs/slow-regex': 'warn',
      // Already covered by `no-warning-comments`, mute duplicate.
      'sonarjs/todo-tag': 'off',
    },
  },

  // Vue files need typescript-eslint parser for <script lang="ts">
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },

  // uni-app globals and timer APIs available in all frontend code
  {
    files: ['app/src/**/*.{ts,vue}'],
    languageOptions: {
      globals: {
        uni: 'readonly',
        UniApp: 'readonly',
        TouchEvent: 'readonly',
        KeyboardEvent: 'readonly',
        Touch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
      },
    },
  },

  // Node/server and test code should not inherit uni-app runtime restrictions.
  {
    files: ['server/**/*.{ts,js}', 'test/**/*.{ts,tsx,js}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // Mini Program safety: forbid Web-only APIs in frontend code
  {
    files: ['app/src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-globals': ['error', ...FORBIDDEN_GLOBALS],
      'no-restricted-properties': ['error',
        { object: 'document', property: 'querySelector', message: 'Use uni-app APIs instead of DOM queries.' },
        { object: 'document', property: 'querySelectorAll', message: 'Use uni-app APIs instead of DOM queries.' },
        { object: 'document', property: 'getElementById', message: 'Use uni-app APIs instead of DOM queries.' },
        { object: 'document', property: 'getElementsByClassName', message: 'Use uni-app APIs instead of DOM queries.' },
        { object: 'window', property: 'innerWidth', message: 'Use uni.getWindowInfo() instead.' },
        { object: 'window', property: 'innerHeight', message: 'Use uni.getWindowInfo() instead.' },
        { object: 'window', property: 'addEventListener', message: 'Use uni.onWindowResize() or similar uni-app API.' },
        { object: 'window', property: 'removeEventListener', message: 'Use uni.offWindowResize() or similar uni-app API.' },
      ],
    },
  },

  // Discipline: prevent debug residue and type escape in production code
  {
    files: ['app/src/**/*.{ts,vue}', 'server/src/**/*.{ts,js}'],
    rules: {
      'no-console': ['error', { allow: ['error', 'warn'] }],
      'no-debugger': 'error',
      'no-warning-comments': ['warn', { terms: ['TODO', 'FIXME', 'XXX'], location: 'anywhere' }],
    },
  },

  // Allow console in test code
  {
    files: ['test/**/*.{ts,tsx,js}', '**/*.test.{ts,tsx,js}'],
    rules: {
      'no-console': 'off',
      'no-warning-comments': 'off',
    },
  },

  // Relax rules that conflict with uni-app / project conventions
  {
    files: ['app/src/**/*.{ts,vue}'],
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
)
