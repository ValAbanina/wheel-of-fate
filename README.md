# 🔮 Madame Nocturne's Wheel of Fate

A Halloween spin-the-wheel game. Spin the wheel: land on a prize and win it from the host, or let Madame Nocturne, a hooded fortune teller, speak your fortune out loud.

- 12-slice wheel: 3 treats, 1 grand prize, 7 fortunes, 1 black-cat re-spin
- Truly random (browser crypto), 20 fortunes that never repeat until all have played
- Voice, music and sound effects generated with ElevenLabs
- Mobile-first: phones and tablets in both orientations, plus desktop / event screens
- Accessible: captions for every spoken line, keyboard play (Space/Enter), screen-reader announcements, reduced-motion mode
- Host panel (the ⚙ button, holding the title 3 s, or **H** to open and close): language, prize names, grand prizes left (default 3, up to 10), sound toggles. It's shown in the chosen language
- Treats never run out; when the grand prizes are all claimed, that slice gives a treat instead
- Four languages, chosen by the host: English, Русский, 简体中文, 繁體中文 (both Chinese scripts share the Mandarin voice)

Design: [Figma](https://www.figma.com/design/2TCNOLyMwcvFlu7wIWEtaU) · Full spec: [SPEC.md](./SPEC.md)

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev        # open the link it prints (also works on your phone on the same Wi-Fi: npm run dev -- --host)
```

The game works right away: captions show every line and simple built-in sounds play until you generate the real audio.

## Generate Madame Nocturne's voice, music and sounds (once)

1. Copy `.env.example` to `.env` and paste your ElevenLabs API key after `ELEVENLABS_API_KEY=`.
   Check `ELEVENLABS_VOICE_ID` is your voice's ID. `.env` is git-ignored — it never goes to GitHub.
2. Run:

   ```bash
   npm run audio
   ```

   It creates 111 files in `public/audio/`: 33 voice lines in English, 33 in Russian (`ru/`), 33 in Mandarin (`zh/`), 11 sound effects and 1 music loop. It skips any that already exist.

Useful options:

| Command | Does |
| --- | --- |
| `npm run audio -- --only VO_INTRO_1,SFX_TICK` | Redo specific files you didn't like (all languages) |
| `npm run audio -- --only ru/VO_INTRO_1` | Redo one line in one language (`ru/` or `zh/`) |
| `npm run audio -- --lang ru` | Only one language (`en`, `ru` or `zh`) |
| `npm run audio -- --voice-only` | Only Madame Nocturne's lines |
| `npm run audio -- --force` | Redo everything |
| `npm run audio -- --list-models` | Show the voice models on your account (set `ELEVENLABS_MODEL_ID`) |

After generating (or regenerating) audio, even out the volume of all files — needs ffmpeg (`brew install ffmpeg`):

```bash
npm run audio:normalize
```

To change what she says, edit `src/content/script.json` (English) or `src/i18n/ru.json`, `zh-Hans.json`, `zh-Hant.json`, then regenerate those IDs.

Want a different voice for Russian or Mandarin? Add `ELEVENLABS_VOICE_ID_RU=` or `ELEVENLABS_VOICE_ID_ZH=` to `.env` and regenerate with `--lang ru --force` (or `zh`).

After editing the Chinese text, rebuild the small Chinese font files: `pip install fonttools brotli`, `npm install --no-save @fontsource/noto-serif-sc@5.3.1 @fontsource/noto-serif-tc@5.3.1`, then `npm run fonts:cjk`.

## Test & build

```bash
npm test           # 100,000 simulated spins: fair odds, always lands on the chosen slice, no repeated fortunes
npm run build      # production build in dist/
```

## Publish on GitHub Pages

1. Create a repository on GitHub and push this folder to the `main` branch (include `public/audio/`).
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` runs the tests, builds and publishes to `https://<your-user>.github.io/<repo>/`.

## Project structure

```
src/
  main.ts            game flow, result cards, host panel, keyboard
  wheel.ts           SVG wheel + spin animation (GSAP)
  spin-math.ts       landing maths (shared with tests)
  audio.ts           Howler playback, music ducking, fallbacks
  random.ts          secure random + fortune deck
  settings.ts        host settings (saved in the browser)
  content/script.json  every English line, fortune, audio prompt and the wheel order
  i18n/              en, ru, zh-Hans, zh-Hant: on-screen text, wheel labels, translated lines
  styles/            design tokens from Figma + layout
  assets/icons/      original artwork (SVG)
scripts/
  generate-audio.mjs ElevenLabs generator
  simulate-odds.ts   fairness test
```

## Credits

- Code: MIT licence (see `LICENSE`).
- Artwork: original, inspired by Victorian gothic engravings.
- Voice, music and sound effects generated with [ElevenLabs](https://elevenlabs.io).
- Fonts: Cinzel Decorative, Cinzel, Cormorant Garamond, Cormorant SC, Noto Serif SC/TC (SIL Open Font License), self-hosted.
