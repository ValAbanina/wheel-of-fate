#!/usr/bin/env node
/**
 * Generates every voice line, sound effect and the music loop with ElevenLabs
 * and saves them to public/audio/<ID>.mp3, plus public/audio/manifest.json.
 *
 * Usage (from the project folder):
 *   npm run audio                      # generate anything that is missing
 *   npm run audio -- --force           # regenerate everything
 *   npm run audio -- --only VO_INTRO_1 # regenerate one or more IDs (comma-separated)
 *   npm run audio -- --voice-only      # only Madame Nocturne's lines
 *   npm run audio -- --lang ru,zh      # only these languages (en, ru, zh); default: all
 *
 * Voice files: English in public/audio/, Russian in public/audio/ru/, Mandarin in public/audio/zh/
 * (Simplified and Traditional Chinese share the Mandarin recordings).
 *   npm run audio -- --list-models     # show the voice models your account can use
 *
 * Needs a .env file next to package.json (see .env.example). The key never leaves your computer.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'audio');
const API = process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io/v1';

// ---- tiny .env loader (no dependencies) ----
const envPath = join(root, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID;
// Optional per-language voices; otherwise Madame Nocturne's main voice speaks every language.
const VOICES = { en: VOICE, ru: process.env.ELEVENLABS_VOICE_ID_RU || VOICE, zh: process.env.ELEVENLABS_VOICE_ID_ZH || VOICE };
const MODEL = process.env.ELEVENLABS_MODEL_ID || 'eleven_v3';
const MUSIC_MODEL = process.env.ELEVENLABS_MUSIC_MODEL_ID || 'music_v1';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const onlyArg = args.find((a, i) => args[i - 1] === '--only');
const only = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim())) : null;
const langArg = args.find((a, i) => args[i - 1] === '--lang');
const LANGS = (langArg ? langArg.split(',').map((s) => s.trim()) : ['en', 'ru', 'zh']).filter((l) => ['en', 'ru', 'zh'].includes(l));
const force = flag('--force');

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}
if (!KEY) fail('ELEVENLABS_API_KEY is missing. Copy .env.example to .env and paste your key.');

async function post(path, body, query = '') {
  const res = await fetch(`${API}${path}${query}`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} — ${text.slice(0, 400)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

if (flag('--list-models')) {
  const res = await fetch(`${API}/models`, { headers: { 'xi-api-key': KEY } });
  if (!res.ok) fail(`Could not list models: ${res.status} ${await res.text()}`);
  const models = await res.json();
  for (const m of models) if (m.can_do_text_to_speech) console.log(`${m.model_id.padEnd(28)} ${m.name}`);
  process.exit(0);
}

const script = JSON.parse(readFileSync(join(root, 'src', 'content', 'script.json'), 'utf8'));
mkdirSync(outDir, { recursive: true });

/** @type {{id:string, kind:'voice'|'sfx'|'music', run:() => Promise<Buffer>}[]} */
const jobs = [];
// Translations: Russian from src/i18n/ru.json, Mandarin from src/i18n/zh-Hans.json.
const i18n = {
  ru: JSON.parse(readFileSync(join(root, 'src', 'i18n', 'ru.json'), 'utf8')),
  zh: JSON.parse(readFileSync(join(root, 'src', 'i18n', 'zh-Hans.json'), 'utf8')),
};
const voiceLines = [...script.voice, ...script.fortunes];
for (const lang of LANGS) {
  for (const line of voiceLines) {
    const text = lang === 'en' ? line.text : (i18n[lang].voice?.[line.id] ?? i18n[lang].fortunes?.[line.id]);
    if (!text) continue;
    const file = lang === 'en' ? line.id : `${lang}/${line.id}`;
    jobs.push({
      id: line.id,
      file,
      kind: 'voice',
      run: () => {
        if (!VOICES[lang]) fail('ELEVENLABS_VOICE_ID is missing in .env (copy it from your voice in ElevenLabs).');
        return post(
          `/text-to-speech/${VOICES[lang]}`,
          { text, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } },
          '?output_format=mp3_44100_128',
        );
      },
    });
  }
}
if (!flag('--voice-only') && (!langArg || LANGS.includes('en'))) {
  for (const cue of script.audio) {
    if (cue.kind === 'music') {
      jobs.push({
        id: cue.id,
        file: cue.id,
        kind: 'music',
        run: () =>
          post('/music', { prompt: cue.prompt, music_length_ms: Math.round(cue.seconds * 1000), model_id: MUSIC_MODEL, force_instrumental: true }, '?output_format=mp3_44100_128'),
      });
    } else {
      jobs.push({
        id: cue.id,
        file: cue.id,
        kind: 'sfx',
        run: () =>
          post(
            '/sound-generation',
            { text: cue.prompt, duration_seconds: Math.min(30, Math.max(0.5, cue.seconds)), prompt_influence: 0.6, loop: !!cue.loop, model_id: 'eleven_text_to_sound_v2' },
            '?output_format=mp3_44100_128',
          ),
      });
    }
  }
}

// Check the voice exists before spending any credits.
if (VOICE && !flag('--skip-voice-check')) {
  const res = await fetch(`${API}/voices/${VOICE}`, { headers: { 'xi-api-key': KEY } }).catch(() => null);
  const body = res && !res.ok ? await res.text().catch(() => '') : '';
  if (res && res.status === 401 && /missing_permissions|permission/i.test(body)) {
    console.log('ℹ Your key cannot read voice details (that permission is off) — skipping the check and continuing.');
  } else if (res && res.status === 401) {
    fail(`Your API key was rejected by ElevenLabs.\n  ElevenLabs said: ${body.slice(0, 300)}\n  Check ELEVENLABS_API_KEY in .env (no spaces or quotes), or create a new key in ElevenLabs → Developers → API Keys.`);
  } else if (res && !res.ok) {
    fail(`Voice "${VOICE}" was not found (${res.status}). ElevenLabs said: ${body.slice(0, 200)}\n  In ElevenLabs open the voice → copy its Voice ID into .env.`);
  } else if (res && res.ok) {
    console.log(`Voice: ${(await res.json()).name ?? VOICE}`);
  }
}

const todo = jobs.filter((j) => (only ? only.has(j.id) || only.has(j.file) : force || !existsSync(join(outDir, `${j.file}.mp3`))));
console.log(`\n🔮 Madame Nocturne's audio — ${todo.length} file(s) to generate (${jobs.length - todo.length} already done)\n`);

let ok = 0;
const failed = [];
const blocked = new Map(); // kind -> missing permission
for (const job of todo) {
  if (blocked.has(job.kind)) {
    failed.push(job.file);
    continue;
  }
  process.stdout.write(`  ${job.kind.padEnd(5)} ${job.file.padEnd(25)} … `);
  try {
    const buf = await job.run();
    mkdirSync(dirname(join(outDir, `${job.file}.mp3`)), { recursive: true });
    writeFileSync(join(outDir, `${job.file}.mp3`), buf);
    ok++;
    console.log(`✓ ${(buf.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    failed.push(job.file);
    console.log(`✖ ${e.message}`);
    const perm = e.message.match(/missing the permission (\w+)/);
    if (perm) blocked.set(job.kind, perm[1]);
    else if (/^401/.test(e.message)) fail(`ElevenLabs refused your API key:\n  ${e.message}`);
    if (/invalid_uid|model/i.test(e.message) && job.kind === 'voice') fail(`The model "${MODEL}" was not accepted. Check ELEVENLABS_MODEL_ID in .env (run: npm run audio -- --list-models).`);
  }
  await new Promise((r) => setTimeout(r, 350)); // be gentle with rate limits
}

// Manifest = every mp3 present (the game only requests files listed here).
const present = readdirSync(outDir, { recursive: true })
  .map((f) => String(f).split('\\').join('/'))
  .filter((f) => f.endsWith('.mp3'))
  .map((f) => f.replace(/\.mp3$/, ''))
  .sort();
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(present, null, 2) + '\n');

console.log(`\nDone: ${ok} generated, ${failed.length} not generated, ${present.length} files ready.`);
for (const [kind, perm] of blocked) {
  const label = { voice: 'Text to Speech', sfx: 'Sound Effects', music: 'Music' }[kind] ?? kind;
  console.log(`⚠ Your API key is missing the "${perm}" permission, so ${kind} files were skipped.\n  Fix: ElevenLabs → Developers → API Keys → edit your key → turn on ${label} → run \`npm run audio\` again.`);
}
if (failed.length) console.log(`Retry the failed ones with:  npm run audio -- --only ${failed.join(',')}`);
console.log('Listen in the game with:  npm run dev\n');
