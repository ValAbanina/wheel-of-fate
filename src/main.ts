import '@fontsource/cinzel-decorative/latin-700.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/cyrillic-500.css';
import '@fontsource/cormorant-garamond/cyrillic-500-italic.css';
import '@fontsource/cormorant-sc/cyrillic-700.css';
import '@fontsource/cormorant-sc/latin-700.css';
import './styles/main.css';
import { AudioEngine } from './audio';
import { captionText, content, fortuneById, isLang, LOCALES, linesFor as linesIn, type Lang, type Line, type SliceType, type UiKey } from './content';
import { Deck, pick, secureRandom, secureRandomInt } from './random';
import { onChange, settings, update } from './settings';
import { Wheel } from './wheel';
import batSvg from './assets/icons/bat.svg?raw';
import speakerSvg from './assets/icons/speaker.svg?raw';
import gearSvg from './assets/icons/gear.svg?raw';
import crystalBall from './assets/icons/crystal-ball.svg?raw';
import skullCandle from './assets/icons/skull-candle.svg?raw';
import hourglass from './assets/icons/winged-hourglass.svg?raw';
import blackCat from './assets/icons/black-cat.svg?raw';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- Decoration ---------- */
document.querySelectorAll<HTMLElement>('[data-icon="bat"]').forEach((el) => (el.innerHTML = batSvg));
$('sound-btn').innerHTML = speakerSvg;
$('host-btn').innerHTML = gearSvg;
(() => {
  const stars = $('stars');
  const count = Math.round((window.innerWidth * window.innerHeight) / 9000);
  const frag = document.createDocumentFragment();
  for (let i = 0; i < Math.min(count, 160); i++) {
    const s = document.createElement('span');
    const d = 1.5 + secureRandom() * 2.2;
    s.className = 'star';
    s.style.cssText = `width:${d}px;height:${d}px;left:${secureRandom() * 100}%;top:${secureRandom() * 62}%;opacity:${(0.3 + secureRandom() * 0.6).toFixed(2)}`;
    frag.appendChild(s);
  }
  stars.appendChild(frag);
})();

/* ---------- State ---------- */
const audio = new AudioEngine();
/* ---------- Language ---------- */
const loc = () => LOCALES[settings.lang];
const t = (key: UiKey) => loc().ui[key];
const linesFor = (moment: string) => linesIn(moment, settings.lang);
/** Prize names: the host's own text, or (if never changed) the default in the chosen language. */
const allDefaults = (key: 'defaultTreat' | 'defaultGrand') => Object.values(LOCALES).map((l) => l.ui[key]);
const isDefaultName = (name: string, key: 'defaultTreat' | 'defaultGrand') => allDefaults(key).includes(name);
const treatLabel = () => (isDefaultName(settings.treatName, 'defaultTreat') ? t('defaultTreat') : settings.treatName);
const grandLabel = () => (isDefaultName(settings.grandName, 'defaultGrand') ? t('defaultGrand') : settings.grandName);

const wheel = new Wheel($('wheel'), content.wheel, loc().wheel);
const fortunes = new Deck(content.fortunes, 'wof.fortunes.v1');
let spinning = false;
let idleTimer = 0;
let idleLines: Line[] = [];

void audio.init((text, speaking) => setCaption(text, speaking));

const captionEl = $('caption');
const captionTextEl = $('caption-text');
function setCaption(text: string, speaking: boolean): void {
  captionTextEl.textContent = text;
  captionEl.classList.toggle('is-speaking', speaking);
}

/* ---------- Enter ---------- */
/* Keep the screen awake while the game is running (tablets at an event). */
let wakeLock: { release: () => Promise<void> } | null = null;
async function keepAwake(): Promise<void> {
  try {
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (wl && document.visibilityState === 'visible') wakeLock = await wl.request('screen');
  } catch {
    /* not supported or not allowed — the game still works */
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock && !$('play').hidden) void keepAwake();
});

$('enter-btn').addEventListener('click', async () => {
  audio.unlock();
  void keepAwake();
  audio.sfx('SFX_CURTAIN');
  audio.syncLoops();
  const enter = $('enter');
  enter.classList.add('is-opening');
  await wait(reducedMotion() ? 0 : 700);
  enter.hidden = true;
  $('play').hidden = false;
  $('spin-btn').focus();

  let introPlayed = false;
  try {
    introPlayed = sessionStorage.getItem('wof.intro') === '1';
    sessionStorage.setItem('wof.intro', '1');
  } catch {
    /* ignore */
  }
  if (!introPlayed) await audio.say(pick(linesFor('intro')));
  else setCaption(t('welcomeBack'), false);
  armIdle();
});

/* ---------- Idle nudge ---------- */
function armIdle(): void {
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(async () => {
    if (spinning || ($('result') as HTMLDialogElement).open) return;
    if (idleLines.length === 0) idleLines = linesFor('idle').slice();
    const line = idleLines.splice(secureRandomInt(idleLines.length), 1)[0];
    await audio.say(line);
    armIdle();
  }, 20000);
}

/* ---------- Spin ---------- */
const spinBtn = $<HTMLButtonElement>('spin-btn');
const wheelBtn = $<HTMLButtonElement>('wheel');

function setSpinning(on: boolean): void {
  spinning = on;
  spinBtn.disabled = on;
  wheelBtn.disabled = on;
  spinBtn.textContent = on ? t('spinning') : t('spin');
}

async function spin(): Promise<void> {
  if (spinning) return;
  window.clearTimeout(idleTimer);
  audio.hush();
  setSpinning(true);

  // 1. Decide the result first — fair, secure, independent of the animation.
  const index = secureRandomInt(wheel.count);
  const landed: SliceType = wheel.typeAt(index);

  // 2. Spin.
  audio.sfx('SFX_SPIN_START');
  audio.sfx('SFX_DRONE_RISE');
  void audio.say(pick(linesFor('spin')));
  await wheel.spinTo(index, { reducedMotion: reducedMotion(), onTick: () => audio.sfx('SFX_TICK') });
  audio.stop('SFX_DRONE_RISE');
  audio.sfx('SFX_STOP');
  // Let Madame Nocturne finish her sentence before the card opens — never cut her off.
  await audio.whenQuiet();
  // If the host opened the settings mid-spin, the result waits until the panel is closed
  // (so the card never pops up on top of the panel, and any new settings are used).
  await hostClosed();

  // 3. Treats never run out. Grand prizes are counted; when they're all claimed,
  //    the Grand Prize slice gives a treat so nobody leaves empty-handed.
  let type: SliceType = landed;
  let grandGone = false;
  if (landed === 'grand') {
    if (settings.grandStock > 0) update({ grandStock: settings.grandStock - 1 });
    else {
      type = 'treat';
      grandGone = true;
    }
  }

  await reveal(type, grandGone);
  setSpinning(false);
}

spinBtn.addEventListener('click', () => void spin());
wheelBtn.addEventListener('click', () => void spin());

/* ---------- Result ---------- */
const resultDlg = $<HTMLDialogElement>('result');
const card = $('result-card');
const MEDAL: Record<SliceType, string> = { fortune: crystalBall, treat: skullCandle, grand: hourglass, cat: blackCat };

function showCard(type: SliceType, data: { eyebrow: string; title: string; body: string; foot: string; button: string }): void {
  card.className = `card card--${type}`;
  $('result-medal').innerHTML = MEDAL[type];
  $('result-eyebrow').textContent = data.eyebrow;
  const title = $('result-title');
  title.textContent = data.title;
  title.hidden = !data.title;
  $('result-body').textContent = data.body;
  $('result-foot').textContent = data.foot;
  const btn = $('result-btn');
  btn.textContent = data.button;
  // Only the black cat gives another spin; every other card just closes.
  btn.className = type === 'cat' ? 'btn btn--primary' : 'btn btn--close';
  resultDlg.dataset.type = type;
  if (!resultDlg.open) resultDlg.showModal();
  $('result-btn').focus();
  audio.sfx('SFX_CARD');
}

async function reveal(type: SliceType, grandGone: boolean): Promise<void> {
  switch (type) {
    case 'treat':
      audio.sfx('SFX_WIN_SMALL');
      showCard('treat', {
        eyebrow: grandGone ? t('grandGoneEyebrow') : t('treatEyebrow'),
        title: t('treatTitle'),
        body: grandGone ? t('grandGoneBody') : t('treatBody'),
        foot: `${t('prizePrefix')}${treatLabel()}`,
        button: t('close'),
      });
      void audio.say(grandGone ? linesFor('grandGone')[0] : pick(linesFor('treat')));
      break;
    case 'grand':
      audio.sfx('SFX_WIN_GRAND');
      sparkles(true);
      showCard('grand', {
        eyebrow: t('grandEyebrow'),
        title: t('grandTitle'),
        body: t('grandBody'),
        foot: `${t('prizePrefix')}${grandLabel()}`,
        button: t('close'),
      });
      void audio.say(pick(linesFor('grand')));
      break;
    case 'cat':
      audio.sfx('SFX_CAT');
      showCard('cat', {
        eyebrow: t('catEyebrow'),
        title: t('catTitle'),
        body: t('catBody'),
        foot: t('catFoot'),
        button: t('spinNow'),
      });
      void audio.say(linesFor('spinAgain')[0]);
      break;
    default: {
      audio.sfx('SFX_FORTUNE');
      await audio.say(pick(linesFor('fortuneIntro')));
      const f = fortuneById(fortunes.next().id, settings.lang);
      const [open, close] = loc().quotes;
      showCard('fortune', {
        eyebrow: t('fortuneEyebrow'),
        title: '',
        body: `${open}${captionText(f.text)}${close}`,
        foot: t('fortuneFoot'),
        button: t('close'),
      });
      void audio.say(f);
    }
  }
}

function closeResult(): void {
  audio.hush();
  sparkles(false);
  if (resultDlg.open) resultDlg.close();
}

$('result-btn').addEventListener('click', () => {
  const again = resultDlg.dataset.type === 'cat';
  closeResult();
  if (again) void spin();
  else spinBtn.focus();
  armIdle();
});
resultDlg.addEventListener('cancel', () => {
  audio.hush();
  sparkles(false);
  armIdle();
});

function sparkles(on: boolean): void {
  const layer = $('sparkles');
  layer.innerHTML = '';
  if (!on || reducedMotion()) return;
  for (let i = 0; i < 34; i++) {
    const s = document.createElement('span');
    s.className = 'sparkle';
    // twinkle periods ≥ 0.9 s → well under 3 flashes per second
    s.style.cssText = `left:${secureRandom() * 100}%;top:${secureRandom() * 80}%;--s:${8 + secureRandom() * 18}px;--d:${(0.9 + secureRandom() * 1.4).toFixed(2)}s`;
    layer.appendChild(s);
  }
}

/* ---------- Sound button ---------- */
const soundBtn = $<HTMLButtonElement>('sound-btn');
function renderSound(): void {
  soundBtn.setAttribute('aria-pressed', String(settings.muted));
  soundBtn.setAttribute('aria-label', settings.muted ? t('unmute') : t('mute'));
}
soundBtn.addEventListener('click', () => {
  update({ muted: !settings.muted });
  audio.setMuted(settings.muted);
  if (settings.muted) audio.hush();
  renderSound();
});
renderSound();

/* ---------- Host panel ---------- */
const hostDlg = $<HTMLDialogElement>('host-panel');
const treatName = $<HTMLInputElement>('treat-name');
const grandName = $<HTMLInputElement>('grand-name');
const optVoice = $<HTMLInputElement>('opt-voice');
const optMusic = $<HTMLInputElement>('opt-music');
const optSfx = $<HTMLInputElement>('opt-sfx');

function renderHost(): void {
  treatName.value = treatLabel();
  grandName.value = grandLabel();
  $('grand-stock').textContent = String(settings.grandStock);
  hostDlg.querySelectorAll<HTMLButtonElement>('[data-step="grandStock"]').forEach((b) => {
    const d = Number(b.dataset.delta);
    b.disabled = d < 0 ? settings.grandStock <= 0 : settings.grandStock >= content.defaults.grandStockMax;
  });
  optVoice.checked = settings.voice;
  optMusic.checked = settings.music;
  optSfx.checked = settings.sfx;
  hostDlg.querySelectorAll<HTMLInputElement>('input[name="lang"]').forEach((r) => (r.checked = r.value === settings.lang));
}
const hostBtn = $<HTMLButtonElement>('host-btn');
/** Resolves once the host panel is closed (right away if it isn't open). */
function hostClosed(): Promise<void> {
  if (!hostDlg.open) return Promise.resolve();
  return new Promise((resolve) => hostDlg.addEventListener('close', () => resolve(), { once: true }));
}
function openHost(): void {
  if (hostDlg.open) return; // works any time, even while the wheel is spinning
  renderHost();
  hostDlg.classList.remove('is-closing');
  hostDlg.showModal();
  hostBtn.setAttribute('aria-expanded', 'true');
}
/** Slide the panel out to the right, then close it. */
function closeHost(): void {
  if (!hostDlg.open || hostDlg.classList.contains('is-closing')) return;
  hostDlg.classList.add('is-closing');
  const done = () => {
    hostDlg.classList.remove('is-closing');
    if (hostDlg.open) hostDlg.close();
    hostBtn.setAttribute('aria-expanded', 'false');
  };
  hostDlg.addEventListener('animationend', done, { once: true });
  setTimeout(done, 400); // fallback if animations are off
}
$('host-close').addEventListener('click', closeHost);
hostBtn.addEventListener('click', () => (hostDlg.open ? closeHost() : openHost()));
$('host-form').addEventListener('submit', (e) => {
  e.preventDefault();
  closeHost();
});
hostDlg.addEventListener('cancel', (e) => {
  e.preventDefault(); // Esc: animate instead of closing instantly
  closeHost();
});
hostDlg.addEventListener('click', (e) => {
  if (e.target === hostDlg) closeHost(); // click on the dimmed area
});
/** Empty, or the default name in any language → store the default, so it keeps following the language. */
const fromField = (value: string, key: 'defaultTreat' | 'defaultGrand', englishDefault: string) => {
  const v = value.trim();
  return !v || isDefaultName(v, key) ? englishDefault : v;
};
// Save on every keystroke (not only when leaving the box): on iPhones, tapping elsewhere often
// doesn't take the cursor out of the box, so a "change" event alone could lose the edit.
const saveTreat = () => update({ treatName: fromField(treatName.value, 'defaultTreat', content.defaults.treatName) });
const saveGrand = () => update({ grandName: fromField(grandName.value, 'defaultGrand', content.defaults.grandName) });
treatName.addEventListener('input', saveTreat);
treatName.addEventListener('change', saveTreat);
grandName.addEventListener('input', saveGrand);
grandName.addEventListener('change', saveGrand);
// Leaving a box empty brings back the default name (in the chosen language).
treatName.addEventListener('blur', () => { if (!treatName.value.trim()) treatName.value = treatLabel(); });
grandName.addEventListener('blur', () => { if (!grandName.value.trim()) grandName.value = grandLabel(); });
$('reset-names').addEventListener('click', () => {
  update({ treatName: content.defaults.treatName, grandName: content.defaults.grandName });
  renderHost();
});
optVoice.addEventListener('change', () => update({ voice: optVoice.checked }));
optMusic.addEventListener('change', () => update({ music: optMusic.checked }));
optSfx.addEventListener('change', () => update({ sfx: optSfx.checked }));
hostDlg.querySelectorAll<HTMLInputElement>('input[name="lang"]').forEach((r) =>
  r.addEventListener('change', () => {
    if (r.checked && isLang(r.value)) setLang(r.value);
  }),
);
hostDlg.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) =>
  b.addEventListener('click', () => {
    const key = b.dataset.step as 'grandStock';
    update({ [key]: settings[key] + Number(b.dataset.delta) });
    renderHost();
  }),
);
const renderResetStock = () => ($('reset-stock').textContent = t('resetStock').replace('{n}', String(content.defaults.grandStock)));
$('reset-stock').addEventListener('click', () => {
  update({ grandStock: content.defaults.grandStock });
  renderHost();
});
let fortunesTimer = 0;
$('reset-fortunes').addEventListener('click', () => {
  fortunes.reset();
  $('reset-fortunes').textContent = t('fortunesReset');
  window.clearTimeout(fortunesTimer);
  fortunesTimer = window.setTimeout(() => ($('reset-fortunes').textContent = t('resetFortunes')), 1800);
});
onChange(() => {
  if (!$('play').hidden) audio.syncLoops();
});

// Open: long-press the title for 3 s, or press H.
let pressTimer = 0;
const brand = $('brand');
brand.addEventListener('pointerdown', () => (pressTimer = window.setTimeout(openHost, 3000)));
['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => brand.addEventListener(ev, () => window.clearTimeout(pressTimer)));
brand.addEventListener('contextmenu', (e) => e.preventDefault());

/* ---------- Keyboard ---------- */
document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  // Ignore keys only while typing text (prize names); radios, switches and buttons still allow H.
  const typing =
    (target instanceof HTMLInputElement && !['radio', 'checkbox', 'button', 'submit'].includes(target.type)) ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable;
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key.toLowerCase() === 'h') {
    e.preventDefault();
    if (hostDlg.open) closeHost();
    else openHost();
  }
});

/* ---------- Apply language ---------- */
function applyLang(): void {
  const l = loc();
  document.documentElement.lang = l.htmlLang;
  document.title = l.ui.docTitle;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as UiKey);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel as UiKey));
  });
  wheel.setLabels(l.wheel);
  audio.setVoiceFolder(l.audio);
  spinBtn.textContent = spinning ? t('spinning') : t('spin');
  if (!captionEl.classList.contains('is-speaking')) setCaption(t('waiting'), false);
  renderSound();
  renderResetStock();
  if (hostDlg.open) renderHost(); // refresh the prize-name boxes in the new language right away
}

function setLang(lang: Lang): void {
  if (lang === settings.lang) return;
  audio.hush();
  update({ lang });
  idleLines = [];
  applyLang();
  audio.preloadVoice();
}

applyLang();
