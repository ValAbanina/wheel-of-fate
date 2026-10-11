#!/usr/bin/env node
/**
 * Evens out the loudness of every file in public/audio/ so the voice, effects and music
 * sit well together (ElevenLabs returns each clip at its own level), and trims long silence
 * from the start and end of voice lines.
 *
 *   npm run audio:normalize                          # all files
 *   npm run audio:normalize -- SFX_CAT ru/VO_INTRO_1 # only these
 *
 * Needs ffmpeg (Mac: `brew install ffmpeg`). Safe to run again: files already close to
 * their target (±1.5 LU) and without long edge silence are left untouched (no needless re-encoding).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
const only = process.argv.slice(2);

/** Target integrated loudness (LUFS). Voice is the reference; effects sit a little below it. */
const target = (id) => {
  if (id.startsWith('VO_')) return -17;
  if (id === 'MUS_MAIN') return -18;
  if (id === 'AMB_WIND') return -28;
  if (id === 'SFX_TICK') return -26;
  if (id === 'SFX_CARD') return -24;
  if (id === 'SFX_WIN_GRAND') return -18;
  return -20;
};

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  console.error('\n✖ ffmpeg is not installed. On a Mac: brew install ffmpeg\n');
  process.exit(1);
}

/** ffmpeg prints its analysis on stderr. */
const analyse = (file, filter) =>
  spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', filter, '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? '';

const files = readdirSync(root, { recursive: true })
  .map((f) => String(f).split('\\').join('/'))
  .filter((f) => f.endsWith('.mp3'))
  .filter((f) => !only.length || only.includes(f.replace(/\.mp3$/, '')));

let changed = 0;
for (const rel of files) {
  const file = join(root, rel);
  const id = rel.split('/').pop().replace(/\.mp3$/, '');
  const isVoice = id.startsWith('VO_');
  const log = analyse(file, 'ebur128,silencedetect=n=-45dB:d=0.3');
  const I = Number((log.match(/I:\s+(-?[\d.]+) LUFS/g) ?? []).pop()?.match(/-?[\d.]+/)?.[0]);
  if (!Number.isFinite(I)) {
    console.log(`  ?  ${rel} (could not measure)`);
    continue;
  }
  const dur = Number(log.match(/Duration: (\d+):(\d+):([\d.]+)/)?.slice(1).reduce((a, v, i) => a + Number(v) * [3600, 60, 1][i], 0));
  const starts = [...log.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const edgeSilence = isVoice && starts.length > 0 && (starts[0] <= 0.05 || ends.length < starts.length || ends[ends.length - 1] >= dur - 0.05);
  const gain = target(id) - I;

  if (Math.abs(gain) < 1.5 && !edgeSilence && !only.length) {
    console.log(`  ✓  ${rel.padEnd(28)} ${I.toFixed(1)} LUFS`);
    continue;
  }
  const filters = [];
  if (isVoice) {
    const trim = 'silenceremove=start_periods=1:start_duration=0.05:start_threshold=-45dB';
    filters.push(trim, 'areverse', trim, 'areverse', 'apad=pad_dur=0.15');
  }
  filters.push(`volume=${gain.toFixed(2)}dB`, 'alimiter=limit=0.84:level=false');
  const tmp = file.replace(/\.mp3$/, '.tmp.mp3');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-af', filters.join(','), '-ar', '44100', '-b:a', '128k', tmp]);
  renameSync(tmp, file);
  changed++;
  console.log(`  ✎  ${rel.padEnd(28)} ${I.toFixed(1)} → ${target(id)} LUFS${edgeSilence ? ' (trimmed silence)' : ''}`);
}
console.log(`\nDone: ${changed} file(s) adjusted.\n`);
