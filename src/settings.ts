import { content, isLang, type Lang } from './content';
import { load, save } from './random';

export interface Settings {
  treatName: string;
  grandName: string;
  grandStock: number;
  voice: boolean;
  music: boolean;
  sfx: boolean;
  muted: boolean;
  lang: Lang;
}

const KEY = 'wof.settings.v2'; // v2: treats are unlimited, grand prizes default to 3
const { treatName, grandName, grandStock } = content.defaults;
const defaults: Settings = { treatName, grandName, grandStock, voice: true, music: true, sfx: true, muted: false, lang: 'en' };

export const settings: Settings = { ...defaults, ...load<Partial<Settings>>(KEY, {}) };
if (!isLang(settings.lang)) settings.lang = 'en';

type Listener = (s: Settings) => void;
const listeners = new Set<Listener>();

export function update(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  settings.grandStock = Math.max(0, Math.min(content.defaults.grandStockMax, Math.round(settings.grandStock)));
  save(KEY, settings);
  listeners.forEach((l) => l(settings));
}

export function onChange(l: Listener): void {
  listeners.add(l);
}
