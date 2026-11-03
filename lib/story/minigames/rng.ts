/** A random source returning [0, 1). Inject a seeded one in tests; the boards pass Math.random. */
export type Rng = () => number

/** Small seeded generator (mulberry32). */
export function seeded(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = (rng: Rng, n: number) => Math.min(n - 1, Math.floor(rng() * n))
