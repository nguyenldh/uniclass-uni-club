import { defineConfig } from 'vite';
import path from 'path';

/**
 * Build config cho Weekly Event Countdown Panel — widget IIFE độc lập.
 *
 * Output: frontend/public/widgets/weekly-event-panel.js (serve cùng frontend).
 * - format IIFE + global `WeeklyEventPanel`
 * - CSS + ảnh robot inline thẳng vào 1 file .js duy nhất (self-contained,
 *   chạy được cả khi nhúng vào WebView shell native khác origin).
 */
export default defineConfig({
  // Widget build không cần public dir riêng (output nằm trong public/ của frontend).
  publicDir: false,
  build: {
    outDir: path.resolve(__dirname, '../../public/widgets'),
    emptyOutDir: false,
    // Inline robot.png (~55KB) thành data URI => bundle không phụ thuộc asset ngoài.
    assetsInlineLimit: 200 * 1024,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'WeeklyEventPanel',
      formats: ['iife'],
      fileName: () => 'weekly-event-panel.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true, exports: 'named' },
    },
    // Không minify quá tay để dễ debug bản đầu; đổi 'esbuild' khi ổn định.
    minify: 'esbuild',
    target: 'es2018',
  },
});
