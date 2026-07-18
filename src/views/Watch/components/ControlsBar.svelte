<script lang="ts">
  import { onDestroy } from 'svelte';
  import Hls from 'hls.js';
  import { isHlsUrl } from '../_utils';

  interface Props {
    currentTime: string;
    totalTime:   string;
    progressPct: number;
    bufferedPct: number;
    /** Секунды всего — для перевода позиции курсора во время. */
    duration:    number;
    /** URL текущего потока — для отдельного превью-видео. */
    playUrl:     string;
    useVideo:    boolean;
    onseek:      (e: MouseEvent) => void;
  }
  let { currentTime, totalTime, progressPct, bufferedPct, duration, playUrl, useVideo, onseek }: Props = $props();

  let wrapEl = $state<HTMLDivElement | null>(null);
  let canvasEl = $state<HTMLCanvasElement | null>(null);

  let hoverActive = $state(false);
  let hoverLeftPct = $state(0);
  let hoverLabel = $state('0:00');
  let thumbReady = $state(false);

  // Отдельный декодер для превью: главное видео трогать нельзя (собьём просмотр).
  let previewVideo: HTMLVideoElement | null = null;
  let previewHls: Hls | null = null;
  let previewUrl = '';
  let metaReady = false;
  let seekTimer: ReturnType<typeof setTimeout> | null = null;
  let lastDrawnTime = -999;

  const THUMB_W = 168;
  const THUMB_H = 94;

  function fmt(sec: number): string {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    return `${h > 0 ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`;
  }

  function teardownPreview() {
    if (seekTimer) { clearTimeout(seekTimer); seekTimer = null; }
    if (previewHls) { try { previewHls.destroy(); } catch {} previewHls = null; }
    if (previewVideo) {
      try { previewVideo.removeAttribute('src'); previewVideo.load(); } catch {}
      previewVideo = null;
    }
    metaReady = false;
    lastDrawnTime = -999;
    previewUrl = '';
  }

  /** Лениво поднимаем превью-декодер при первом наведении. */
  function ensurePreview() {
    if (!useVideo || !playUrl) return;
    if (previewVideo && previewUrl === playUrl) return;
    teardownPreview();
    previewUrl = playUrl;

    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.playsInline = true;
    v.addEventListener('loadeddata', () => { metaReady = true; });
    v.addEventListener('seeked', () => {
      if (!canvasEl) return;
      const ctx = canvasEl.getContext('2d');
      if (!ctx || v.videoWidth === 0) return;
      ctx.drawImage(v, 0, 0, THUMB_W, THUMB_H);
      thumbReady = true;
    });

    if (isHlsUrl(playUrl) && Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 6, capLevelToPlayerSize: true });
      hls.loadSource(playUrl);
      hls.attachMedia(v);
      previewHls = hls;
    } else {
      v.src = playUrl;
    }
    previewVideo = v;
  }

  function onMove(e: MouseEvent) {
    const el = wrapEl;
    if (!el || !useVideo || !duration || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * duration;
    hoverLeftPct = pct * 100;
    hoverLabel = fmt(t);
    hoverActive = true;

    ensurePreview();
    // Троттлим перемотку превью: пока курсор ёрзает — не дёргаем декодер.
    if (seekTimer) clearTimeout(seekTimer);
    seekTimer = setTimeout(() => {
      if (!previewVideo || !metaReady) return;
      if (Math.abs(t - lastDrawnTime) < 0.8) return;
      lastDrawnTime = t;
      try { previewVideo.currentTime = Math.min(t, (previewVideo.duration || duration) - 0.1); } catch {}
    }, 90);
  }

  function onLeave() {
    hoverActive = false;
  }

  // Сброс превью при смене серии/качества.
  $effect(() => {
    playUrl;
    thumbReady = false;
    lastDrawnTime = -999;
    if (previewVideo && previewUrl !== playUrl) teardownPreview();
  });

  onDestroy(teardownPreview);
</script>

<div class="watch-page__timeline-row">

  <!-- Times above the bar -->
  <div class="watch-page__times">
    <span class="watch-page__time-label">{currentTime}</span>
    <span class="watch-page__time-label">{totalTime}</span>
  </div>

  <!-- Progress bar -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    bind:this={wrapEl}
    class="watch-page__progress-wrap"
    onclick={onseek}
    onmousemove={onMove}
    onmouseleave={onLeave}
    role="slider"
    aria-valuenow={progressPct}
    tabindex="0"
  >
    <!-- Превью кадра -->
    {#if useVideo}
      <div
        class="watch-preview"
        class:watch-preview--visible={hoverActive}
        style="left:{hoverLeftPct}%"
      >
        <div class="watch-preview__frame">
          <canvas bind:this={canvasEl} width={THUMB_W} height={THUMB_H} class="watch-preview__canvas" class:watch-preview__canvas--ready={thumbReady}></canvas>
          {#if !thumbReady}<span class="watch-preview__wait">···</span>{/if}
        </div>
        <span class="watch-preview__time">{hoverLabel}</span>
      </div>
    {/if}

    <div
      class="watch-page__timeline"
      style="--progress-position:{progressPct}%; --loaded-position:{bufferedPct}%"
    >
      <div class="watch-page__timeline-loaded" style="width:{bufferedPct}%"></div>
      <div class="watch-page__progress-bar"    style="width:{progressPct}%"></div>
      <div class="watch-page__timeline-dot"></div>
    </div>
  </div>

</div>
