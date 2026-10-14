/**
 * Seeded, serialisable RNG (sfc32). The state lives in GameState so a saved game replays
 * identically. Never use Math.random() inside the simulation.
 */
export type RngState = [number, number, number, number];

export function seedRng(seed: number): RngState {
  const s: RngState = [0x9e3779b9, 0x243f6a88, 0xb7e15162, seed >>> 0];
  const r = new Rng(s);
  for (let i = 0; i < 15; i++) r.next(); // warm up
  return r.state;
}

export class Rng {
  constructor(public state: RngState) {}

  /** Uniform float in [0, 1). */
  next(): number {
    let [a, b, c, d] = this.state;
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) >>> 0;
    this.state = [a, b, c, d];
    return t / 4294967296;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Standard normal (Box–Muller). */
  normal(): number {
    const u = Math.max(this.next(), 1e-12);
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Pick an index with probability proportional to weights. */
  weighted(weights: number[]): number {
    const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
    if (total <= 0) return this.int(weights.length);
    let x = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      x -= Math.max(0, weights[i]!);
      if (x < 0) return i;
    }
    return weights.length - 1;
  }
}
