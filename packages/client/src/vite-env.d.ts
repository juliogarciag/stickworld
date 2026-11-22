/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev builds: the level to start on, by number. Unset or unknown: level 1. */
  readonly VITE_LEVEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
