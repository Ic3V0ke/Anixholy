/**
 * Открыть плеер ВНУТРИ главного окна (маршрут /watch).
 *
 * Single-window архитектура: отдельное Electron-окно плеера больше не создаётся.
 * Если плеер уже открыт — контент меняется на лету через событие
 * `player:changeContent`, которое страница Watch уже умеет обрабатывать
 * (раньше оно приходило по IPC из главного окна).
 */
import { navigate } from '../stores/navigation';
import { isPlayerWindowOpen } from '../stores/modals';

export interface WatchLaunchParams {
  releaseId: string | number;
  sourceId: string | number;
  ep: string | number;
  title: string;
  sourceName: string;
  dubberId?: string | number;
}

export function canOpenInAppPlayer(): boolean {
  return typeof window !== 'undefined' && !!window.anixApi;
}

function isOnWatchRoute(): boolean {
  try {
    const hash = window.location.hash || '';
    if (hash.startsWith('#/watch')) return true;
    return window.location.pathname === '/watch' || window.location.pathname.endsWith('/watch');
  } catch {
    return false;
  }
}

/** Обновляет query-параметры /watch без перезагрузки страницы плеера. */
function replaceWatchUrl(qs: string): void {
  try {
    if (window.location.protocol === 'file:') {
      const newHash = `#/watch?${qs}`;
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, '', window.location.pathname + newHash);
      }
    } else {
      window.history.replaceState(null, '', `/watch?${qs}`);
    }
  } catch {
    /* ignore */
  }
}

export function openInAppPlayer(params: WatchLaunchParams): Promise<void> {
  const payload = {
    releaseId: String(params.releaseId),
    sourceId: String(params.sourceId),
    ep: String(params.ep),
    title: params.title,
    sourceName: params.sourceName,
    ...(params.dubberId != null && params.dubberId !== '' ? { dubberId: String(params.dubberId) } : {}),
  };

  const qs = new URLSearchParams(payload).toString();

  if (isOnWatchRoute()) {
    // Уже в плеере — переключаем серию/релиз без пересоздания страницы.
    replaceWatchUrl(qs);
    window.dispatchEvent(new CustomEvent('player:changeContent', { detail: { ...payload, local: true } }));
  } else {
    navigate(`/watch?${qs}`);
  }

  isPlayerWindowOpen.set(true);
  return Promise.resolve();
}

export function isEmbeddedWebPlayer(): boolean {
  return typeof window !== 'undefined' && !window.electron && isOnWatchRoute();
}
