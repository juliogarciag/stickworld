import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Package boundaries (AGENTS.md, architecture rules 5 and 9).
 *
 * sim    -> imports nothing outside packages/sim: no Phaser, no client, no Node, no browser.
 *           No Math.random, Date, performance, timers or I/O: randomness goes through sim.rng.
 * client -> may import phaser and @stickworld/sim through its package entry only, never deep paths.
 *
 * `__testing__` exports may only be imported by *.test.ts files.
 *
 * Pencil strokes (rule 12): in the client, only `render/strokes/` may make a Phaser object that draws
 * lines or shapes. Everything else asks `createStrokeLayer` for a line.
 *
 * Violations fail `pnpm lint`. Keep the lists below in step with AGENTS.md.
 */
const group = (patterns, message) => ({ group: patterns, message });

const PHASER = group(['phaser', 'phaser/*'], 'Phaser is rendering and input only and lives in packages/client.');
const CLIENT_PKG = group(['@stickworld/client', '@stickworld/client/*', '**/packages/client/**', '../**/client/**'], 'Nothing may depend on the client. It is a view.');
const NODE_BUILTINS = group(
  ['node:*', 'fs', 'fs/*', 'path', 'os', 'crypto', 'child_process', 'worker_threads', 'http', 'https', 'net', 'events', 'stream', 'util', 'url', 'timers', 'timers/*'],
  'The sim is headless and pure: no Node APIs in packages/sim.',
);
const SIM_DEEP = group(['@stickworld/sim/*', '**/packages/sim/**', '../**/sim/**'], 'Import the sim through its package entry (@stickworld/sim) so its public API stays explicit.');

const restrictImports = (...groups) => ({
  'no-restricted-imports': ['error', { patterns: groups }],
});

const BROWSER_AND_NODE_GLOBALS = [
  'window', 'document', 'navigator', 'self', 'localStorage', 'sessionStorage', 'indexedDB',
  'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'setInterval', 'setImmediate',
  'clearTimeout', 'clearInterval', 'queueMicrotask', 'fetch', 'XMLHttpRequest', 'WebSocket',
  'Worker', 'Image', 'Audio', 'HTMLElement', 'CanvasRenderingContext2D', 'btoa', 'atob',
  'crypto', 'performance', 'console', 'process', 'require', 'Buffer', 'globalThis',
].map((name) => ({ name, message: `The sim is headless and pure: "${name}" is not allowed in packages/sim.` }));

const NEW_DATE = { selector: 'NewExpression[callee.name="Date"]', message: 'Non-deterministic. Use sim.tick instead.' };
const TESTING_IMPORT = {
  selector: 'ImportSpecifier[imported.name="__testing__"]',
  message: '`__testing__` exports are for *.test.ts files only.',
};

const DRAWN_OUTSIDE_STROKES = {
  selector: 'CallExpression[callee.object.property.name="add"][callee.property.name=/^(graphics|rope|line|curve|polygon|arc|circle|ellipse|triangle|star|rectangle)$/]',
  message: 'Only packages/client/src/render/strokes/ draws lines and shapes. Ask createStrokeLayer for a stroke instead (AGENTS.md rule 12).',
};

export default defineConfig([
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '.worktrees/**',
      'verifications/**/proof/**',
      'verifications/**/node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['*.js', '*.ts', 'packages/client/vite.config.ts', 'verifications/**/*.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/client/src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['packages/sim/**/*.ts'],
    rules: {
      ...restrictImports(PHASER, CLIENT_PKG, NODE_BUILTINS),
      'no-restricted-globals': ['error', ...BROWSER_AND_NODE_GLOBALS],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Non-deterministic. Use sim.rng instead.' },
        { object: 'Date', property: 'now', message: 'Non-deterministic. Use sim.tick instead.' },
        { object: 'performance', property: 'now', message: 'Non-deterministic. Use sim.tick instead.' },
      ],
      'no-restricted-syntax': ['error', NEW_DATE],
    },
  },
  {
    files: ['packages/client/**/*.ts'],
    rules: restrictImports(SIM_DEEP),
  },
  // `__testing__` exports exist for tests only. Later blocks replace a rule's
  // whole setting, so the sim block repeats NEW_DATE here.
  {
    files: ['packages/sim/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', NEW_DATE, TESTING_IMPORT] },
  },
  {
    files: ['packages/client/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', TESTING_IMPORT, DRAWN_OUTSIDE_STROKES] },
  },
  {
    files: ['packages/client/src/render/strokes/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', TESTING_IMPORT] },
  },
]);
