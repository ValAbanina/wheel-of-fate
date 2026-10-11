// Run with: npm test  — checks fairness, landing accuracy and the fortune deck.
import data from '../src/content/script.json' with { type: 'json' };
import { secureRandomInt, shuffle } from '../src/random.ts';
import { indexForRotation, SLICE_DEG, targetRotation } from '../src/spin-math.ts';

const N = 100_000;
const wheel = data.wheel as string[];
const counts: Record<string, number> = {};
let rotation = 0;
let misses = 0;
for (let i = 0; i < N; i++) {
  const index = secureRandomInt(wheel.length);
  const jitter = (Math.random() * 2 - 1) * (SLICE_DEG / 2 - 4);
  rotation = targetRotation(rotation, index, 5 + secureRandomInt(3), jitter) % 360;
  if (indexForRotation(rotation) !== index) misses++;
  counts[wheel[index]] = (counts[wheel[index]] ?? 0) + 1;
}
let ok = misses === 0;
console.log(`Spins: ${N.toLocaleString()}   wheel stopped on the wrong slice: ${misses}`);
for (const [type, n] of Object.entries(counts)) {
  const expected = wheel.filter((t) => t === type).length / wheel.length;
  const actual = n / N;
  const pass = Math.abs(actual - expected) < 0.01;
  ok &&= pass;
  console.log(`${type.padEnd(8)} expected ${(expected * 100).toFixed(1)}%  got ${(actual * 100).toFixed(2)}%  ${pass ? '✓' : '✖'}`);
}
const deck = shuffle(data.fortunes.map((f) => f.id));
const unique = new Set(deck).size === data.fortunes.length;
ok &&= unique;
console.log(`Fortune deck deals all ${data.fortunes.length} without repeats: ${unique ? '✓' : '✖'}`);
process.exit(ok ? 0 : 1);
