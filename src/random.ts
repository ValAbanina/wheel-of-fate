/** Cryptographically secure random integer in [0, max) using rejection sampling (no modulo bias). */
export function secureRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) throw new RangeError('max must be 1..2^32');
  const limit = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

/** Secure random float in [0, 1). */
export function secureRandom(): number {
  return secureRandomInt(2 ** 32) / 2 ** 32;
}

/** Fisher–Yates shuffle with secure randomness (returns a new array). */
export function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(items: readonly T[]): T {
  return items[secureRandomInt(items.length)];
}

/**
 * A deck that deals every item once, in random order, before reshuffling.
 * The order is persisted so a page reload does not repeat fortunes.
 */
export class Deck<T extends { id: string }> {
  private order: string[] = [];
  private items: readonly T[];
  private storageKey: string;
  constructor(items: readonly T[], storageKey: string) {
    this.items = items;
    this.storageKey = storageKey;
    this.order = load<string[]>(storageKey, []).filter((id) => items.some((i) => i.id === id));
  }
  next(): T {
    if (this.order.length === 0) this.order = shuffle(this.items.map((i) => i.id));
    const id = this.order.shift()!;
    save(this.storageKey, this.order);
    return this.items.find((i) => i.id === id)!;
  }
  reset(): void {
    this.order = [];
    save(this.storageKey, this.order);
  }
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable (private mode) — the game still works */
  }
}
