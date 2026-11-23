import { build } from 'vite';

await build({ build: { license: { fileName: 'third-party-licenses.md' } } });
