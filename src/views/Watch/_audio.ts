/**
 * Аудиотракт плеера: буст громкости выше 100% и «ночной режим».
 *
 * Почему WebAudio, а не video.volume: у <video> громкость ограничена 1.0,
 * а аниме часто сведено тихо. GainNode позволяет усилить до 2.0, а
 * DynamicsCompressorNode — подтянуть шёпот и придавить взрывы.
 *
 * Важно: createMediaElementSource() необратим и на cross-origin источнике без
 * CORS даёт тишину. Поэтому граф создаётся ЛЕНИВО — только когда пользователь
 * включил буст или ночной режим. Обычная громкость 0–100% идёт мимо WebAudio
 * через video.volume и не может ничего сломать.
 */

export interface AudioChainState {
  /** 0…200 (%) */
  volume: number;
  muted: boolean;
  boost: boolean;
  night: boolean;
}

type Ctx = AudioContext & { resume: () => Promise<void> };

export class PlayerAudioChain {
  private ctx: Ctx | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private el: HTMLVideoElement | null = null;
  private graphFailed = false;

  private volume = 100;
  private muted = false;
  private night = false;

  /** Есть ли смысл в графе: буст выше 100% либо ночной режим. */
  private get needsGraph(): boolean {
    return this.volume > 100 || this.night;
  }

  attach(el: HTMLVideoElement): void {
    if (this.el === el) return;
    this.el = el;
    this.apply();
  }

  /** Создаёт граф один раз. Возвращает false, если WebAudio недоступен. */
  private ensureGraph(): boolean {
    if (this.ctx && this.gain) return true;
    if (this.graphFailed || !this.el) return false;

    const AC: typeof AudioContext | undefined =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) {
      this.graphFailed = true;
      return false;
    }

    try {
      const ctx = new AC() as Ctx;
      const source = ctx.createMediaElementSource(this.el);
      const compressor = ctx.createDynamicsCompressor();
      const gain = ctx.createGain();

      // Ночной режим: сильная компрессия — диалоги слышно, взрывы не рвут уши.
      compressor.threshold.value = -32;
      compressor.knee.value = 26;
      compressor.ratio.value = 10;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.22;

      gain.connect(ctx.destination);

      this.ctx = ctx;
      this.source = source;
      this.compressor = compressor;
      this.gain = gain;

      // С этого момента громкостью рулит gain, а не элемент.
      this.el.volume = 1;
      this.rewire();
      return true;
    } catch {
      this.graphFailed = true;
      return false;
    }
  }

  /** Переключает компрессор в разрыв / из разрыва без пересоздания графа. */
  private rewire(): void {
    const { source, compressor, gain } = this;
    if (!source || !compressor || !gain) return;
    try { source.disconnect(); } catch { /* ignore */ }
    try { compressor.disconnect(); } catch { /* ignore */ }

    if (this.night) {
      source.connect(compressor);
      compressor.connect(gain);
    } else {
      source.connect(gain);
    }
  }

  private apply(): void {
    const el = this.el;
    if (!el) return;

    if (!this.needsGraph && !this.ctx) {
      // Граф ещё не нужен — обычный путь, ничего не ломаем.
      el.muted = this.muted;
      el.volume = Math.max(0, Math.min(1, this.volume / 100));
      return;
    }

    if (!this.ensureGraph()) {
      // WebAudio не поднялся — деградируем до обычной громкости.
      el.muted = this.muted;
      el.volume = Math.max(0, Math.min(1, this.volume / 100));
      return;
    }

    void this.ctx?.resume().catch(() => {});
    el.muted = this.muted;
    el.volume = 1;
    if (this.gain) {
      const target = this.muted ? 0 : Math.max(0, Math.min(2, this.volume / 100));
      this.gain.gain.value = target;
    }
  }

  setVolume(percent: number): void {
    this.volume = Math.max(0, Math.min(200, percent));
    this.apply();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.apply();
  }

  setNight(on: boolean): void {
    if (this.night === on) return;
    this.night = on;
    if (this.ctx) {
      this.rewire();
      this.apply();
    } else {
      this.apply();
    }
  }

  /** Доступен ли реально буст (граф поднялся). */
  get boostAvailable(): boolean {
    return !this.graphFailed;
  }

  destroy(): void {
    try { this.source?.disconnect(); } catch { /* ignore */ }
    try { this.compressor?.disconnect(); } catch { /* ignore */ }
    try { this.gain?.disconnect(); } catch { /* ignore */ }
    try { void this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
    this.source = null;
    this.gain = null;
    this.compressor = null;
    this.el = null;
  }
}
