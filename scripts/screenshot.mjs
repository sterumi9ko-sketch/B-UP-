/**
 * screenshot.mjs
 * ---------------------------------------------------------------------------
 * 用 Chrome DevTools 协议做像素级精确截图（含真正的移动端视口模拟）。
 *
 * 为什么不直接用 chrome --screenshot：
 *   Windows 上系统 DPI 缩放会让 --window-size 与真实 CSS 视口不一致，
 *   截出来的图会被裁掉右侧内容，无法用来判断移动端布局。
 *   这里改用 Emulation.setDeviceMetricsOverride，明确指定宽高与缩放比。
 *
 * 用法：
 *   node scripts/screenshot.mjs                     # 截默认的几张图
 *   node scripts/screenshot.mjs --base http://localhost:4173 --out screenshots
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
const OUT = getArg('--out', 'screenshots');
const PORT = 9900 + Math.floor(Math.random() * 90);

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* 继续 */
    }
  }
  return null;
}

async function getJson(path, options = {}) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    method: options.method ?? 'GET',
    headers: { Host: 'localhost' },
  });
  return JSON.parse(await res.text());
}

/** 一条连接内的多次 CDP 调用 */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('WebSocket 连接失败')), { once: true });
  });

  let nextId = 1;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`CDP 调用超时：${method}`));
        }
      }, 30000);
    });

  return { send, close: () => ws.close() };
}

/** 页面加载完成（等 DOM + 一点额外时间给动画与分享图） */
async function waitForRender(client, url, extraMs) {
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Page.navigate', { url });
  // 轮询 readyState，直到渲染完成
  for (let i = 0; i < 60; i++) {
    await sleep(200);
    const state = await client.send('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true,
    });
    if (state.result?.value === 'complete') break;
  }
  await sleep(extraMs);
}

async function main() {
  const browser = findBrowser();
  if (!browser) {
    console.log('没有找到 Chrome/Edge，跳过截图。');
    return;
  }

  fs.mkdirSync(OUT, { recursive: true });
  const userDataDir = fs.mkdtempSync(join(os.tmpdir(), 'dsh-shot-'));

  const child = spawn(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const jobs = [
    { file: '01-home-desktop.png', url: `${BASE}/#/`, width: 1440, height: 2100, mobile: false },
    { file: '02-home-mobile.png', url: `${BASE}/#/`, width: 390, height: 1600, mobile: true },
    { file: '03-quiz-desktop.png', url: `${BASE}/#/test`, width: 1440, height: 1150, mobile: false },
    { file: '04-quiz-mobile.png', url: `${BASE}/#/test`, width: 390, height: 1000, mobile: true },
    { file: '05-gallery-desktop.png', url: `${BASE}/#/gallery`, width: 1440, height: 2400, mobile: false },
    { file: '06-gallery-mobile.png', url: `${BASE}/#/gallery`, width: 390, height: 1500, mobile: true },
    { file: '07-about-desktop.png', url: `${BASE}/#/about`, width: 1440, height: 2600, mobile: false },
    { file: '08-result-desktop.png', url: `${BASE}/debug.html?pattern=zigzag`, width: 1440, height: 3400, mobile: false },
    { file: '09-result-mobile.png', url: `${BASE}/debug.html?pattern=zigzag`, width: 390, height: 2900, mobile: true },
    { file: '10-result-agree-desktop.png', url: `${BASE}/debug.html?pattern=flat&level=0`, width: 1440, height: 3400, mobile: false },
    { file: '11-settings-desktop.png', url: `${BASE}/#/settings`, width: 1440, height: 2000, mobile: false },
    { file: '12-settings-mobile.png', url: `${BASE}/#/settings`, width: 390, height: 1600, mobile: true },
  ];

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

    for (const job of jobs) {
      const target = await getJson(`/json/new?about:blank`, { method: 'PUT' });
      const client = await connect(target.webSocketDebuggerUrl);

      // 精确指定视口
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: job.width,
        height: job.height,
        deviceScaleFactor: 1,
        mobile: job.mobile,
      });

      await waitForRender(client, job.url, job.url.includes('debug.html') ? 4500 : 2200);

      const shot = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
      });
      fs.writeFileSync(`${OUT}/${job.file}`, Buffer.from(shot.data, 'base64'));

      // 顺便记录真实视口宽度，确认模拟生效
      const metrics = await client.send('Runtime.evaluate', {
        expression: 'JSON.stringify({ w: window.innerWidth, sw: document.documentElement.scrollWidth })',
        returnByValue: true,
      });
      const info = JSON.parse(metrics.result.value);
      const status = info.sw > info.w + 1 ? '❌ 横向溢出' : '✅';
      console.log(`${job.file}  ${job.width}x${job.height}  viewport=${info.w} scrollWidth=${info.sw} ${status}`);

      client.close();
      await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`, { headers: { Host: 'localhost' } });
    }
  } finally {
    child.kill();
  }
}

main().catch((err) => {
  console.error('截图失败：', err.message);
  process.exit(1);
});
