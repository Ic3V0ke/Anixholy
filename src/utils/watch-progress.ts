/**
 * Локальное сохранение позиции просмотра серии (посекундный «resume»).
 *
 * Anixart API помнит только «серия просмотрена», без секунд. Чтобы можно было
 * выйти на 25:45 и вернуться туда же, храним позицию в localStorage.
 */

const STORAGE_KEY = 'anixapp.watchProgress';
const MAX_ENTRIES = 300;

// Не сохраняем самое начало (нет смысла) и самый конец (серия по сути досмотрена).
const MIN_SAVE_SEC = 20;
const END_GUARD_SEC = 90;
// Не предлагать resume, если запись старше 60 дней.
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

interface ProgressEntry {
  t: number; // позиция в секундах
  d: number; // длительность (0 — неизвестна)
  at: number; // время сохранения (ms)
}

type ProgressMap = Record<string, ProgressEntry>;

function key(releaseId: string | number, ep: string | number): string {
  return `${releaseId}:${ep}`;
}

function readAll(): ProgressMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ProgressMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: ProgressMap): void {
  try {
    const keys = Object.keys(map);
    if (keys.length > MAX_ENTRIES) {
      // Выкидываем самые старые записи.
      keys
        .sort((a, b) => (map[a]?.at ?? 0) - (map[b]?.at ?? 0))
        .slice(0, keys.length - MAX_ENTRIES)
        .forEach((k) => delete map[k]);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / storage errors */
  }
}

/** Сохранить позицию. Возле начала/конца серии запись очищается. */
export function saveWatchProgress(
  releaseId: string | number,
  ep: string | number,
  time: number,
  duration: number,
): void {
  if (!releaseId || !Number.isFinite(time)) return;
  const map = readAll();
  const k = key(releaseId, ep);

  const nearEnd = duration > 0 && time >= duration - END_GUARD_SEC;
  if (time < MIN_SAVE_SEC || nearEnd) {
    if (map[k]) {
      delete map[k];
      writeAll(map);
    }
    return;
  }

  map[k] = { t: time, d: duration > 0 ? duration : 0, at: Date.now() };
  writeAll(map);
}

/** Позиция для возобновления, либо null, если её нет / запись устарела / у конца. */
export function getWatchProgress(
  releaseId: string | number,
  ep: string | number,
): number | null {
  const map = readAll();
  const entry = map[key(releaseId, ep)];
  if (!entry) return null;
  if (Date.now() - entry.at > MAX_AGE_MS) return null;
  if (entry.t < MIN_SAVE_SEC) return null;
  if (entry.d > 0 && entry.t >= entry.d - END_GUARD_SEC) return null;
  return entry.t;
}

/** Забыть позицию (например, серия досмотрена до конца). */
export function clearWatchProgress(releaseId: string | number, ep: string | number): void {
  const map = readAll();
  const k = key(releaseId, ep);
  if (map[k]) {
    delete map[k];
    writeAll(map);
  }
}

// ── Где начинается эндинг ────────────────────────────────────────────────────
// Anixart не отдаёт главы, поэтому момент титров узнаём двумя путями:
// берём типичную длину ED по умолчанию и уточняем по тому, где пользователь
// сам жмёт «следующая серия».

const ENDING_KEY = 'anixapp.endingLead';
/** Типичный эндинг ~1:30. */
export const DEFAULT_ENDING_LEAD = 90;
const MIN_LEAD = 20;
const MAX_LEAD = 210;

interface LeadEntry {
  /** Секунд от конца серии, где начинаются титры. */
  lead: number;
  /** Сколько раз уточняли — чтобы усреднять со стабильным весом. */
  n: number;
}

function readLeads(): Record<string, LeadEntry> {
  try {
    const raw = localStorage.getItem(ENDING_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Сколько секунд до конца серии показывать предложение следующей. */
export function getEndingLead(releaseId: string | number): number {
  const entry = readLeads()[String(releaseId)];
  if (!entry || !Number.isFinite(entry.lead)) return DEFAULT_ENDING_LEAD;
  return Math.min(MAX_LEAD, Math.max(MIN_LEAD, entry.lead));
}

/**
 * Запомнить, что пользователь ушёл на следующую серию за `lead` секунд до конца.
 * Усредняем: разовый ранний скип не должен сразу ломать порог.
 */
export function learnEndingLead(releaseId: string | number, lead: number): void {
  if (!Number.isFinite(lead) || lead < MIN_LEAD || lead > MAX_LEAD) return;
  try {
    const map = readLeads();
    const k = String(releaseId);
    const prev = map[k];
    const next: LeadEntry = prev
      ? { lead: (prev.lead * prev.n + lead) / (prev.n + 1), n: Math.min(prev.n + 1, 8) }
      : { lead, n: 1 };
    map[k] = next;

    const keys = Object.keys(map);
    if (keys.length > MAX_ENTRIES) {
      keys.slice(0, keys.length - MAX_ENTRIES).forEach((key) => delete map[key]);
    }
    localStorage.setItem(ENDING_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

// ── Лента «Продолжить просмотр» ──────────────────────────────────────────────

export interface ContinueItem {
  releaseId: number;
  ep: number;
  time: number;
  duration: number;
  /** 0…1 */
  progress: number;
  at: number;
}

/** Недосмотренные серии, свежие сверху. */
export function listContinueWatching(limit = 20): ContinueItem[] {
  const map = readAll();
  const out: ContinueItem[] = [];
  for (const [k, v] of Object.entries(map)) {
    const [ridRaw, epRaw] = k.split(':');
    const releaseId = Number(ridRaw);
    const ep = Number(epRaw);
    if (!Number.isFinite(releaseId) || !Number.isFinite(ep)) continue;
    if (!v || !Number.isFinite(v.t)) continue;
    if (Date.now() - v.at > MAX_AGE_MS) continue;
    out.push({
      releaseId,
      ep,
      time: v.t,
      duration: v.d,
      progress: v.d > 0 ? Math.min(1, v.t / v.d) : 0,
      at: v.at,
    });
  }
  out.sort((a, b) => b.at - a.at);
  return out.slice(0, limit);
}
