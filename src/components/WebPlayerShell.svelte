<script lang="ts">
  import { onMount } from 'svelte';
  import Watch from '../views/Watch.svelte';
  import { navigate } from '../stores/navigation';

  const isElectron = typeof window !== 'undefined' && !!window.electron;

  let isFullscreen = $state(false);

  function goBack() {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search.slice(1));
    const releaseId = params.get('releaseId');
    if (releaseId) {
      navigate(`/release/${releaseId}`);
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate('/');
  }

  onMount(() => {
    const onFullscreen = ((e: CustomEvent<boolean>) => {
      isFullscreen = e.detail === true;
      document.body.classList.toggle('player-fullscreen', isFullscreen);
    }) as EventListener;

    window.addEventListener('player-fullscreen', onFullscreen);
    return () => {
      window.removeEventListener('player-fullscreen', onFullscreen);
      document.body.classList.remove('player-fullscreen');
    };
  });
</script>

<div class="web-player-shell" class:web-player-shell--fullscreen={isFullscreen}>
  <header class="web-player-shell__bar">
    <button type="button" class="web-player-shell__back" onclick={goBack} aria-label="Назад">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
      </svg>
      <span>Назад</span>
    </button>

    <div class="web-player-shell__drag" aria-hidden="true">
      <img src="logo/512x512.png" alt="" class="web-player-shell__logo" />
      <span class="web-player-shell__app">AnixApp</span>
    </div>

    {#if isElectron}
      <div class="web-player-shell__win">
        <button
          type="button"
          class="web-player-shell__win-btn"
          aria-label="Свернуть"
          onclick={() => window.electron?.window.minimize()}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="5.5" width="10" height="1.2" fill="currentColor"/></svg>
        </button>
        <button
          type="button"
          class="web-player-shell__win-btn"
          aria-label="Развернуть"
          onclick={() => window.electron?.window.maximize()}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.6" y="1.6" width="8.8" height="8.8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
        <button
          type="button"
          class="web-player-shell__win-btn web-player-shell__win-btn--close"
          aria-label="Закрыть"
          onclick={() => window.electron?.window.close()}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        </button>
      </div>
    {/if}
  </header>

  <div class="web-player-shell__content">
    <Watch />
  </div>
</div>

<style lang="scss">
  .web-player-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #000;
    color: #fff;
    overflow: hidden;
  }

  .web-player-shell__bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    height: 44px;
    padding: 0 0 0 0.65rem;
    background: rgba(10, 10, 14, 0.88);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    z-index: 40;
    transition: margin-top 0.3s ease, opacity 0.3s ease;
  }

  .web-player-shell--fullscreen .web-player-shell__bar {
    margin-top: -44px;
    opacity: 0;
    pointer-events: none;
  }

  .web-player-shell__back {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    border: none;
    background: rgba(255, 255, 255, 0.05);
    color: inherit;
    font: inherit;
    font-size: 0.86rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.34rem 0.72rem 0.34rem 0.55rem;
    border-radius: 10px;
    transition: background 0.18s ease, transform 0.18s ease;
    -webkit-app-region: no-drag;

    &:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    &:active {
      transform: scale(0.96);
    }
  }

  .web-player-shell__drag {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    align-self: stretch;
    -webkit-app-region: drag;
    user-select: none;
    opacity: 0.75;
  }

  .web-player-shell__logo {
    width: 18px;
    height: 18px;
    border-radius: 5px;
  }

  .web-player-shell__app {
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .web-player-shell__win {
    display: flex;
    align-self: stretch;
    -webkit-app-region: no-drag;
  }

  .web-player-shell__win-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.75);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    &--close:hover {
      background: #e81123;
      color: #fff;
    }
  }

  .web-player-shell__content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>
