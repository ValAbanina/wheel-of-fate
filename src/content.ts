import data from './content/script.json';
import en from './i18n/en.json';
import ru from './i18n/ru.json';
import zhHans from './i18n/zh-Hans.json';
import zhHant from './i18n/zh-Hant.json';

export type SliceType = 'grand' | 'treat' | 'fortune' | 'cat';
export interface Line { id: string; text: string; moment?: string }
export interface AudioCue { id: string; kind: 'music' | 'sfx'; seconds: number; prompt: string; loop: boolean }

/** English script: voice lines, fortunes, audio prompts and the wheel order. */
export const content = data as {
  title: string;
  voice: Line[];
  fortunes: Line[];
  audio: AudioCue[];
  wheel: SliceType[];
  defaults: { treatName: string; grandName: string; grandStock: number; grandStockMax: number };
};

/* ---------- Languages ---------- */
export type Lang = 'en' | 'ru' | 'zh-Hans' | 'zh-Hant';
export type UiKey = keyof typeof en.ui;

export interface Locale {
  label: string;
  htmlLang: string;
  /** Folder of the voice recordings: 'en' (root), 'ru' or 'zh' (shared by both Chinese scripts). */
  audio: string;
  quotes: string[];
  ui: Record<UiKey, string>;
  wheel: Record<SliceType | 'hub', string>;
  voice?: Record<string, string>;
  fortunes?: Record<string, string>;
}

export const LOCALES: Record<Lang, Locale> = {
  en: en as Locale,
  ru: ru as Locale,
  'zh-Hans': zhHans as Locale,
  'zh-Hant': zhHant as Locale,
};
export const LANGS = Object.keys(LOCALES) as Lang[];
export const isLang = (v: unknown): v is Lang => typeof v === 'string' && v in LOCALES;

/** A voice line in the given language (falls back to English text if a translation is missing). */
function localize(line: Line, lang: Lang): Line {
  const loc = LOCALES[lang];
  const text = loc.voice?.[line.id] ?? loc.fortunes?.[line.id] ?? line.text;
  return { ...line, text };
}

export const linesFor = (moment: string, lang: Lang): Line[] =>
  content.voice.filter((l) => l.moment === moment).map((l) => localize(l, lang));

export const fortuneById = (id: string, lang: Lang): Line =>
  localize(content.fortunes.find((f) => f.id === id) ?? content.fortunes[0], lang);

/** Text shown on screen: performance tags like [whispers] are removed. */
export const captionText = (text: string): string => text.replace(/\[[^\]]*\]\s*/g, '').trim();
