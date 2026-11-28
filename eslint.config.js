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
 * Inside the sim, a feature never imports another feature's `state.ts` (AGENTS.md rule 10): what
 * one feature reads of or does to another has a named function in the other's folder.
 *
 * `__testing__` exports may only be imported by *.test.ts files.
 *
 * Pencil strokes (rule 12): in the client, only `render/strokes/` may make a Phaser object that
 * draws lines or shapes. Everything else asks `createStrokeLayer` for a line.
 *
 * Every function's name starts with a verb from the VERBS list below (AGENTS.md, "Naming"), in both
 * packages, tests included, and in the verification template.
 *
 * Every `if`, `else` and loop has braces, so each statement is on a line of its own.
 *
 * Violations fail `pnpm lint`. Keep the lists below in step with AGENTS.md.
 */
const group = (patterns, message) => ({ group: patterns, message });

const PHASER = group(
  ['phaser', 'phaser/*'],
  'Phaser is rendering and input only and lives in packages/client.',
);
const CLIENT_PKG = group(
  ['@stickworld/client', '@stickworld/client/*', '**/packages/client/**', '../**/client/**'],
  'Nothing may depend on the client. It is a view.',
);
const NODE_BUILTINS = group(
  [
    'node:*',
    'fs',
    'fs/*',
    'path',
    'os',
    'crypto',
    'child_process',
    'worker_threads',
    'http',
    'https',
    'net',
    'events',
    'stream',
    'util',
    'url',
    'timers',
    'timers/*',
  ],
  'The sim is headless and pure: no Node APIs in packages/sim.',
);
// Any relative path that ends in another folder's `state` file, however it is spelled; a feature's
// own `./state` and `../state` are not matched.
const OTHER_FEATURE_STATE = {
  regex: '^(\\.\\.?/+)+([^/]+/+)*[^/.][^/]*/+(\\./+)*state(\\.[cm]?[jt]s)?$',
  message:
    "A feature's slices are its own. Read or change another feature's state through the functions that feature exports for it (features/player/body.ts, features/inventory/held.ts), so a diff shows who changes whom.",
};
const SIM_DEEP = group(
  ['@stickworld/sim/*', '**/packages/sim/**', '../**/sim/**'],
  'Import the sim through its package entry (@stickworld/sim) so its public API stays explicit.',
);

const restrictImports = (...groups) => ({
  'no-restricted-imports': ['error', { patterns: groups }],
});

const BROWSER_AND_NODE_GLOBALS = [
  'window',
  'document',
  'navigator',
  'self',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'clearTimeout',
  'clearInterval',
  'queueMicrotask',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'Image',
  'Audio',
  'HTMLElement',
  'CanvasRenderingContext2D',
  'btoa',
  'atob',
  'crypto',
  'performance',
  'console',
  'process',
  'require',
  'Buffer',
  'globalThis',
].map((name) => ({
  name,
  message: `The sim is headless and pure: "${name}" is not allowed in packages/sim.`,
}));

const NEW_DATE = {
  selector: 'NewExpression[callee.name="Date"]',
  message: 'Non-deterministic. Use sim.tick instead.',
};
const TESTING_IMPORT = {
  selector: 'ImportSpecifier[imported.name="__testing__"]',
  message: '`__testing__` exports are for *.test.ts files only.',
};

/**
 * Every function's name starts with a verb (AGENTS.md, "Naming"): the first word of the name is one
 * of these, followed by a capital, a digit or nothing. `is`, `has`, `are`, `does`, `can` and
 * `should` are for functions that answer yes or no. A new verb is a one-word edit to this list, in
 * the PR that needs it, so the list stays a decision.
 */
const VERBS = [
  'is',
  'has',
  'are',
  'does',
  'can',
  'should',
  'get',
  'set',
  'build',
  'make',
  'create',
  'define',
  'find',
  'measure',
  'count',
  'take',
  'give',
  'put',
  'show',
  'draw',
  'paint',
  'clear',
  'start',
  'stop',
  'step',
  'play',
  'send',
  'queue',
  'load',
  'expose',
  'add',
  'remove',
  'replace',
  'select',
  'update',
  'init',
  'handle',
  'restore',
  'reset',
  'read',
  'write',
  'keep',
  'cut',
  'move',
  'walk',
  'fall',
  'slide',
  'glide',
  'board',
  'seat',
  'stand',
  'carry',
  'lift',
  'place',
  'steer',
  'teach',
  'craft',
  'turn',
  'follow',
  'fit',
  'copy',
  'hash',
  'assert',
  'expect',
  'refuse',
  'ask',
  'watch',
  'advance',
  'boot',
  'use',
  'destroy',
  'perform',
  'finish',
  'lay',
  'cover',
  'let',
  'come',
  'jump',
  'run',
  'convert',
  'record',
  'ease',
  'skew',
  'grow',
  'wrap',
  'blend',
  'mix',
  'smooth',
  'space',
  'clamp',
  'tip',
  'collapse',
  'tune',
  'begin',
  'wait',
  'check',
  'summarize',
  'strike',
  'swing',
];
const NOT_A_VERB = `/^(?!_*(?:${VERBS.join('|')})(?:[A-Z0-9_]|$))/`;
const NAME_A_FUNCTION_WITH_A_VERB =
  "A function's name starts with a verb from VERBS in eslint.config.js (getFlag, buildFlagStrokes, isFlagReached). Rename it, or add the verb to the list.";
// What lint can see is a function: declarations, consts and properties that hold one, methods, and
// members and parameters whose type is written as a function. A function passed around under a type
// alias is not seen.
const FUNCTIONS_ARE_VERBS = [
  `FunctionDeclaration[id.name=${NOT_A_VERB}]`,
  `VariableDeclarator[id.name=${NOT_A_VERB}] > :matches(ArrowFunctionExpression, FunctionExpression)`,
  `MethodDefinition[kind="method"][key.name=${NOT_A_VERB}]`,
  `PropertyDefinition[key.name=${NOT_A_VERB}] > :matches(ArrowFunctionExpression, FunctionExpression)`,
  `Property[kind="init"][key.name=${NOT_A_VERB}] > :matches(ArrowFunctionExpression, FunctionExpression)`,
  `TSMethodSignature[key.name=${NOT_A_VERB}]`,
  `TSPropertySignature[key.name=${NOT_A_VERB}]:has(> TSTypeAnnotation > TSFunctionType)`,
  `Identifier[name=${NOT_A_VERB}]:has(> TSTypeAnnotation > TSFunctionType)`,
].map((selector) => ({ selector, message: NAME_A_FUNCTION_WITH_A_VERB }));

/**
 * A name is read on one line of a diff, with no way to jump to where it is declared (AGENTS.md,
 * "Naming"). So: a parameter is named, never destructured, and its fields are read through it
 * (`checkpoint.position`); a name is a technical term, not part of a sentence: no article or
 * pronoun in it (`getPlayerBody`, never `getWhereHeIs`); a name is never a bare preposition or a
 * bare "least"/"most" (`position`, `start`, `end`, `min`, `max`).
 */
const NAME_THE_PARAMETER =
  'Name the parameter and read its fields through it (checkpoint.position), so every line says whose field it is. Do not destructure a parameter.';
const PARAMETERS_ARE_NAMED = [
  ':function > ObjectPattern.params',
  ':function > AssignmentPattern.params > ObjectPattern.left',
].map((selector) => ({ selector, message: NAME_THE_PARAMETER }));
const SENTENCE_WORDS = 'The|An?|He|Him|His|Its?|What|Where|While';
const NOT_A_SENTENCE =
  'A name is a technical term, not part of a sentence: no article or pronoun in it (getPlayerBody, maxFallSpeed, never getWhereHeIs or speedOfALongFall).';
const NAMES_ARE_TERMS = [
  `Identifier[name=/[a-z0-9](${SENTENCE_WORDS})(?=[A-Z]|$)/]`,
  `Identifier[name=/^(${SENTENCE_WORDS})(?=[A-Z][a-z])/]`,
  `Identifier[name=/^(${SENTENCE_WORDS.toLowerCase()})(?=[A-Z])/]`,
  `Identifier[name=/(^|_)(${SENTENCE_WORDS.toUpperCase()})_|_(${SENTENCE_WORDS.toUpperCase()})$/]`,
].map((selector) => ({ selector, message: NOT_A_SENTENCE }));
const NAMING = [...FUNCTIONS_ARE_VERBS, ...PARAMETERS_ARE_NAMED, ...NAMES_ARE_TERMS];
/**
 * A condition is read on one line too (AGENTS.md, "Conditions"): an `if` or a ternary tests one
 * thing. Parts joined with `&&` or `||` go into a boolean constant first, whose name says what
 * the parts mean together (`isRestartAtCheckpoint`). A loop's test is evaluated again on every
 * pass, so it cannot be a constant and is not held to this.
 */
const NAME_THE_CONDITION =
  'Name a condition joined with && or ||: put it in a boolean constant first (const isRestartAtCheckpoint = ...) and test the name.';
const JOINED = 'LogicalExpression[operator=/^(&&|\\|\\|)$/]';
const CONDITIONS_ARE_NAMED = [
  `IfStatement > ${JOINED}.test`,
  `IfStatement > UnaryExpression.test > ${JOINED}`,
  `ConditionalExpression > ${JOINED}.test`,
  `ConditionalExpression > UnaryExpression.test > ${JOINED}`,
].map((selector) => ({ selector, message: NAME_THE_CONDITION }));
const READABLE = [...NAMING, ...CONDITIONS_ARE_NAMED];
/** Names that mean nothing without their owner or the line before. */
const BARE_WORDS = [
  'at',
  'to',
  'from',
  'by',
  'of',
  'on',
  'in',
  'with',
  'without',
  'about',
  'over',
  'under',
  'along',
  'past',
  'ahead',
  'least',
  'most',
  'what',
  'where',
  'which',
];
const BARE_NAMES = [...BARE_WORDS, ...BARE_WORDS.map((word) => word.toUpperCase())];
/**
 * A boolean's name says it is one: `isSeated`, `hasLanded`, never `seated` or `landed`. Needs
 * types, so it runs with the project's tsconfig.
 */
const BOOLEANS_SAY_SO = {
  'id-denylist': ['error', ...BARE_NAMES],
  '@typescript-eslint/naming-convention': [
    'error',
    {
      selector: [
        'variable',
        'parameter',
        'classProperty',
        'typeProperty',
        'parameterProperty',
        'accessor',
      ],
      types: ['boolean'],
      format: null,
      custom: { regex: '^_*(is|has|are|was|were|can|should|does|did|will)[A-Z0-9]', match: true },
    },
  ],
};

const STROKES_ONLY =
  'Only packages/client/src/render/strokes/ draws lines and shapes. Ask createStrokeLayer for a stroke instead (AGENTS.md rule 12).';
const DRAWN_OUTSIDE_STROKES = [
  {
    selector:
      'CallExpression[callee.object.property.name=/^(add|make)$/][callee.property.name=/^(graphics|rope|line|curve|polygon|arc|circle|ellipse|triangle|star|rectangle|grid|isobox|isotriangle)$/]',
    message: STROKES_ONLY,
  },
  { selector: 'NewExpression[callee.property.name=/^(Graphics|Rope)$/]', message: STROKES_ONLY },
  { selector: 'NewExpression[callee.name=/^(Graphics|Rope)$/]', message: STROKES_ONLY },
];

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
        {
          object: 'performance',
          property: 'now',
          message: 'Non-deterministic. Use sim.tick instead.',
        },
      ],
      'no-restricted-syntax': ['error', NEW_DATE, ...READABLE],
    },
  },
  // Later blocks replace a rule's whole setting, so the features block repeats the sim's groups
  // here.
  {
    files: ['packages/sim/src/features/**/*.ts'],
    rules: restrictImports(PHASER, CLIENT_PKG, NODE_BUILTINS, OTHER_FEATURE_STATE),
  },
  {
    files: ['packages/client/**/*.ts'],
    rules: { ...restrictImports(SIM_DEEP), 'no-restricted-syntax': ['error', ...READABLE] },
  },
  {
    files: ['verifications/_template/**/*.mjs'],
    rules: { 'no-restricted-syntax': ['error', ...READABLE] },
  },
  // `__testing__` exports exist for tests only. Later blocks replace a rule's whole setting, so
  // each repeats what the blocks above set: NEW_DATE for the sim, and the verbs everywhere.
  {
    files: ['packages/sim/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', NEW_DATE, TESTING_IMPORT, ...READABLE] },
  },
  {
    files: ['packages/client/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': ['error', TESTING_IMPORT, ...DRAWN_OUTSIDE_STROKES, ...READABLE],
    },
  },
  {
    // Layout is Prettier's (`pnpm format`). Prettier keeps an `if` without braces as it is, so lint
    // asks for the braces. A ticket's verification folder is frozen when its PR merges, so only the
    // template is held to it.
    ignores: ['verifications/*/**', '!verifications/_template/**'],
    rules: {
      curly: ['error', 'all'],
      // The positive case is tested when there is an `else`, and a branch that ends the function
      // returns, so what follows is not nested (AGENTS.md, "Conditions").
      'no-negated-condition': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      // Prettier does not wrap comments, so lint holds them to the same width as the code.
      'max-len': [
        'error',
        {
          code: 100,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignoreUrls: true,
        },
      ],
    },
  },
  {
    files: ['packages/*/src/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: BOOLEANS_SAY_SO,
  },
  {
    files: ['packages/client/src/render/strokes/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', TESTING_IMPORT, ...READABLE] },
  },
]);
