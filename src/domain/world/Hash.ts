/**
 * Stable 32-bit hash over named keys (doc 04 §3; reference values in doc 11).
 * Numbers must be safe integers: `JSON.stringify` would otherwise collapse
 * NaN/Infinity to `null` and silently collide.
 */
export function hash32(...parts: readonly (string | number)[]): number {
  for (const part of parts) {
    if (typeof part === 'number' && !Number.isSafeInteger(part)) {
      throw new RangeError(`hash32 needs safe integers, got ${part}`);
    }
  }
  const text = JSON.stringify(parts);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Deterministic value in [0, 1) for the given key. */
export function unitRandom(...parts: readonly (string | number)[]): number {
  return hash32(...parts) / 4294967296;
}
