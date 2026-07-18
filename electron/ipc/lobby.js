'use strict';

/**
 * HTTP-запросы лобби через main-процесс.
 *
 * Зачем не напрямую из рендерера: fetch из Chromium к серверу лобби зависает
 * намертво (сервер при этом исправен — Node/curl получают ответ за ~250 мс,
 * OPTIONS-preflight тоже отвечает 204). Из-за отсутствия таймаута это вешало
 * создание комнаты в «вечную загрузку». В main-процессе используется Node-fetch,
 * который работает стабильно, и заодно снимается вопрос CORS.
 */

const { ipcMain } = require('electron');

/** Куда разрешено ходить — чтобы канал не превратился в открытый прокси. */
const ALLOWED_HOSTS = new Set(['anix.maks1mio.su', 'localhost', '127.0.0.1']);

const TIMEOUT_MS = 12_000;

function isAllowed(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

function register() {
  ipcMain.handle('lobby:request', async (_, payload) => {
    const url = String(payload?.url ?? '');
    if (!isAllowed(url)) {
      return { ok: false, status: 0, error: 'Недопустимый адрес лобби' };
    }

    const method = String(payload?.method ?? 'GET').toUpperCase();
    const body = payload?.body != null ? String(payload.body) : undefined;

    try {
      const res = await fetch(url, {
        method,
        body,
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, body: text };
    } catch (err) {
      const timedOut = err && err.name === 'TimeoutError';
      return {
        ok: false,
        status: 0,
        error: timedOut ? 'Сервер совместного просмотра не отвечает' : 'Не удалось связаться с сервером совместного просмотра',
      };
    }
  });
}

module.exports = { register };
