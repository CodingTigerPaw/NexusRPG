export function createAnimationSeed() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function withSeededMathRandom<T>(
  seed: string | undefined,
  callback: () => Promise<T>
) {
  if (!seed) {
    return callback();
  }

  const originalRandom = Math.random;
  Math.random = createSeededRandom(seed);

  try {
    return await callback();
  } finally {
    Math.random = originalRandom;
  }
}

export function createSeededRandom(seed: string) {
  let state = hashSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
