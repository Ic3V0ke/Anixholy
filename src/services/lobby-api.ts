/**
 * API лобби совместного просмотра.
 * База берётся из services/anixback-endpoint (настройка в dev).
 */

import { getLobbyHttpBase } from './anixback-endpoint';

export interface LobbyParticipant {
  id: number | string;
  peerId?: string;
  login: string;
  avatar?: string | null;
  deviceId?: string | null;
}

export interface LobbyPlayback {
  releaseId: string;
  sourceId: string;
  ep: string;
  dubberId?: string;
  title: string;
  sourceName: string;
  paused: boolean;
  currentTime: number;
}

export interface LobbyRoom {
  roomId: string;
  code: string;
  myPeerId?: string;
  participants: LobbyParticipant[];
  playback?: LobbyPlayback | null;
}

/** Сервер лобби недоступен (таймаут/сеть), в отличие от логической ошибки вроде «неверный код». */
export class LobbyUnavailableError extends Error {
  constructor(message = 'Сервер совместного просмотра недоступен') {
    super(message);
    this.name = 'LobbyUnavailableError';
  }
}

/** Дольше ждать нет смысла: если сервер не ответил — он не ответит. */
const LOBBY_TIMEOUT_MS = 10_000;

type LobbyIpcResult = { ok: boolean; status: number; body?: string; error?: string };

function lobbyIpc(): ((p: { url: string; method: string; body?: string }) => Promise<LobbyIpcResult>) | null {
  const el = (window as unknown as { electron?: { lobbyRequest?: unknown } }).electron;
  return typeof el?.lobbyRequest === 'function'
    ? (el.lobbyRequest as (p: { url: string; method: string; body?: string }) => Promise<LobbyIpcResult>)
    : null;
}

async function fetchLobby(path: string, options: RequestInit = {}, timeoutMs = LOBBY_TIMEOUT_MS): Promise<Response> {
  const url = `${getLobbyHttpBase()}${path}`;

  // В Electron идём через main-процесс: прямой fetch из Chromium к серверу
  // лобби зависает намертво (сам сервер исправен — Node отвечает за ~250 мс).
  const ipc = lobbyIpc();
  if (ipc) {
    const res = await ipc({
      url,
      method: (options.method ?? 'GET').toUpperCase(),
      body: typeof options.body === 'string' ? options.body : undefined,
    });
    if (res.status === 0) throw new LobbyUnavailableError(res.error);
    return new Response(res.body ?? '', {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    return await fetch(url, {
      ...options,
      // Без таймаута зависший сервер вешает UI навсегда: await никогда не
      // завершается, finally не срабатывает, кнопка остаётся в загрузке.
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    });
  } catch (err) {
    // AbortError (таймаут) и TypeError (сеть/DNS/отказ) — сервер недоступен.
    throw new LobbyUnavailableError(
      err instanceof Error && err.name === 'TimeoutError'
        ? 'Сервер совместного просмотра не отвечает'
        : 'Не удалось связаться с сервером совместного просмотра',
    );
  }
}

type LobbyProfilePayload = {
  profileId?: number;
  login?: string;
  avatar?: string | null;
  deviceId?: string | null;
};

/** Создать комнату. Возвращает roomId, code и myPeerId (для WebRTC). */
export async function createRoom(profile: LobbyProfilePayload): Promise<{ roomId: string; code: string; myPeerId?: string }> {
  const res = await fetchLobby('/create', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error(`Lobby create: ${res.status}`);
  const data = (await res.json()) as { roomId?: string; code?: string; myPeerId?: string };
  return { roomId: String(data.roomId ?? ''), code: String(data.code ?? ''), myPeerId: data.myPeerId != null ? String(data.myPeerId) : undefined };
}

/** Присоединиться по коду. */
export async function joinRoom(code: string, profile: LobbyProfilePayload): Promise<LobbyRoom> {
  const res = await fetchLobby('/join', {
    method: 'POST',
    body: JSON.stringify({ code: code.trim(), ...profile }),
  });
  if (!res.ok) throw new Error(`Lobby join: ${res.status}`);
  const data = (await res.json()) as LobbyRoom;
  return data;
}

/** Получить состояние комнаты (участники + воспроизведение). */
export async function getRoom(roomId: string): Promise<LobbyRoom> {
  const res = await fetchLobby(`/room/${encodeURIComponent(roomId)}`);
  if (!res.ok) throw new Error(`Lobby get room: ${res.status}`);
  const data = (await res.json()) as LobbyRoom;
  return data;
}

/** Обновить состояние воспроизведения в комнате (резерв при отсутствии WebRTC). */
export async function updatePlayback(roomId: string, playback: LobbyPlayback): Promise<void> {
  const res = await fetchLobby(`/room/${encodeURIComponent(roomId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ playback }),
  });
  if (!res.ok) throw new Error(`Lobby update playback: ${res.status}`);
}

/** Сигналинг WebRTC: отправить SDP/ICE другому пиру (POST .../room/:id/signal). */
export async function postSignal(
  roomId: string,
  fromPeerId: string,
  toPeerId: string,
  type: 'offer' | 'answer' | 'ice',
  payload: string | object
): Promise<void> {
  const res = await fetchLobby(`/room/${encodeURIComponent(roomId)}/signal`, {
    method: 'POST',
    body: JSON.stringify({ fromPeerId, toPeerId, type, payload: typeof payload === 'string' ? payload : JSON.stringify(payload) }),
  });
  if (!res.ok) throw new Error(`Lobby signal: ${res.status}`);
}

/** Сигналинг WebRTC: получить входящие сигналы для пира (сервер отдаёт и удаляет). */
export async function getSignals(roomId: string, peerId: string): Promise<Array<{ fromPeerId: string; type: 'offer' | 'answer' | 'ice'; payload: string }>> {
  const res = await fetchLobby(`/room/${encodeURIComponent(roomId)}/signals?peerId=${encodeURIComponent(peerId)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { signals?: Array<{ fromPeerId: string; type: string; payload: string }> };
  const list = data?.signals ?? [];
  return list.map((s) => ({ fromPeerId: s.fromPeerId, type: s.type as 'offer' | 'answer' | 'ice', payload: s.payload ?? '' }));
}

/** Покинуть комнату по deviceId (очистка участника на сервере). */
export async function leaveRoom(roomId: string, deviceId: string): Promise<void> {
  if (!roomId || !deviceId) return;
  await fetchLobby(`/room/${encodeURIComponent(roomId)}/leave`, {
    method: 'POST',
    body: JSON.stringify({ deviceId }),
  }).catch(() => undefined);
}
