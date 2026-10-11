# Madame Nocturne's Wheel of Fate — Product & Build Spec

**Version:** 1.0 · **Date:** 2026-10-11 · **Status:** Script ✅ · Design ✅ · Development ⏳

| Link | |
| --- | --- |
| Figma design | https://www.figma.com/design/2TCNOLyMwcvFlu7wIWEtaU |
| Script doc (living) | https://claude.ai/code/artifact/0dca31f8-269a-4d3e-8041-9a58ed79eb7d |

---

## 1. Summary

A Halloween spin-the-wheel web game for a college event (students, staff and instructors). A guest taps the wheel, it spins with sound, and **Madame Nocturne**, a hooded fortune teller, announces the result in a recorded voice:

- **Prize slice** → the guest wins a real prize from the host.
- **Fortune slice** → Madame Nocturne speaks a fortune.
- **Black cat slice** → free re-spin.

Static website, mobile-first, works on phones, tablets and desktop/event screens. Public GitHub repo, hosted on GitHub Pages.

## 2. Decisions

| Topic | Decision |
| --- | --- |
| Audience | College students, staff, instructors. Eerie, witty, campus-friendly. |
| Name | Madame Nocturne's Wheel of Fate |
| Wheel | 12 slices: 3 Treat, 1 Grand Prize, 7 Fortune, 1 Spin Again |
| Randomness | Truly random every spin (`crypto.getRandomValues`), result chosen first, wheel animates to land on it. Repeat winners allowed. |
| Prize stock | Treats are unlimited (host brings ~1 treat per 4 guests). Grand prizes are counted: host sets 0–10 in the host panel, default **3**. When all are claimed, the Grand Prize slice gives a treat instead, so nobody leaves empty-handed. |
| Voice | ElevenLabs, neutral English accent, pre-generated MP3s |
| Language | English, Russian, Simplified Chinese, Traditional Chinese — chosen by the host in the host panel. The host panel follows the chosen language too. Default prize names are translated; names the host types are shown as typed. |
| ElevenLabs plan | Starter (commercial license, 30,000 credits/month, SFX + Music included) |
| Devices | Mobile-first: phone portrait/landscape, tablet portrait/landscape, desktop |
| Repo | Public GitHub. No Adobe Stock files in the repo; all art is original. |

## 3. Screens & flow

```
Enter (curtain) ──tap──▶ Spin ──tap/swipe/Space──▶ Spinning (4–6 s) ──▶ Result card
                          ▲                                               │
                          └──────────────── "Spin again" ◀────────────────┘
Host panel: ⚙ button in the header, hold logo 3 s, or press H (H also closes it)
```

| # | Screen | Behaviour | Audio |
| --- | --- | --- | --- |
| 1 | Enter | Curtain, title, "ENTER IF YOU DARE". Required tap unlocks browser audio. | `AMB_WIND`, `SFX_CURTAIN`, start `MUS_MAIN` |
| 2 | Spin | Header, Madame Nocturne + caption, wheel, "SPIN THE WHEEL". | `VO_INTRO_*` once per session; `VO_IDLE_*` after 20 s idle |
| 3 | Spinning | Button disabled ("THE WHEEL TURNS…"), ticks slow down. | `VO_SPIN_*`, `SFX_SPIN_START`, `SFX_TICK` per slice passed, `SFX_DRONE_RISE`, `SFX_STOP` |
| 4 | Result | Card unrolls (bottom sheet on phones, beside wheel on landscape/desktop). Treat, Grand Prize and Fortune cards only have **Close** (one spin per guest); only the Black Cat card has **Spin now**. Closing stops the voice. | Result VO + SFX (see §5) |
| 5 | Host panel | Side panel that slides in from the right (full width on phones). Prize names, grand prizes left (0–10, default 3, with reset), voice/music/SFX toggles, reset. Open with the ⚙ button (next to the sound button), a 3 s hold on the title, or H. Close with ×, Done, Esc, H or tapping outside. Opens any time, even while the wheel spins: the wheel keeps turning behind the panel and the result card waits until the panel is closed (so new settings, like the language, apply to that result). Saved in `localStorage`. | — |

## 4. The wheel

Clockwise from the top (index 0 under the pointer at rest). Prizes never touch each other.

| Index | Slice | Colour | Icon |
| --- | --- | --- | --- |
| 0 | **Grand Prize** | Crimson gradient `#9E2238 → #8E1B2E → #4E0B18`, gold rays, 3 px gold border | Winged hourglass (gold) |
| 1, 2, 4, 5, 8, 10, 11 | Fortune | Alternating `#241629` / `#3A2343` | Crystal ball (bone) |
| 3, 6, 9 | Treat | Gold `#D9A441` | Skull candle (ink) |
| 7 | Spin Again | Ember `#E0662A` | Black cat (ink) |

**Odds per spin (default, equal slices):** Treat 25% · Grand 8.3% · Fortune 58.3% · Spin Again 8.3%.

**Spin algorithm**

1. `index = secureRandomInt(0, 11)` (rejection sampling on `crypto.getRandomValues`).
2. If the Grand Prize slice is hit with 0 grand prizes left, the guest gets a treat (with `VO_GRAND_GONE`). Treats are never counted.
3. Target rotation = `current + 360 × (5..7 full turns) + offsetTo(index) + jitter(±12°)` so it never stops dead-centre or on a peg.
4. Animate with ease-out (GSAP `power4.out`), 4–6 s. Play `SFX_TICK` each time a peg passes the pointer.
5. On complete → decrement stock if prize, show result, play audio.

Fortunes are drawn from a shuffled deck: no repeats until all 20 have played.

## 5. Script

Words in `[brackets]` are ElevenLabs performance tags, not spoken. Every line is also shown as an on-screen caption (without the tags). If a moment has several takes, pick one at random.

### Voice lines

| ID | When | Line |
| --- | --- | --- |
| VO_INTRO_1 | First visit | [slowly] Ahh… a new soul wanders in from the dark. Come closer. The Wheel of Fate has been waiting for you. |
| VO_INTRO_2 | First visit | [whispers] Shhh… the candles have noticed you. Spin the wheel, and let the spirits decide what you deserve. |
| VO_IDLE_1 | 20 s, no spin | [amused] Don't be shy. The wheel doesn't bite… it only grades on a curve. |
| VO_IDLE_2 | 20 s, no spin | [whispers] The spirits grow restless… spin, before they assign homework. |
| VO_SPIN_1 | Spin starts | Round and round… where fate stops, nobody knows. |
| VO_SPIN_2 | Spin starts | [laughs softly] Yes… let it whirl. |
| VO_PRIZE_SMALL_1 | Treat | [delighted] A treat! The spirits are generous tonight. Go, claim your sweet reward. |
| VO_PRIZE_SMALL_2 | Treat | Hmm… the candles burn bright for you. A treat is yours. |
| VO_PRIZE_GRAND_1 | Grand Prize | [gasps] The golden hourglass! In a hundred years, I have seen this only thrice. The Grand Prize is yours! |
| VO_FORTUNE_INTRO_1 | Before fortune | [slowly] Let me look into the glass… |
| VO_FORTUNE_INTRO_2 | Before fortune | [whispers] The mist is clearing… I see… |
| VO_SPIN_AGAIN | Spin Again | The black cat crossed your path… and changed its mind. Spin again! |
| VO_GRAND_GONE | Grand Prize slice, none left | [softly] The golden hourglass has already been claimed tonight… but the spirits will not send you away empty-handed. Take a treat! |

### Fortunes (`VO_FORTUNE_01` … `VO_FORTUNE_20`)

1. A door you thought was locked will creak open before the next full moon.
2. Someone is thinking of you right now… and smiling. Or plotting. The mist is unclear.
3. An email you have been dreading will turn out to be good news.
4. Beware of the third cookie. The first two are safe.
5. A black cat will cross your path, and it will bring luck, not trouble.
6. The stars say yes. The moon says maybe. The bats refuse to comment.
7. An old friend will send a message, and it will make your whole week.
8. Your courage is bigger than your shadow, even at sunset.
9. A small risk you take this month will grow into something wonderful.
10. The spirits see an adventure in your future. Pack snacks.
11. Someone at this party will remember your kindness for years.
12. You will laugh so hard this week that a ghost somewhere will hear it.
13. A deadline will move in your favour. Do not ask how. Just say thank you.
14. A wish you made long ago is still on its way. Do not cancel it.
15. You will be brave at exactly the right moment.
16. The candle flickers your name. Something sweet is coming.
17. The coffee machine will work on the first try when you need it most.
18. The answer you are looking for is in the reading you skipped. The spirits are sorry.
19. A secret will be told to you. Keep it. The spirits are watching.
20. Your future is bright… almost too bright for a creature of the night like me.

### Result sequence

| Result | Sequence |
| --- | --- |
| Treat | `SFX_STOP` → `SFX_CARD` + card → `SFX_WIN_SMALL` → `VO_PRIZE_SMALL_*` |
| Grand Prize | `SFX_STOP` → `SFX_WIN_GRAND` + gold sparkles → card → `VO_PRIZE_GRAND_1` |
| Grand Prize, none left | `SFX_STOP` → `SFX_WIN_SMALL` → Treat card ("The golden hourglass is already claimed") → `VO_GRAND_GONE` |
| Fortune | `SFX_STOP` → `SFX_FORTUNE` → `VO_FORTUNE_INTRO_*` → card → `VO_FORTUNE_nn` |
| Spin Again | `SFX_STOP` → `SFX_CAT` → `VO_SPIN_AGAIN` → card ("SPIN NOW") |

Music ducks to 30% while any `VO_*` plays.

## 6. Audio cue sheet (ElevenLabs)

| ID | Type | Length | Prompt |
| --- | --- | --- | --- |
| MUS_MAIN | Music loop (instrumental) | 90 s | Instrumental, mysterious Victorian music box and low cello, slow waltz, candlelit fortune teller's parlour, eerie but playful, seamless loop |
| AMB_WIND | Ambience loop | 20 s | Soft night wind through a ruined chapel, distant owl, seamless loop |
| SFX_SPIN_START | SFX | 1 s | Heavy wooden wheel creaks and starts turning |
| SFX_TICK | SFX | 0.1 s | Single wooden peg click against a leather flap |
| SFX_DRONE_RISE | SFX | 5 s | Rising ghostly choir drone building tension |
| SFX_STOP | SFX | 1 s | Wheel thuds to a stop, candle flames whoosh up |
| SFX_WIN_SMALL | SFX | 2 s | Magical chime with tiny sparkles and a soft spooky giggle |
| SFX_WIN_GRAND | SFX | 4 s | Grand pipe organ sting, bells and shimmering gold sparkles |
| SFX_FORTUNE | SFX | 2 s | Crystal ball hum, glassy shimmer |
| SFX_CARD | SFX | 2 s | Old parchment scroll unrolling with a soft whoosh |
| SFX_CAT | SFX | 1 s | Black cat meow, slightly echoey |
| SFX_CURTAIN | SFX | 2 s | Heavy velvet curtain sweeps open |

**Voice:** create with ElevenLabs Voice Design — *"elderly woman, warm, low, slow, theatrical fortune teller, neutral English accent, breathy whisper"* — or pick one from the Voice Library (mysterious). Use a model that supports audio tags.

**Budget:** voice ≈ 3,000 characters, SFX ≈ 41 s × 40 credits ≈ 1,640 credits, plus one music track. Fits easily in 30,000 credits with retakes.

Output: MP3, 44.1 kHz, 128 kbps. `npm run audio:normalize` (ffmpeg) sets loudness: voice −17 LUFS, effects −20 (tick −26, card −24, grand sting −18), music −18, wind −28, and trims long silence at the start/end of voice lines.

## 7. Visual design

### Colour tokens (Figma variables: `Nocturne / Night`)

| Token | Hex | Use |
| --- | --- | --- |
| bg/night | `#0E0B12` | Page background |
| bg/plum | `#241629` | Fortune slices, panels |
| surface/plum-light | `#3A2343` | Fortune slices, card footnotes |
| surface/parchment | `#E9DCC0` | Result cards (`#F4EAD3 → #DCC9A2` gradient) |
| ink/dark | `#1B1418` | Text on light/gold |
| ink/bone | `#F2E8D5` | Text on dark |
| ink/muted | `#B9A8B8` | Secondary text on dark |
| accent/gold | `#D9A441` | Treat slices, borders, labels |
| accent/gold-light | `#E9C46A` | Pointer, highlights, Grand text |
| accent/ember | `#E0662A` | Spin Again slice, pointer gem |
| accent/rust | `#8F3110` | Eyebrow text on parchment (accessible) |
| accent/crimson | `#8E1B2E` | Grand Prize slice and card |
| accent/spectral | `#7FB8A8` | Crystal-ball glow, speaking indicator |

Primary button: linear gradient `#F3D78A → #B8862B`, ink text.

### Typography (Google Fonts)

| Style | Font | Size / line height |
| --- | --- | --- |
| Display/Title | Cinzel Decorative Bold | 44 / 110% |
| Display/Title Small | Cinzel Decorative Bold | 28 / 115% |
| Heading/H2 | Cinzel Bold | 24 / 120% |
| Label/Button | Cinzel Bold | 20 / 100%, +4% tracking |
| Label/Slice | Cinzel Bold | 14 / 100%, +4% tracking |
| Body/Fortune | Cormorant Garamond Medium Italic | 26 / 130% |
| Body/Regular | Cormorant Garamond Medium | 18 / 140% |
| Body/Caption | Cormorant Garamond Medium Italic | 18 / 140% |

### Components (Figma page "Style & Components")

- **Wheel of Fate** — `Rotor` (slices, content, pegs, rays) rotates; `Pointer` and `Hub` are fixed.
- **Button** — Primary · Secondary · Disabled · Focused. Height 60, radius 30, 36 px side padding, min width 200.
- **Result Card** — Fortune · Treat · Grand Prize (crimson/gold, glow) · Spin Again. Width 358 (phone) / 400–480 (tablet, desktop), hugs height.
- **Caption** — subtitle bubble with speaking indicator.
- **Sound Toggle** — 48 × 48.
- **Art (original SVG)** — Madame Nocturne, crystal ball, skull candle, winged hourglass, black cat, candelabra, bat.

### Layouts

| Device | Design size | Layout |
| --- | --- | --- |
| Phone portrait | 390 × 844 | Header · Madame + caption · wheel 333 px · full-width button. Result card = bottom sheet, 24 px sides, 32 px bottom. |
| Phone landscape | 844 × 390 | Wheel left (≈327 px tall), side column right. |
| Tablet portrait | 820 × 1180 | Wheel 640 px centred, button 440 px; result card centred over dim layer. |
| Tablet landscape | 1180 × 820 | Wheel 620 px left, 400 px side column right (Madame, caption, button / result card). |
| Desktop | 1440 × 900 | Wheel 640 px, 420 px side column, candelabras at the edges. |

Rules: wheel size = `min(90vw, 60vh)`; glowing elements stay ≥ 24 px from the phone edge; inner layout containers never clip shadows.

## 8. Languages

| Setting | On-screen text | Voice files | Fonts |
| --- | --- | --- | --- |
| English | `src/i18n/en.json` + `script.json` | `public/audio/*.mp3` | Cinzel Decorative / Cinzel / Cormorant Garamond |
| Русский | `src/i18n/ru.json` | `public/audio/ru/*.mp3` | Cormorant SC (headings) / Cormorant Garamond (Cyrillic) |
| 简体中文 | `src/i18n/zh-Hans.json` | `public/audio/zh/*.mp3` (Mandarin) | Noto Serif SC, subset to used characters |
| 繁體中文 | `src/i18n/zh-Hant.json` | same Mandarin files as Simplified | Noto Serif TC, subset to used characters |

- Jokes are adapted, not translated literally (e.g. RU "оно только принимает зачёты", ZH "它最多只会点你的名").
- Russian quotes «…», Simplified “…”, Traditional 「…」. Chinese text is never italic.
- Madame Nocturne's main voice speaks all languages by default; optional `ELEVENLABS_VOICE_ID_RU` / `_ZH`.
- Translations should be checked by a native speaker before the event.

## 9. Accessibility (WCAG 2.2 AA)

- Text contrast ≥ 4.5:1 (large ≥ 3:1); UI component contrast ≥ 3:1. All tokens above were checked.
- Every slice has a text label + icon (never colour alone).
- Touch targets ≥ 44 px (buttons 60 px).
- Every spoken line is shown as a caption; mute button on every screen; no audio before the first tap.
- Keyboard: Tab order header → wheel → button; **Space/Enter spins**; **H** opens and closes the host panel; the ⚙ button has `aria-haspopup="dialog"` and `aria-expanded`; visible focus ring (bone, 4 px).
- Screen reader: wheel is a `button` ("Spin the wheel"); result announced via `aria-live="polite"`; decorative art `aria-hidden`.
- `prefers-reduced-motion`: 1 s fade/turn instead of long spin, no sparkles or flicker.
- No flashing more than 3 times per second.
- `<html lang>` follows the chosen language (`en`, `ru`, `zh-Hans`, `zh-Hant`); the host panel follows it (only the language names keep their own `lang`).
- Verify with axe + Lighthouse (target 100) and a manual VoiceOver/TalkBack pass.

## 10. Tech

| Part | Choice |
| --- | --- |
| Build | Vite + TypeScript (vanilla, no framework) |
| Wheel | Inline SVG, GSAP for rotation |
| Audio | Howler.js (mobile unlock, loops, ducking) |
| Content | `src/content/script.json` (lines, fortunes, prizes, odds) |
| State | `localStorage` for host settings and prize stock |
| Audio generation | `scripts/generate-audio.mjs` → ElevenLabs TTS, Sound Effects, Music APIs → `public/audio/*.mp3` |
| Hosting | GitHub Pages via GitHub Actions |

### Project structure

```
wheel-of-fate/
├─ index.html
├─ public/audio/            # generated MP3s (committed)
├─ src/
│  ├─ main.ts
│  ├─ wheel.ts              # SVG wheel + spin logic
│  ├─ audio.ts              # Howler setup, ducking
│  ├─ random.ts             # secure random + fortune deck
│  ├─ host-panel.ts
│  ├─ content/script.json
│  ├─ assets/icons/*.svg    # original art
│  └─ styles/tokens.css     # colour + type tokens from Figma
├─ scripts/generate-audio.mjs
├─ .env.example             # ELEVENLABS_API_KEY=
├─ .github/workflows/deploy.yml
├─ README.md
├─ SPEC.md
└─ LICENSE                  # MIT (code)
```

### Security & licensing

- `ELEVENLABS_API_KEY` lives only in `.env` (git-ignored). The key is never shipped to the browser.
- No Adobe Stock source files (`.ai`, `.eps`) in the repo — Adobe's licence forbids distributing stand-alone files. All art is original.
- README credits: "Voice, music and sound effects generated with ElevenLabs."

## 11. Acceptance criteria

- [ ] Loads and plays on iPhone Safari, Android Chrome, iPad, desktop Chrome/Safari/Firefox.
- [ ] Layout matches Figma at 390, 844 (landscape), 820, 1180, 1440 widths with no horizontal scroll.
- [ ] Wheel always stops fully inside the drawn result slice.
- [ ] 10,000 simulated spins land within ±1% of the configured odds.
- [ ] No fortune repeats until all 20 have played.
- [ ] Grand prize count never goes below 0; when it is 0 the Grand Prize slice gives a treat and `VO_GRAND_GONE` plays.
- [ ] Voice, captions and card text always match.
- [ ] Mute works instantly; settings survive a page reload.
- [ ] Keyboard-only and screen-reader play-through succeeds; reduced-motion respected.
- [ ] Lighthouse: Accessibility 100, Performance ≥ 90 on mobile.
- [ ] Repo contains no API key and no Adobe Stock files.
