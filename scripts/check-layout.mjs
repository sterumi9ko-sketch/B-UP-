/**
 * check-layout.mjs
 * ---------------------------------------------------------------------------
 * 用真实的 Chrome（DevTools 协议）检查页面渲染结果：
 *   - 文档是否横向溢出（scrollWidth vs clientWidth）
 *   - 是否有元素超出视口右边界（手机上内容被截断的常见原因）
 *   - 关键元素是否渲染出来（导航、作答圆点、图鉴卡片、结果页卡片与雷达图）
 *
 * 它验证的是"浏览器里真实渲染出来的东西"，是单元测试之外的补充验收手段。
 *
 * 用法：
 *   node scripts/check-layout.mjs                                   # 默认 414px
 *   node scripts/check-layout.mjs --width 390                       # 手机宽度
 *   node scripts/check-layout.mjs --width 1440                      # 桌面宽度
 *   node scripts/check-layout.mjs --no-debug                        # 跳过 debug.html 相关检查
 *   node scripts/check-layout.mjs --base http://127.0.0.1:4180 --no-debug
 *
 * 说明：结果页检查依赖 debug.html（开发期自检页，会自动答题并跳转）。
 * 独立发布包 site/ 里不含 debug.html，此时用 --no-debug；
 * 结果页可改用 check-interactions.mjs，它通过真实点击走到结果页并完整验证。
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const BASE = getArg('--base', 'http://localhost:4173');
/**
 * 页面文件名。默认 index.html；用 file:// 打开时必须是完整文件名
 * （目录形式会让 Chrome 显示目录列表而不是页面）。
 */
const PAGE = getArg('--page', 'index.html');
const WIDTH = Number(getArg('--width', '414'));
const HEIGHT = Number(getArg('--height', '900'));
/** 独立发布包里没有 debug.html，用 --no-debug 跳过依赖它的检查 */
const skipDebug = args.includes('--no-debug');
const PORT = 9300 + Math.floor(Math.random() * 400);

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

function findBrowser() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* 继续找下一个 */
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path, options = {}) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    method: options.method ?? 'GET',
    headers: { Host: 'localhost' },
  });
  const text = await res.text();
  if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
    throw new Error(`DevTools 返回了非 JSON 内容：${text.slice(0, 80)}`);
  }
  return JSON.parse(text);
}

/** 极简 CDP 客户端：连上目标页面，求值一次并取回结果 */
async function evaluate(wsUrl, expression) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('WebSocket 连接失败')), { once: true });
  });

  const id = 1;
  const value = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('等待求值结果超时')), 25000);
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      clearTimeout(timer);
      if (message.result?.exceptionDetails) {
        reject(new Error(message.result.exceptionDetails.text ?? '页面内求值抛错'));
        return;
      }
      resolve(message.result?.result?.value);
    });
    ws.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true, awaitPromise: true },
      }),
    );
  });

  ws.close();
  return value;
}

/** 在页面里执行的检查脚本 */
const PROBE = `(() => {
  const doc = document.documentElement;

  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.right > window.innerWidth + 1) {
      const style = getComputedStyle(el);
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 70),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        overflowX: style.overflowX,
      });
    }
  }

  return {
    url: location.href,
    breadcrumb: document.body.innerText.split('\\n').map((s) => s.trim()).filter(Boolean).slice(0, 5).join(' | '),
    navLinks: document.querySelectorAll('.nav__link').length,
    upCards: document.querySelectorAll('.up-card').length,
    podiumCards: document.querySelectorAll('.podium__card').length,
    scaleDots: document.querySelectorAll('.scale__item').length,
    canvasCount: document.querySelectorAll('canvas').length,
    shareImage: Boolean(document.querySelector('.share-preview img')),
    docScrollWidth: doc.scrollWidth,
    docClientWidth: doc.clientWidth,
    innerWidth: window.innerWidth,
    horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
    offenders: offenders.slice(0, 10),
  };
})()`;

async function main() {
  const browser = findBrowser();
  if (!browser) {
    console.log('没有找到 Chrome/Edge，跳过浏览器检查。');
    return;
  }

  const userDataDir = fs.mkdtempSync(join(os.tmpdir(), 'dsh-chrome-'));
  const child = spawn(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let failures = 0;

  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        await getJson('/json/version');
        ready = true;
        break;
      } catch {
        await sleep(250);
      }
    }
    if (!ready) throw new Error('Chrome 调试端口没有就绪');

    const checks = [
      { name: '首页', url: `${BASE}/${PAGE}#/`, expect: { navLinks: 3 } },
      { name: '答题页', url: `${BASE}/${PAGE}#/test`, expect: { scaleDots: 7 } },
      { name: '图鉴页', url: `${BASE}/${PAGE}#/gallery`, expect: { upCards: 18 } },
      { name: '关于页', url: `${BASE}/${PAGE}#/about`, expect: {} },
    ];

    if (!skipDebug) {
      checks.push({
        name: '结果页（锯齿作答）',
        url: `${BASE}/debug.html?pattern=zigzag`,
        expect: { podiumCards: 3, canvasCount: 1 },
      });
    }

    console.log(`视口宽度：${WIDTH}px`);
    if (skipDebug) console.log('（已跳过 debug.html 相关检查：--no-debug）');
    console.log('');

    for (const check of checks) {
      // 新版 Chrome 要求用 PUT 创建标签页
      const target = await getJson(`/json/new?${encodeURIComponent(check.url)}`, { method: 'PUT' });
      await sleep(4000); // 等渲染与结果页揭晓动画
      const info = await evaluate(target.webSocketDebuggerUrl, PROBE);

      console.log(`=== ${check.name} ===`);
      console.log(`  面包屑：${info.breadcrumb}`);
      console.log(
        `  元素：nav=${info.navLinks} 卡片=${info.upCards} 前三卡=${info.podiumCards} 圆点=${info.scaleDots} canvas=${info.canvasCount} 分享图=${info.shareImage}`,
      );
      console.log(
        `  宽度：innerWidth=${info.innerWidth} scrollWidth=${info.docScrollWidth} clientWidth=${info.docClientWidth} → ${
          info.horizontalOverflow ? '失败：横向溢出' : '正常：无横向溢出'
        }`,
      );

      if (info.offenders.length) {
        failures++;
        console.log('  越界元素：');
        for (const item of info.offenders) {
          console.log(
            `     <${item.tag} class="${item.cls}"> right=${item.right} width=${item.width} overflowX=${item.overflowX}`,
          );
        }
      }

      for (const [key, expected] of Object.entries(check.expect)) {
        if (info[key] !== expected) {
          failures++;
          console.log(`  断言失败：${key} 期望 ${expected}，实际 ${info[key]}`);
        }
      }

      console.log('');
      await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`, { headers: { Host: 'localhost' } });
    }

    console.log(failures === 0 ? '全部检查通过' : `有 ${failures} 项检查未通过`);
    if (failures > 0) process.exitCode = 1;
  } finally {
    child.kill();
  }
}

main().catch((err) => {
  console.error('检查失败：', err.message);
  process.exit(1);
});
