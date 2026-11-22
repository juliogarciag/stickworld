/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev builds: the level to start on, by number. Unset or unknown: level 1. */
  readonly VITE_LEVEL?: string;
  /** Look test only: which stroke technique to draw with (`rope`, `graphics` or `canvas`). */
  readonly VITE_STROKES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
