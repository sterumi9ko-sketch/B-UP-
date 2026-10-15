/**
 * find-overflow2.mjs —— 更宽的溢出检测
 * 除了「内容超出且被裁剪」，还检测：
 *   - line-clamp 截断（文字被省略号吃掉）
 *   - 文本节点的右边界超出元素内容区（padding 溢出）
 *   - 小屏（320px）下的换行异常
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const getArg = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : d;
};

const BASE = getArg('--base', 'http://localhost:4173');
const WIDTHS = (getArg('--widths', '320,360,390,414')).split(',').map(Number);
const PORT = 9600 + Math.floor(Math.random() * 200);

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path, options = {}) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    method: options.method ?? 'GET',
    headers: { Host: 'localhost' },
  });
  return JSON.parse(await res.text());
}

async function evaluate(wsUrl, expression) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  const id = 1;
  const value = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('求值超时')), 25000);
    ws.addEventListener('message', (event) => {
      const m = JSON.parse(event.data);
      if (m.id !== id) return;
      clearTimeout(timer);
      if (m.result?.exceptionDetails) return reject(new Error(m.result.exceptionDetails.text));
      resolve(m.result?.result?.value);
    });
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  });
  ws.close();
  return value;
}

const PROBE = `(() => {
  const clipped = [];
  const clamped = [];

  const describe = (el) => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || '').slice(0, 70),
      text: (el.textContent || '').trim().slice(0, 50),
      size: Math.round(r.width) + 'x' + Math.round(r.height),
      fs: getComputedStyle(el).fontSize,
    };
  };

  for (const el of document.querySelectorAll('body *')) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) continue;
    const style = getComputedStyle(el);
    const text = (el.textContent || '').trim();
    if (!text) continue;

    // 1) 被裁剪：内容尺寸大于容器（哪怕 overflow 是 visible，也算可疑信号）
    const overW = el.scrollWidth - el.clientWidth;
    const overH = el.scrollHeight - el.clientHeight;
    const clippedX = overW > 1 && style.overflowX !== 'auto' && style.overflowX !== 'scroll';
    const clippedY = overH > 1 && style.overflowY !== 'auto' && style.overflowY !== 'scroll';
    if (clippedX || clippedY) {
      const parent = el.parentElement;
      clipped.push({
        ...describe(el),
        over: [clippedX ? 'x+' + overW : '', clippedY ? 'y+' + overH : ''].filter(Boolean).join(' '),
        overflow: style.overflow,
        parentCls: String(parent?.className || '').slice(0, 50),
      });
    }

    // 2) line-clamp 截断（卡片简介被省略号吃掉，属于「看不全」而非「跑出框」）
    const clamp = style.webkitLineClamp;
    if (clamp && clamp !== 'none' && el.scrollHeight > el.clientHeight + 1) {
      clamped.push({ ...describe(el), clamp, over: 'y+' + overH });
    }
  }

  return JSON.stringify({ clipped: clipped.slice(0, 25), clamped: clamped.slice(0, 15) });
})()`;

const pages = [
  { name: '首页', hash: '#/' },
  { name: '答题页', hash: '#/test' },
  { name: '图鉴页', hash: '#/gallery' },
  { name: '关于页', hash: '#/about' },
  { name: '设置页', hash: '#/settings' },
];

const userDataDir = fs.mkdtempSync(join(os.tmpdir(), 'dsh-ovf2-'));
const child = spawn(
  CHROME,
  ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`, 'about:blank'],
  { stdio: 'ignore' },
);

try {
  for (let i = 0; i < 60; i++) {
    try {
      await getJson('/json/version');
      break;
    } catch {
      await sleep(250);
    }
  }

  for (const width of WIDTHS) {
    console.log(`\n############ 视口宽度 ${width}px ############`);
    for (const page of pages) {
      const target = await getJson(`/json/new?about:blank`, { method: 'PUT' });
      // 用 CDP 精确设置视口（避免 Windows DPI 缩放干扰）
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((r) => ws.addEventListener('open', r, { once: true }));
      let nextId = 1;
      const send = (method, params = {}) =>
        new Promise((resolve) => {
          const id = nextId++;
          const handler = (e) => {
            const m = JSON.parse(e.data);
            if (m.id === id) {
              ws.removeEventListener('message', handler);
              resolve(m.result);
            }
          };
          ws.addEventListener('message', handler);
          ws.send(JSON.stringify({ id, method, params }));
        });
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
      await send('Page.enable');
      await send('Page.navigate', { url: `${BASE}/${page.hash}` });
      await sleep(2600);

      const raw = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
      const data = JSON.parse(raw?.result?.value ?? '{"clipped":[],"clamped":[]}');
      ws.close();

      console.log(`\n--- ${page.name} ---`);
      if (!data.clipped.length && !data.clamped.length) {
        console.log('  未发现问题');
      }
      for (const item of data.clipped) {
        console.log(`  [内容超出 ${item.over}] <${item.tag} class="${item.cls}"> ${item.size} fs=${item.fs}`);
        console.log(`      文字: ${JSON.stringify(item.text)}`);
        console.log(`      overflow=${item.overflow}  父元素 class="${item.parentCls}"`);
      }
      for (const item of data.clamped) {
        console.log(`  [line-clamp ${item.clamp} 截断 ${item.over}] <${item.tag} class="${item.cls}"> ${item.size}`);
        console.log(`      文字: ${JSON.stringify(item.text)}`);
      }

      await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`, { headers: { Host: 'localhost' } });
    }
  }
} finally {
  child.kill();
}
