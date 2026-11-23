import { createApp } from 'vue';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import App from './App.vue';
import { paintReaderCorners } from './reader-corners.js';
import './themes.css';
import './style.css';

const root = document.querySelector<HTMLElement>('#app')!;
createApp(App).mount(root);
paintReaderCorners(root);
