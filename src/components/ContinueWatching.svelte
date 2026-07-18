<script lang="ts">
  import { onMount } from 'svelte';
  import { listContinueWatching, clearWatchProgress, type ContinueItem } from '../utils/watch-progress';
  import { buildPosterUrl, toCdnProxyUrl } from '../utils/posterUrl';
  import { openInAppPlayer } from '../utils/watch-nav';
  import { navigate } from '../stores/navigation';
  import { iconPlay } from './icons';

  interface Card extends ContinueItem {
    title: string;
    poster: string;
    sourceId: string;
    dubberId: string;
    sourceName: string;
  }

  let cards = $state<Card[]>([]);
  let ready = $state(false);

  function fmt(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /** Догружаем название/постер по id — сам прогресс хранится локально. */
  async function hydrate(item: ContinueItem): Promise<Card | null> {
    const api = window.anixApi?.release;
    if (!api?.info) return null;
    try {
      const data = await api.info(item.releaseId, true) as any;
      const r = data?.release;
      if (!r) return null;

      // Источник для продолжения: первый доступный у релиза.
      let sourceId = '';
      let dubberId = '';
      let sourceName = '';
      try {
        const dubs = await api.getDubbers?.(item.releaseId);
        const dub = (dubs?.types ?? [])[0];
        if (dub) {
          dubberId = String(dub.id);
          const srcRes = await api.getDubberSources?.(item.releaseId, dub.id);
          const src = srcRes?.sources?.[0];
          if (src) { sourceId = String(src.id); sourceName = String(src.name ?? ''); }
        }
      } catch { /* ignore */ }

      const posterRaw =
        typeof r.poster === 'string' ? r.poster
        : r.poster?.medium?.url ?? r.poster?.original?.url ?? r.poster?.small?.url;

      return {
        ...item,
        title: String(r.title_ru || r.title_original || 'Без названия'),
        poster: toCdnProxyUrl(buildPosterUrl(posterRaw)),
        sourceId,
        dubberId,
        sourceName,
      };
    } catch {
      return null;
    }
  }

  function resume(card: Card) {
    if (!card.sourceId) {
      navigate(`/release/${card.releaseId}`);
      return;
    }
    void openInAppPlayer({
      releaseId: card.releaseId,
      sourceId: card.sourceId,
      ep: card.ep,
      title: card.title,
      sourceName: card.sourceName,
      dubberId: card.dubberId || undefined,
    });
  }

  function forget(card: Card, e: MouseEvent) {
    e.stopPropagation();
    clearWatchProgress(card.releaseId, card.ep);
    cards = cards.filter((c) => !(c.releaseId === card.releaseId && c.ep === card.ep));
  }

  onMount(async () => {
    const items = listContinueWatching(12);
    if (items.length === 0) { ready = true; return; }
    const loaded = await Promise.all(items.map(hydrate));
    cards = loaded.filter((c): c is Card => c != null);
    ready = true;
  });
</script>

{#if ready && cards.length > 0}
  <section class="cw">
    <header class="cw__head">
      <h2 class="cw__title">Продолжить просмотр</h2>
      <div class="cw__rule" aria-hidden="true"></div>
    </header>

    <div class="cw__row">
      {#each cards as card (card.releaseId + ':' + card.ep)}
        <button type="button" class="cw__card" onclick={() => resume(card)}>
          <span class="cw__tape" aria-hidden="true"></span>

          <span class="cw__poster">
            {#if card.poster}
              <img src={card.poster} alt="" loading="lazy" decoding="async" />
            {/if}
            <span class="cw__play" aria-hidden="true">{@html iconPlay(18)}</span>
            <span class="cw__bar" aria-hidden="true">
              <span class="cw__bar-fill" style:width={`${Math.round(card.progress * 100)}%`}></span>
            </span>
          </span>

          <span class="cw__body">
            <span class="cw__name">{card.title}</span>
            <span class="cw__meta">
              Серия {card.ep} · {fmt(card.time)}{#if card.duration > 0} / {fmt(card.duration)}{/if}
            </span>
          </span>

          <span
            class="cw__forget"
            role="button"
            tabindex="-1"
            title="Убрать"
            onclick={(e) => forget(card, e)}
            onkeydown={(e) => { if (e.key === 'Enter') forget(card, e as unknown as MouseEvent); }}
          >✕</span>
        </button>
      {/each}
    </div>
  </section>
{/if}
