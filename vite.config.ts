import { defineConfig } from 'vite';
import uniPlugin from '@dcloudio/vite-plugin-uni';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// @ts-ignore
const uni = uniPlugin.default || uniPlugin;

export default defineConfig({
  plugins: [
    uni(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
