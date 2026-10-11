import { Howl, Howler } from 'howler';
import { captionText, type Line } from './content';
import { settings } from './settings';

const BASE = import.meta.env.BASE_URL;
const LOOPS = new Set(['MUS_MAIN', 'AMB_WIND']);
// Files are loudness-normalised (npm run audio:normalize); these set the mix under the voice.
const VOLUME: Record<string, number> = { MUS_MAIN: 0.55, AMB_WIND: 0.6, SFX_TICK: 0.6, SFX_DRONE_RISE: 0.8 };
const DUCK = 0.3;

type CaptionFn = (text: string, speaking: boolean) => void;

/**
 * Plays the pre-generated ElevenLabs files listed in public/audio/manifest.json.
 * Anything missing falls back gracefully: voice → caption only, key effects → tiny synthesized sounds.
 */
export class AudioEngine {
  private howls = new Map<string, Howl>();
  private available = new Set<string>();
  private ctx: AudioContext | null = null;
  private onCaption: CaptionFn = () => {};
  /** Voice folder: 'en' = public/audio/, otherwise public/audio/<folder>/ (e.g. 'ru', 'zh'). */
  private voiceFolder = 'en';

  setVoiceFolder(folder: string): void {
    this.voiceFolder = folder;
  }

  private voicePath(id: string): string {
    return this.voiceFolder === 'en' ? id : `${this.voiceFolder}/${id}`;
  }

  async init(onCaption: CaptionFn): Promise<void> {
    this.onCaption = onCaption;
    try {
      const res = await fetch(`${BASE}audio/manifest.json`, { cache: 'no-cache' });
      if (res.ok) {
        const list = (await res.json()) as string[];
        list.forEach((id) => this.available.add(id));
      }
    } catch {
      /* no manifest yet — run `npm run audio` to generate the files */
    }
    Howler.mute(settings.muted);
  }

  /** Must be called from a user gesture (the Enter button) so browsers allow sound. */
  unlock(): void {
    // iPhone/iPad: play even when the ring/silent switch is on (Safari 16.4+).
    try {
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'playback';
    } catch {
      /* not supported */
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = Howler.ctx ?? new Ctx();
      void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
    // Preload the shared sounds and the current language's voice (small files; music streams).
    for (const path of this.available) if (!path.includes('/') && !path.startsWith('VO_')) this.howl(path);
    this.preloadVoice();
  }

  /** After a language change: load the new language's voice files (only once audio is unlocked). */
  preloadVoice(): void {
    if (!this.ctx && !Howler.ctx) return;
    for (const path of this.available) if (path.startsWith(`${this.voiceFolder}/`) || (this.voiceFolder === 'en' && path.startsWith('VO_'))) this.howl(path);
  }

  get hasVoice(): boolean {
    return [...this.available].some((id) => id.startsWith('VO_'));
  }

  /** `path` is the file name without .mp3, relative to public/audio/ (e.g. 'SFX_TICK' or 'ru/VO_INTRO_1'). */
  private howl(path: string): Howl | null {
    if (!this.available.has(path)) return null;
    let h = this.howls.get(path);
    if (!h) {
      h = new Howl({
        src: [`${BASE}audio/${path}.mp3`],
        loop: LOOPS.has(path),
        volume: VOLUME[path] ?? 1,
        // Web Audio for everything (not HTML5 audio): iPhones ignore volume on HTML5 audio,
        // which would stop the music from ducking under the voice.
        html5: false,
        preload: true,
        onloaderror: () => this.available.delete(path),
      });
      this.howls.set(path, h);
    }
    return h;
  }

  setMuted(muted: boolean): void {
    Howler.mute(muted);
  }

  /** Start / stop the looping beds according to the host settings. */
  syncLoops(): void {
    this.loop('MUS_MAIN', settings.music);
    this.loop('AMB_WIND', settings.sfx);
  }

  private loop(id: string, on: boolean): void {
    const h = this.howl(id);
    if (!h) return;
    if (on && !h.playing()) {
      h.volume(0);
      h.play();
      h.fade(0, VOLUME[id] ?? 1, 1500);
    } else if (!on && h.playing()) {
      h.stop();
    }
  }

  /** Play a sound effect (fire and forget). */
  sfx(id: string): void {
    if (!settings.sfx) return;
    const h = this.howl(id);
    if (h) {
      h.play();
      return;
    }
    this.synth(id);
  }

  stop(id: string): void {
    this.howls.get(id)?.stop();
  }

  /**
   * Speak a line: shows the caption, plays the voice file and ducks the music.
   * Resolves when the line ends (or after a reading-time estimate when there is no audio).
   */
  /**
   * Speak a line: shows the caption, plays the voice file and ducks the music.
   * Lines never cut each other off: a new line waits until the current one has finished.
   * Only hush() interrupts (a new spin, closing a card, muting, changing language).
   * Resolves when this line has finished (or after a reading-time estimate when there is no audio).
   */
  say(line: Line): Promise<void> {
    const gen = this.gen;
    const run = () => (gen === this.gen ? this.speak(line) : Promise.resolve());
    this.queue = this.queue.then(run, run);
    return this.queue;
  }

  /** Resolves once everything queued has been spoken (used before opening a result card). */
  whenQuiet(): Promise<void> {
    return this.queue;
  }

  /** Stop the line being spoken right now and drop anything queued. */
  hush(): void {
    this.gen++;
    this.stopCurrent?.();
    this.queue = Promise.resolve();
  }

  private gen = 0;
  private queue: Promise<void> = Promise.resolve();
  private stopCurrent: (() => void) | null = null;

  private speak(line: Line): Promise<void> {
    const text = captionText(line.text);
    const gen = this.gen;
    this.onCaption(text, true);
    const h = settings.voice && !settings.muted ? this.howl(this.voicePath(line.id)) : null;

    return new Promise<void>((resolve) => {
      let finished = false;
      let timer = 0;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        this.stopCurrent = null;
        if (h) {
          h.off('end', finish);
          this.duck(false);
        }
        if (gen === this.gen) this.onCaption(text, false); // keep the text, stop the "speaking" dot
        resolve();
      };
      this.stopCurrent = () => {
        h?.stop();
        finish();
      };

      if (!h) {
        // No recording (or voice off): leave the caption up for a reading-time estimate.
        // Chinese has no spaces, so count characters for it.
        const words = /[\u3400-\u9fff]/.test(text) ? text.length / 3 : text.split(/\s+/).length;
        timer = window.setTimeout(finish, Math.min(7000, Math.max(1400, words * 330 + 600)));
        return;
      }
      this.duck(true);
      h.once('end', finish);
      h.once('playerror', finish);
      h.play();
      timer = window.setTimeout(finish, 20000); // safety net
    });
  }

  private duck(on: boolean): void {
    const m = this.howls.get('MUS_MAIN');
    if (!m || !m.playing()) return;
    const full = VOLUME.MUS_MAIN;
    m.fade(m.volume() as number, on ? full * DUCK : full, 300);
  }

  /* ---- Tiny synthesized fallbacks so the game feels alive before the real files exist ---- */
  private synth(id: string): void {
    const ctx = this.ctx;
    if (!ctx || settings.muted) return;
    const t = ctx.currentTime;
    const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.2) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t + start);
      g.gain.setValueAtTime(0.0001, t + start);
      g.gain.exponentialRampToValueAtTime(gain, t + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t + start);
      o.stop(t + start + dur + 0.05);
    };
    switch (id) {
      case 'SFX_TICK':
        tone(1800, 0, 0.03, 'square', 0.06);
        break;
      case 'SFX_STOP':
        tone(90, 0, 0.35, 'sine', 0.35);
        break;
      case 'SFX_WIN_SMALL':
        [659, 784, 988].forEach((f, i) => tone(f, i * 0.09, 0.5, 'triangle', 0.15));
        break;
      case 'SFX_WIN_GRAND':
        [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.9, 'triangle', 0.16));
        break;
      case 'SFX_FORTUNE':
        [880, 1109, 1319].forEach((f, i) => tone(f, i * 0.05, 1.2, 'sine', 0.06));
        break;
      case 'SFX_CAT':
        tone(700, 0, 0.25, 'sawtooth', 0.05);
        break;
      default:
        break;
    }
  }
}
