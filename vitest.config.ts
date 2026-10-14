import { defineConfig } from 'vitest/config';
import { aliasList } from './aliases.mjs';

export default defineConfig({
  // 与 vite.config.ts 使用同一套路径别名，保证测试与构建解析一致
  resolve: {
    alias: aliasList,
  },
  test: {
    // 核心算法测试不需要浏览器环境，用 node 环境即可，零额外依赖。
    // 如果以后要加 DOM 相关测试，改成 'jsdom' 并安装 jsdom 即可。
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
});
