import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 2000, target: 'es2020' },
  test: { include: ['tests/unit/**/*.test.ts'] },
} as never);
