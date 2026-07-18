import { fmtTime } from './_utils';
import type { PlayerLoadState } from './_types';

export class PlayerState {
  loadState      = $state<PlayerLoadState>('loading');
  errorText      = $state('');
  paused         = $state(true);
  muted          = $state(false);
  isFullscreen   = $state(false);
  currentTime    = $state(0);
  duration       = $state(0);
  bufferedEnd    = $state(0);
  volume         = $state(100);
  useVideo       = $state(false);
  playUrl        = $state('');
  upscaleEnabled = $state(false);
  upscaleMode    = $state(15);
  /** Оверлей отладки (настройки → воспроизведение) */
  debugOverlay   = $state(false);
  overlayVisible = $state(false);

  // ── Audio ────────────────────────────────────────────────────────────────
  /** Разрешает громкость выше 100% (WebAudio GainNode). */
  boost     = $state(false);
  /** Ночной режим: компрессор — шёпот слышно, взрывы не бьют по ушам. */
  nightMode = $state(false);

  // ── Автопереход ──────────────────────────────────────────────────────────
  /** Предлагать следующую серию, не досматривая эндинг. */
  autoNext        = $state(true);
  /** Выключить автопереход после текущей серии (таймер сна). */
  sleepAfterEp    = $state(false);
  /** Секунд до автоперехода; null — оверлей скрыт. */
  nextCountdown   = $state<number | null>(null);

  // ── Playback settings ───────────────────────────────────────────────────
  playbackRate       = $state(1);
  /** 'auto' | '16/9' | '4/3' | '21/9' */
  aspectRatio        = $state('auto');
  /** Quality label → direct URL (e.g. { "720": "https://...720.m3u8" }) */
  availableQualities = $state<Record<string, string>>({});
  /** Currently selected quality label (e.g. "720") */
  currentQuality     = $state('');

  currentTimeDisplay = $derived(fmtTime(this.currentTime));
  totalTimeDisplay   = $derived(fmtTime(this.duration));
  timeDisplay        = $derived(`${fmtTime(this.currentTime)} / ${fmtTime(this.duration)}`);
  progressPct        = $derived(this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0);
  bufferedPct        = $derived(this.duration > 0 ? (this.bufferedEnd  / this.duration) * 100 : 0);
}
