/**
 * build-standalone.mjs
 * ---------------------------------------------------------------------------
 * 构建「单文件可离线打开」的版本：把 CSS 与 JS 全部内联进 index.html，
 * 输出到 standalone/index.html —— 双击即可在浏览器里运行。
 *
 * 为什么需要单独做这一步：
 *   普通构建（dist/ 与 site/）用的是 <script type="module">，
 *   而浏览器在 file:// 协议下会因为 CORS 拒绝加载 ES 模块，
 *   于是双击 html 会白屏。
 *   这里改用 esbuild 打成 IIFE（传统脚本），并把 CSS 内联成 <style>，
 *   这样没有任何外部模块请求，file:// 也能跑。
 *
 * 用法：node scripts/build-standalone.mjs
 *
 * 产物：
 *   standalone/
 *     index.html        自包含单文件（HTML + CSS + JS 全内联）
 *     images/...        图片资源（若 public/ 下有图）
 */

import { build } from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import process from 'node:process';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');
const outDir = join(projectRoot, 'standalone');

const srcDir = (name) => join(projectRoot, 'src', name);

async function main() {
  console.log('构建单文件离线版 → standalone/index.html');

  // 1) 打包 JS（IIFE，不产生 import 语句）+ 收集 CSS
  const result = await build({
    entryPoints: [join(projectRoot, 'src', 'main.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
    minify: false,
    logLevel: 'warning',
    loader: { '.css': 'css' },
    // esbuild 需要知道输出路径，才能把 CSS 从 JS 里抽出来（否则报
    // "Cannot import .css into a JavaScript file without an output path"）
    outdir: outDir,
    alias: {
      '@config': join(projectRoot, 'src', 'config.ts'),
      '@state': join(projectRoot, 'src', 'state.ts'),
      '@core': srcDir('core'),
      '@data': srcDir('data'),
      '@ui': srcDir('ui'),
      '@pages': srcDir('pages'),
      '@share': srcDir('share'),
    },
  });

  let js = '';
  let css = '';
  for (const file of result.outputFiles) {
    if (file.path.endsWith('.css')) css += file.text;
    else if (file.path.endsWith('.js')) js += file.text;
  }

  if (!js) throw new Error('没有产出 JS，请检查入口是否正确');
  console.log(`  JS ${(js.length / 1024).toFixed(1)} KB，CSS ${(css.length / 1024).toFixed(1)} KB`);

  // 2) 读取原始 index.html，取出 <body> 内容与 <title>/<meta>
  const template = fs.readFileSync(join(projectRoot, 'index.html'), 'utf8');

  const title = /<title>([\s\S]*?)<\/title>/.exec(template)?.[1]?.trim() ?? '测测你是B站动画区的哪位UP主';
  const metas = [...template.matchAll(/<meta\s[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => !/http-equiv/i.test(tag))
    .join('\n    ');

  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/.exec(template);
  if (!bodyMatch) throw new Error('index.html 里找不到 <body>');
  // 去掉原来的模块脚本与 noscript 之外的内容保留；脚本位置我们自己插
  const bodyInner = bodyMatch[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<link[^>]*rel=["']?stylesheet["']?[^>]*>/gi, '')
    .trim();

  // 3) 组装单文件 HTML
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="color-scheme" content="light" />
    <meta name="theme-color" content="#FAF7F2" />
    <title>${title}</title>
    ${metas}
    <!--
      单文件离线版：样式与脚本已内联，可直接双击用浏览器打开，无需服务器。
      注意：用 file:// 打开时，浏览器会限制部分功能（例如剪贴板 API 可能不可用），
      分享图生成与下载、答题与匹配计算都可以正常工作。
      正式发布请使用 site/ 或 dist/ 版本（通过 http(s) 访问）。
    -->
    <style>
${css}
    </style>
  </head>
  <body>
${bodyInner}
    <script>
${js}
    </script>
  </body>
</html>
`;

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(join(outDir, 'index.html'), html, 'utf8');

  // 4) 复制 public/ 下的图片等静态资源（若有）
  const publicDir = join(projectRoot, 'public');
  if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, outDir, { recursive: true });
  }

  const bytes = fs.statSync(join(outDir, 'index.html')).size;
  console.log(`  index.html ${(bytes / 1024).toFixed(1)} KB`);
  console.log('完成。双击 standalone/index.html 即可打开。');
}

main().catch((err) => {
  console.error('构建失败：', err.message);
  process.exit(1);
});
