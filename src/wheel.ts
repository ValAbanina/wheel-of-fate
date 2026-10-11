import { gsap } from 'gsap';
import type { SliceType } from './content';
import crystalBall from './assets/icons/crystal-ball.svg?raw';
import skullCandle from './assets/icons/skull-candle.svg?raw';
import hourglass from './assets/icons/winged-hourglass.svg?raw';
import blackCat from './assets/icons/black-cat.svg?raw';
import { secureRandom } from './random';
import { SLICE_DEG as SLICE, targetRotation } from './spin-math';

const NS = 'http://www.w3.org/2000/svg';
const CX = 320;
const CY = 360;
const R = 300;

export type WheelLabels = Record<SliceType | 'hub', string>;
const isCJK = (t: string) => /[\u3400-\u9fff]/.test(t);
/** Font size for a slice label: Latin/Cyrillic labels are small caps; Chinese needs bigger glyphs. */
const labelSize = (t: string, type: SliceType) => (isCJK(t) ? (t.length > 2 ? 16 : 19) : type === 'grand' || t.length > 10 ? 13 : 14);
const ICON: Record<SliceType, string> = {
  grand: hourglass.replaceAll('#1B1418', '#F3D78A'),
  treat: skullCandle,
  fortune: crystalBall,
  cat: blackCat,
};

const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;
};

export class Wheel {
  readonly svg: SVGSVGElement;
  private rotor: SVGGElement;
  private rotation = 0;
  private tween: gsap.core.Tween | null = null;

  private slices: SliceType[];
  private labels: WheelLabels;

  constructor(host: HTMLElement, slices: SliceType[], labels: WheelLabels) {
    this.slices = slices;
    this.labels = labels;
    this.svg = this.build();
    this.rotor = this.svg.querySelector('#rotor') as SVGGElement;
    host.appendChild(this.svg);
  }

  get count(): number {
    return this.slices.length;
  }

  /** Swap the slice and hub words (language change) without rebuilding the wheel. */
  setLabels(labels: WheelLabels): void {
    this.labels = labels;
    this.svg.querySelectorAll<SVGTextElement>('text[data-type]').forEach((t) => {
      const type = t.dataset.type as SliceType;
      t.textContent = labels[type];
      t.setAttribute('font-size', String(labelSize(labels[type], type)));
    });
    const hub = this.svg.querySelector<SVGTextElement>('#hub-label');
    if (hub) {
      hub.textContent = labels.hub;
      hub.setAttribute('font-size', isCJK(labels.hub) ? '24' : labels.hub.length > 4 ? '15' : '19');
    }
  }

  typeAt(index: number): SliceType {
    return this.slices[index];
  }

  /** Animate so that slice `index` stops under the pointer. Resolves when the wheel stops. */
  spinTo(index: number, opts: { reducedMotion: boolean; onTick: () => void }): Promise<void> {
    this.tween?.kill();
    const current = this.rotation;
    const turns = opts.reducedMotion ? 1 : 5 + Math.floor(secureRandom() * 3); // 5–7 full turns
    const jitter = (secureRandom() * 2 - 1) * (SLICE / 2 - 4); // stay ≥4° away from the pegs
    const target = targetRotation(current, index, turns, jitter);
    const duration = opts.reducedMotion ? 1.2 : 4.6 + secureRandom() * 1.2;
    const state = { deg: current };
    let lastPeg = Math.floor((current + SLICE / 2) / SLICE);

    return new Promise((resolve) => {
      this.tween = gsap.to(state, {
        deg: target,
        duration,
        ease: opts.reducedMotion ? 'power2.out' : 'power4.out',
        onUpdate: () => {
          this.setRotation(state.deg);
          const peg = Math.floor((state.deg + SLICE / 2) / SLICE);
          if (peg !== lastPeg) {
            lastPeg = peg;
            opts.onTick();
          }
        },
        onComplete: () => {
          this.rotation = target % 360;
          this.setRotation(this.rotation);
          resolve();
        },
      });
    });
  }

  private setRotation(deg: number): void {
    this.rotor.setAttribute('transform', `rotate(${deg.toFixed(3)} ${CX} ${CY})`);
  }

  private build(): SVGSVGElement {
    const n = this.slices.length;
    const fill = (t: SliceType, i: number) =>
      t === 'grand' ? 'url(#g-grand)' : t === 'treat' ? '#D9A441' : t === 'cat' ? '#E0662A' : i % 2 ? '#3A2343' : '#241629';
    const textFill = (t: SliceType) => (t === 'fortune' ? '#F2E8D5' : t === 'grand' ? '#E9C46A' : '#1B1418');

    let slices = '';
    let content = '';
    let pegs = '';
    for (let i = 0; i < n; i++) {
      const t = this.slices[i];
      const a0 = -90 - SLICE / 2 + i * SLICE;
      const [x0, y0] = polar(a0, R);
      const [x1, y1] = polar(a0 + SLICE, R);
      slices += `<path d="M${CX} ${CY}L${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z" fill="${fill(t, i)}" stroke="${t === 'grand' ? '#E9C46A' : '#D9A441'}" stroke-width="${t === 'grand' ? 3 : 1.5}"/>`;
      if (t === 'grand') {
        for (let k = -2; k <= 2; k++) {
          const [rx0, ry0] = polar(-90 + i * SLICE + k * 5, R * 0.32);
          const [rx1, ry1] = polar(-90 + i * SLICE + k * 5, R - 4);
          slices += `<line x1="${rx0.toFixed(1)}" y1="${ry0.toFixed(1)}" x2="${rx1.toFixed(1)}" y2="${ry1.toFixed(1)}" stroke="#FFE7A3" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>`;
        }
      }
      const size = t === 'fortune' ? 58 : 62;
      const icon = ICON[t].replace('<svg ', `<svg x="${CX - size / 2}" y="${CY - 228}" width="${size}" height="${size}" `);
      content += `<g transform="rotate(${i * SLICE} ${CX} ${CY})"><text data-type="${t}" x="${CX}" y="${CY - 240}" text-anchor="middle" font-size="${labelSize(this.labels[t], t)}" fill="${textFill(t)}">${this.labels[t]}</text>${icon}</g>`;
      const [px, py] = polar(a0, R - 1);
      pegs += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="6" fill="#E9C46A" stroke="#1B1418" stroke-width="2"/>`;
    }

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 640 680');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.innerHTML = `
      <defs>
        <radialGradient id="g-grand" cx="${CX}" cy="${CY}" r="${R}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#9E2238"/><stop offset=".6" stop-color="#8E1B2E"/><stop offset="1" stop-color="#4E0B18"/>
        </radialGradient>
        <linearGradient id="g-hub" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F3D78A"/><stop offset="1" stop-color="#A87423"/>
        </linearGradient>
      </defs>
      <circle cx="${CX}" cy="${CY}" r="${R + 12}" fill="#1B1418" stroke="#D9A441" stroke-width="4"/>
      <g id="rotor">${slices}${content}${pegs}</g>
      <circle cx="${CX}" cy="${CY}" r="54" fill="url(#g-hub)"/>
      <circle cx="${CX}" cy="${CY}" r="42" fill="#0E0B12" stroke="#D9A441" stroke-width="2"/>
      <text id="hub-label" x="${CX}" y="${CY + 7}" text-anchor="middle" font-size="19" fill="#E9C46A" style="font-family: var(--font-display)">${this.labels.hub}</text>
      <path d="M${CX - 28} ${CY - R - 44}H${CX + 28}L${CX} ${CY - R + 28}Z" fill="#E9C46A" stroke="#1B1418" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="${CX}" cy="${CY - R - 28}" r="10" fill="#E0662A" stroke="#1B1418" stroke-width="2"/>`;
    return svg;
  }
}
