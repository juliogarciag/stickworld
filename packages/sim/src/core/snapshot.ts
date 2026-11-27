/**
 * Everything the sim is, as plain JSON. A snapshot loaded back with
 * `restoreSim` continues exactly as the sim it was taken from would have.
 */
export interface SimSnapshot {
  readonly seed: number;
  readonly tick: number;
  /** The id of the level being played. */
  readonly level: number;
  /** The rng's internal state, so a restored sim draws the same numbers next. */
  readonly rngState: number;
  /** Every feature's slice of state, by slice key. */
  readonly slices: Readonly<Record<string, unknown>>;
}

/**
 * A deep copy of plain JSON data. Anything that is not JSON (functions, Maps, undefined) is lost,
 * which the snapshot tests catch.
 */
export function copyJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * A short fingerprint of a snapshot: equal snapshots give equal hashes,
 * whatever order their object keys were written in. Used by the determinism
 * tests and by `window.__game.hash()`.
 */
export function hashSnapshot(snapshot: SimSnapshot): string {
  const text = buildCanonicalJson(snapshot);
  // FNV-1a, 32 bits.
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ---- Helpers ----

/** JSON with every object's keys sorted, so two equal values always print the same. */
function buildCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(buildCanonicalJson).join(',')}]`;
  }
  const isObject = typeof value === 'object' && value !== null;
  if (isObject) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${buildCanonicalJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
