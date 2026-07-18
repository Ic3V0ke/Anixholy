<script lang="ts">
  import Select from '../../../components/Select.svelte';
  import type { SelectOption } from '../../../components/select';
  import TitleInfoTrigger from '../../../components/TitleInfoTrigger.svelte';
  import type { ReleaseMetaInfoRow } from '../_metaInfo';
  import { openReleaseMetaSearch } from '../../../utils/releaseMetaSearch';
  import type { ListStatusId } from '../_types';
  import { openImageLightbox, formatVoteCount } from '../_utils';
  import { toCdnProxyUrl } from '../../../utils/posterUrl';

  interface Props {
    posterUrl:       string;
    backdropUrl:     string;
    title:           string;
    titleRu:         string;
    titleOriginal:   string;
    titleAlt:        string;
    ageRateText:     string;
    ageIsRestricted: boolean;
    grade:           number | null;
    voteCount:       number;
    hasRating:       boolean;
    ratingBg:        string;
    ratingTextColor: string;
    isFavorite:      boolean;
    favoritesCount:  number;
    isViewBlocked:   boolean;
    noteHtml:        string;
    descHtml:        string;
    descClean:       string;
    descNeedsTruncate: boolean;
    descCollapsed:   boolean;
    metaInfoRows:    ReleaseMetaInfoRow[];
    playBtnText:     string;
    playBtnDisabled: boolean;
    episodeAddedText: string | null;
    currentStatus:   ListStatusId | null;
    selectOptions:   SelectOption[];
    onToggleFavorite: () => void;
    onWatch:          () => void;
    onSetStatus:      (v: string) => void;
    onToggleDesc:     () => void;
  }

  let {
    posterUrl, backdropUrl, title, titleRu, titleOriginal, titleAlt, ageRateText,
    grade, voteCount, hasRating,
    isFavorite, favoritesCount,
    isViewBlocked,
    noteHtml, descHtml, descClean, descNeedsTruncate, descCollapsed,
    metaInfoRows, playBtnText, playBtnDisabled, episodeAddedText,
    currentStatus, selectOptions,
    onToggleFavorite, onWatch, onSetStatus, onToggleDesc,
  }: Props = $props();

  const displayPosterUrl = $derived(toCdnProxyUrl(posterUrl));
  const displayBackdropUrl = $derived(toCdnProxyUrl(backdropUrl || posterUrl));

  const favLabel = $derived(favoritesCount > 0 ? formatVoteCount(favoritesCount) : '0');

  // ── Раскладка меты по ролям макета ─────────────────────────────────────────
  const genreRow   = $derived(metaInfoRows.find((r) => r.kind === 'genres') ?? null);
  const countryRow = $derived(metaInfoRows.find((r) => r.kind === 'country') ?? null);
  const catRow     = $derived(metaInfoRows.find((r) => r.kind === 'category') ?? null);

  /** Плашки «ВЫХОДИТ» + «СЕРИАЛ · ЯПОНИЯ · ОСЕНЬ 2026». */
  const statusChip = $derived.by(() => {
    const cat = catRow?.segments.map((s) => s.text).join('') ?? '';
    const parts = cat.split(',').map((s) => s.trim()).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? '');
  });

  const factsChip = $derived.by(() => {
    const cat = catRow?.segments.map((s) => s.text).join('') ?? '';
    const catParts = cat.split(',').map((s) => s.trim()).filter(Boolean);
    const kind = catParts.length > 1 ? catParts[0] : '';
    const geo = countryRow?.segments.map((s) => s.text).join('') ?? '';
    return [kind, geo].filter(Boolean).join(' · ');
  });

  /** Мета-таблица: подпись + значение (серии/студия/режиссёр/первоисточник). */
  const metaCells = $derived.by(() => {
    const cells: { label: string; row: ReleaseMetaInfoRow }[] = [];
    for (const row of metaInfoRows) {
      if (row.kind === 'episodes') cells.push({ label: 'Серии', row });
      else if (row.kind === 'credits') cells.push({ label: 'Создатели', row });
      else if (row.kind === 'source') cells.push({ label: 'Первоисточник', row });
    }
    return cells;
  });

  /** Бегущая строка — реальные факты релиза через типографские разделители. */
  const marqueeText = $derived.by(() => {
    const bits: string[] = [];
    if (episodeAddedText) bits.push(episodeAddedText.replace(/^Добавлено:\s*/i, 'Добавлено: '));
    for (const row of metaInfoRows) {
      if (row.kind === 'genres') continue;
      const t = row.segments.map((s) => s.text).join('').trim();
      if (t) bits.push(t);
    }
    if (hasRating && grade != null && grade > 0) bits.push(`Рейтинг ${grade.toFixed(1)}`);
    if (favoritesCount > 0) bits.push(`${formatVoteCount(favoritesCount)} в избранном`);
    const line = bits.join('  ✶  ');
    return line || title;
  });

  const gradeText = $derived(grade != null && grade > 0 ? grade.toFixed(1).replace('.', ',') : '—');
  const starCount = $derived(grade != null && grade > 0 ? Math.round(grade) : 0);

  /** Заголовок: хвостовой номер сезона красим в акцент, как в макете. */
  const titleParts = $derived.by(() => {
    const full = titleRu || title;
    const m = full.match(/^(.*?)(\s+)(\d+)$/);
    if (m) return { head: m[1], tail: m[3] };
    return { head: full, tail: '' };
  });

  /** Русские названия бывают втрое длиннее макетных — кегль подгоняем под длину. */
  const titleSize = $derived.by(() => {
    const len = (titleRu || title).trim().length;
    if (len > 52) return 'xs';
    if (len > 30) return 'sm';
    return 'lg';
  });

  function scrollToComments() {
    document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<!-- ── Бегущая строка ──────────────────────────────────────────────────────── -->
<div class="zh-ticker" aria-hidden="true">
  <div class="zh-ticker__track">
    <span class="zh-ticker__text">{marqueeText}  ✂  </span>
    <span class="zh-ticker__text">{marqueeText}  ✂  </span>
  </div>
</div>

<section class="zh">
  {#if displayBackdropUrl}
    <div class="zh__backdrop" aria-hidden="true">
      <img src={displayBackdropUrl} alt="" decoding="async" />
    </div>
  {/if}

  <div class="zh__grid">
    <!-- ── Постер ──────────────────────────────────────────────────────────── -->
    <div class="zh__poster-col">
      <div class="zh__poster-wrap">
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="zh__poster{posterUrl ? ' zh__poster--clickable' : ''}"
          role={posterUrl ? 'button' : undefined}
          tabindex={posterUrl ? 0 : undefined}
          onclick={() => posterUrl && openImageLightbox(posterUrl)}
          onkeydown={(e) => e.key === 'Enter' && posterUrl && openImageLightbox(posterUrl)}
        >
          <div class="zh__poster-frame">
            {#if displayPosterUrl}
              <img src={displayPosterUrl} alt={title} />
            {:else}
              <span class="zh__poster-empty">ПОСТЕР · 2:3</span>
            {/if}
          </div>
          <span class="zh__tape zh__tape--top" aria-hidden="true"></span>
          <span class="zh__tape zh__tape--side" aria-hidden="true"></span>
        </div>

        <div class="zh__stamp" aria-label="Возрастной рейтинг">
          <span class="zh__stamp-value">{ageRateText}</span>
          <span class="zh__stamp-label">Рейтинг</span>
        </div>
      </div>
    </div>

    <!-- ── Шапка: тянется на всю ширину справа от постера ─────────────────── -->
    <div class="zh__head">
      <div class="zh__chips">
        {#if statusChip}
          <span class="zh__chip zh__chip--accent">{statusChip}</span>
        {/if}
        {#if factsChip}
          <span class="zh__chip zh__chip--outline">{factsChip}</span>
        {/if}
      </div>

      <div class="zh__title-row">
        <TitleInfoTrigger
          titleRu={titleRu || title}
          titleEn={titleOriginal}
          {titleAlt}
          className="zh__title-info"
        />
        <h1 class="zh__title zh__title--{titleSize}">
          {titleParts.head}{#if titleParts.tail}<span class="zh__title-num">{titleParts.tail}</span>{/if}
        </h1>
      </div>

      {#if titleOriginal && titleOriginal !== titleRu}
        <div class="zh__subtitle">{titleOriginal}</div>
      {/if}
    </div>

    <!-- ── Основная колонка ────────────────────────────────────────────────── -->
    <div class="zh__main">
      {#if genreRow}
        <div class="zh__tags">
          {#each genreRow.segments as segment, index (index)}
            {#if segment.query != null && segment.searchBy != null}
              <button
                type="button"
                class="zh__tag"
                onclick={() => openReleaseMetaSearch(segment.query!, segment.searchBy!)}
              >#{segment.text.trim()}</button>
            {/if}
          {/each}
        </div>
      {/if}

      {#if metaCells.length > 0}
        <div class="zh__meta">
          {#each metaCells as cell}
            <div class="zh__meta-cell">
              <div class="zh__meta-label">{cell.label}</div>
              <div class="zh__meta-value">
                {#each cell.row.segments as segment, index (index)}
                  {#if segment.query != null && segment.searchBy != null}
                    <button
                      type="button"
                      class="zh__meta-link"
                      onclick={() => openReleaseMetaSearch(segment.query!, segment.searchBy!)}
                    >{segment.text}</button>
                  {:else}{segment.text}{/if}
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if isViewBlocked}
        <div class="zh__note zh__note--geo" role="note">
          <strong>Недоступно в РФ.</strong>
          Этот тайтл официально заблокирован для просмотра в России. Вы можете попробовать
          воспроизвести на свой страх и риск — видео может не открыться.
        </div>
      {:else if noteHtml}
        <div class="zh__note">{@html noteHtml}</div>
      {/if}

      {#if descClean}
        <div class="zh__desc-wrap">
          <div class="zh__desc{descCollapsed && descNeedsTruncate ? ' zh__desc--collapsed' : ''}">
            {@html descHtml}
          </div>
          {#if descNeedsTruncate}
            <button type="button" class="zh__desc-toggle" onclick={onToggleDesc}>
              {descCollapsed ? 'читать дальше →' : 'свернуть ↑'}
            </button>
          {/if}
        </div>
      {/if}

      <!-- ── Действия ──────────────────────────────────────────────────────── -->
      <div class="zh__actions">
        <button
          type="button"
          class="zh__play{playBtnDisabled ? ' zh__play--disabled' : ''}"
          disabled={playBtnDisabled}
          onclick={onWatch}
        >
          {#if !playBtnDisabled}
            <span class="zh__play-tri" aria-hidden="true"></span>
          {/if}
          {playBtnText}
        </button>

        <div class="zh__status">
          <Select
            options={selectOptions}
            value={currentStatus ?? ''}
            placeholder="＋ В список"
            onChange={onSetStatus}
          />
        </div>

        <button
          type="button"
          class="zh__fav{isFavorite ? ' zh__fav--on' : ''}"
          title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
          onclick={onToggleFavorite}
        >⚑ {favLabel}</button>

        <button type="button" class="zh__comments-link" onclick={scrollToComments}>
          Комментарии ↓
        </button>
      </div>
    </div>

    <!-- ── Правая колонка: оценка + «НОВОЕ» ────────────────────────────────── -->
    <div class="zh__aside">
      {#if hasRating}
        <div class="zh__score">
          <span class="zh__score-tape" aria-hidden="true"></span>
          <div class="zh__score-value">{gradeText}</div>
          <div class="zh__score-stars" aria-hidden="true">
            {#each [1, 2, 3, 4, 5] as s}
              <span class="zh__score-star{s <= starCount ? ' zh__score-star--on' : ''}">★</span>
            {/each}
          </div>
          <div class="zh__score-votes">{formatVoteCount(voteCount)} оценок</div>
        </div>
      {/if}

      {#if episodeAddedText && !playBtnDisabled}
        <div class="zh__new">
          <span class="zh__new-label">НОВОЕ:</span> {episodeAddedText.replace(/^Добавлено:\s*/i, '')}
        </div>
      {/if}
    </div>
  </div>
</section>
