/**
 * Динамический акцент: подкрашивает ВЕСЬ интерфейс под текущее аниме.
 *
 * Zine-стиль выводит все акцентные оттенки (accent-soft, accent-glow, …) через
 * color-mix от --color-accent / --color-accent-hover. Поэтому достаточно
 * переопределить эти две переменные на :root — и перекрашивается сайдбар,
 * титлбар, кнопки, карточки, полосы — всё сразу.
 *
 * Оттенок берём из постера, но насыщенность и светлоту держим в «зиновском»
 * диапазоне (как у киновари #e04836), чтобы акцент всегда читался и на бумаге,
 * и на чернилах. Серые постеры не трогают тему.
 */

let tinting = false;
/** Базовый акцент активной темы — чтобы вернуть при сбросе. */
let baseAccent: string | null = null;
let baseAccentHover: string | null = null;
let applyGen = 0;

// Сменили тему во время тонирования — тема сама поставила акцент, поэтому
// перестаём отслеживать устаревший базовый цвет (иначе сброс вернул бы не тот).
if (typeof window !== 'undefined') {
  window.addEventListener('anix:themeChanged', () => {
    tinting = false;
    baseAccent = baseAccentHover = null;
  });
}

const CACHE_LIMIT = 60;
const hueCache = new Map<string, number | null>();

function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

/**
 * Доминирующий выразительный оттенок изображения (в градусах) либо null,
 * если картинка блёклая/серая — тогда тему не трогаем.
 */
/**
 * URL, с которого пиксели реально можно прочитать.
 * В Electron прямой CDN cross-origin → читаем через привилегированный
 * anix-cdn:// прокси (corsEnabled). В web-dev /__cdn same-origin — как есть.
 */
function readbackUrl(url: string): string {
  const el = (window as unknown as { electron?: unknown }).electron;
  if (el && /^https:\/\/[^/]*anix/i.test(url)) {
    return `anix-cdn://asset/?u=${encodeURIComponent(url)}`;
  }
  return url;
}

async function extractHue(url: string): Promise<number | null> {
  if (hueCache.has(url)) return hueCache.get(url)!;

  let hue: number | null = null;
  try {
    // fetch → blob → bitmap: свой blob same-origin, поэтому canvas не «протухает»
    // (getImageData не упрётся в CORS, как было бы с прямым <img>).
    const res = await fetch(readbackUrl(url), { cache: 'force-cache' });
    if (res.ok) {
      const bitmap = await createImageBitmap(await res.blob());
      const S = 48;
      const canvas = document.createElement('canvas');
      canvas.width = S; canvas.height = S;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, S, S);
        const data = ctx.getImageData(0, 0, S, S).data;

        // Круговое среднее оттенка с весом по насыщенности: выразительные
        // пиксели важнее, фон/серость почти не влияют.
        let sx = 0, sy = 0, wsum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          if (l < 12 || l > 92) continue;         // почти чёрное/белое — мимо
          const w = (s / 100) ** 2;               // сильнее ценим насыщенное
          if (w < 0.02) continue;
          const rad = (h * Math.PI) / 180;
          sx += Math.cos(rad) * w;
          sy += Math.sin(rad) * w;
          wsum += w;
        }
        bitmap.close();
        // Мало насыщенных пикселей → постер серый, оставляем киноварь.
        if (wsum > 6) {
          let deg = (Math.atan2(sy, sx) * 180) / Math.PI;
          if (deg < 0) deg += 360;
          hue = deg;
        }
      }
    }
  } catch {
    /* ignore — просто не подкрашиваем */
  }

  if (hueCache.size > CACHE_LIMIT) hueCache.delete(hueCache.keys().next().value!);
  hueCache.set(url, hue);
  return hue;
}

function currentAccent(): { accent: string; hover: string } {
  const cs = getComputedStyle(document.documentElement);
  return {
    accent: cs.getPropertyValue('--color-accent').trim() || '#e04836',
    hover: cs.getPropertyValue('--color-accent-hover').trim() || '#f2624f',
  };
}

/** Тонируем весь UI под оттенок постера этого аниме. */
export async function setAccentFromImage(url: string): Promise<void> {
  if (!url) return;
  const gen = ++applyGen;
  const hue = await extractHue(url);
  if (gen !== applyGen) return;           // уже ушли на другой релиз
  if (hue == null) { clearAccent(); return; }

  if (!tinting) {
    const base = currentAccent();
    baseAccent = base.accent;
    baseAccentHover = base.hover;
  }
  tinting = true;

  // S/L фиксируем в зиновском диапазоне — акцент всегда сочный и читаемый.
  const accent = hslToHex(hue, 68, 54);
  const hover = hslToHex(hue, 72, 64);
  const root = document.documentElement;
  root.style.setProperty('--color-accent', accent);
  root.style.setProperty('--color-accent-hover', hover);
}

/** Возврат к акценту темы. */
export function clearAccent(): void {
  applyGen++;
  if (!tinting) return;
  tinting = false;
  const root = document.documentElement;
  if (baseAccent) root.style.setProperty('--color-accent', baseAccent);
  else root.style.removeProperty('--color-accent');
  if (baseAccentHover) root.style.setProperty('--color-accent-hover', baseAccentHover);
  else root.style.removeProperty('--color-accent-hover');
  baseAccent = baseAccentHover = null;
}
