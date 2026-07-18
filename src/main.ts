import 'flag-icons/css/flag-icons.min.css';

// Шрифты zine-дизайна. Локально (@fontsource), а не с Google CDN:
// CSP приложения (default-src 'self') внешние шрифты не пропускает.
import '@fontsource/unbounded/500.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/unbounded/900.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';

import './styles/main.scss';
import { mount } from 'svelte';
import App from './App.svelte';
import { initRendererLogging } from './services/logger';
import { initWebAnixApi } from './services/anix-api-web';

// Init renderer-side logging before anything else
initRendererLogging();

document.addEventListener('DOMContentLoaded', () => {
  void initWebAnixApi().finally(() => {
    mount(App, { target: document.getElementById('app')! });
  });
});
