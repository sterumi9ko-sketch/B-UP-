/**
 * build-site.mjs
 * ---------------------------------------------------------------------------
 * 构建"独立发布包"：只含正式站点的 HTML / JS / CSS，输出到 site/。
 *
 * 和 `npm run build`（输出 dist/，含开发期自检页 debug.html）的区别：
 *   site/index.html              站点入口
 *   site/assets/main-*.js        打包后的脚本
 *   site/assets/main-*.css       打包后的样式
 *   site/images/...              public/ 下的图片（有的话）
 *
 * 这个文件夹是自包含的，可以直接上传到任意静态托管服务。
 *
 * 为什么要单独写脚本而不是用 cross-env：
 *   少装一个依赖，且 Windows / macOS / Linux 行为一致。
 *
 * 用法：node scripts/build-site.mjs
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import process from 'node:process';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');

// 用 vite 的 JS 入口而不是 .cmd 包装脚本：wrapper 会改工作目录，导致路径解析出错
const viteBin = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

console.log('构建独立发布包 → site/');
const result = spawnSync(process.execPath, [viteBin, 'build'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env, BUILD_TARGET: 'site' },
});

process.exit(result.status ?? 1);
