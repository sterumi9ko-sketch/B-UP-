import { defineConfig } from 'vite';
import { aliasList } from './aliases.mjs';

/**
 * 纯静态站点构建配置。
 *
 * 两套构建产物：
 *
 *   1. 默认：`npm run build` → dist/
 *      供 Cloudflare Pages 等托管使用，文件名带内容哈希（利于缓存）。
 *
 *   2. 扁平发布包：`npm run build:site` → site/
 *      产物文件名固定、不带哈希、全部放在根目录：
 *
 *        site/
 *          index.html     页面入口
 *          script.js      全部脚本（打包成一个文件）
 *          style.css      全部样式（打包成一个文件）
 *          images/...     图片资源（public/ 原样复制）
 *
 *      固定文件名便于直接嵌入、内联或放到任意静态空间；缺点是更新后
 *      浏览器缓存需要靠刷新解决（对本次活动页可接受）。
 *
 * 由 BUILD_TARGET=site 环境变量触发（见 scripts/build-site.mjs）。
 *
 * 关于 base：
 *   默认 './' 相对路径，适用于 Cloudflare Pages、Netlify、任意静态空间，
 *   也适用于 file:// 打开。
 *   但 GitHub Pages 的项目站点部署在子路径 /<仓库名>/ 下，
 *   此时需要绝对前缀，由 GITHUB_PAGES_BASE 环境变量提供（见 .github/workflows/deploy-pages.yml）。
 */
const forSite = process.env.BUILD_TARGET === 'site';

/** 资源基础路径：默认相对，GitHub Pages 场景用仓库子路径 */
const base = process.env.GITHUB_PAGES_BASE || './';

export default defineConfig({
  base,
  resolve: {
    alias: aliasList,
  },
  build: {
    outDir: forSite ? 'site' : 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
    // 把所有小资源内联，避免生成额外的资源文件
    assetsInlineLimit: forSite ? 1024 * 1024 : 4096,
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: forSite
        ? { main: 'index.html' }
        : {
            main: 'index.html',
            // 开发期端到端自检页：自动答完题目并跳转到结果页，
            // 便于用真实浏览器验证「答题 → 计分 → 匹配 → 结果页」整条链路。
            // 它不出现在任何导航里，也不打进 site/ 发布包。
            debug: 'debug.html',
          },
      output: forSite
        ? {
            // 固定文件名，全部落在根目录
            entryFileNames: 'script.js',
            chunkFileNames: 'script.js',
            assetFileNames: (assetInfo) => {
              const name = assetInfo.names?.[0] ?? assetInfo.name ?? '';
              if (name.endsWith('.css')) return 'style.css';
              return 'assets/[name][extname]';
            },
            // 确保只产出一个 JS 文件
            inlineDynamicImports: true,
          }
        : undefined,
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  preview: {
    port: 4173,
  },
});
