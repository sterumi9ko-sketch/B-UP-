/**
 * check-settings.mjs
 * ---------------------------------------------------------------------------
 * 「UP 主数据设置」页的真实浏览器交互检查。
 *
 * 覆盖：
 *   1. 页面渲染：名单项 = UP 主数量、分数滑块 = 8 行、雷达图存在
 *   2. 点击名单能切换选中的 UP 主
 *   3. 拖动滑块会写入 localStorage 覆盖，并标出「已改」
 *   4. 刷新后覆盖仍在（持久化）
 *   5. 覆盖会影响结果页的排名（真的接进了匹配算法）
 *   6. 「恢复这位的默认值」与「全部恢复默认」能清掉覆盖
 *   7. 搜索能过滤名单
 *   8. 全程无控制台报错
 *
 * 用法：
 *   node scripts/check-settings.mjs --base http://localhost:4173
 *   node scripts/check-settings.mjs --base https://b-up.pages.dev
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

const BASE = getArg('--base', 'http://localhost:4173');
const PAGE = getArg('--page', 'index.html');
const PORT = 9900 + Math.floor(Math.random() * 90);

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;

function check(ok, label, detail = '') {
  if (ok) {
    passed++;
    console.log(`✅ ${label}${detail ? `  （${detail}）` : ''}`);
  } else {
    failed++;
    console.log(`❌ ${label}${detail ? `  （${detail}）` : ''}`);
  }
}

async function getJson(path, options = {}) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    method: options.method ?? 'GET',
    headers: { Host: 'localhost' },
  });
  return JSON.parse(await res.text());
}

/** 一个最小的 CDP 会话 */
class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.consoleErrors = [];
    ws.addEventListener('message', (event) => {
      const m = JSON.parse(event.data);
      if (m.method === 'Runtime.exceptionThrown') {
        this.consoleErrors.push(m.params?.exceptionDetails?.exception?.description ?? 'unknown');
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
        this.consoleErrors.push((m.params.args ?? []).map((a) => a.value ?? '').join(' '));
      }
    });
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('WebSocket 连接失败')), { once: true });
    });
    const session = new Session(ws);
    await session.send('Runtime.enable');
    await session.send('Page.enable');
    return session;
  }

  send(method, params = {}) {
    return new Promise((resolve) => {
      const id = this.id++;
      const handler = (event) => {
        const m = JSON.parse(event.data);
        if (m.id === id) {
          this.ws.removeEventListener('message', handler);
          resolve(m.result);
        }
      };
      this.ws.addEventListener('message', handler);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** 在页面里求值，返回结果值 */
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text ?? '页面求值抛错');
    return result?.result?.value;
  }

  async goto(url) {
    await this.send('Page.navigate', { url });
    await sleep(2600);
  }

  /**
   * 只切换 hash（SPA 内部路由），并等待 hash 真正变成目标值。
   *
   * 为什么不能直接用 Page.navigate 切 hash 之后再 Page.reload：
   *   仅 hash 不同的导航在 Chrome 里不算真正的页面导航，
   *   reload 可能发生在 hash 更新之前，于是刷新出来的还是旧页面。
   */
  async open(hash, waitMs = 1800) {
    const target = hash.startsWith('#') ? hash : `#${hash}`;
    await this.eval(`window.location.hash = ${JSON.stringify(target)}; true`);
    for (let i = 0; i < 24; i++) {
      const current = await this.eval(`window.location.hash`);
      if (current === target) break;
      await sleep(125);
    }
    await sleep(waitMs);
  }

  /** 整页重新加载（保持当前 hash），用于让 state.hydrate 重新读取 localStorage */
  async reload() {
    await this.send('Page.reload', { ignoreCache: false });
    await sleep(2800);
  }

  /**
   * 切到指定 hash 并整页重载（等价于用户直接打开这个地址）。
   * 这样 state.hydrate() 会在带正确 hash 的地址上重新执行。
   */
  async loadFresh(hash) {
    await this.open(hash, 600);
    await this.reload();
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  if (!CHROME) {
    console.log('没有找到 Chrome/Edge，跳过设置页检查');
    return;
  }

  const userDataDir = fs.mkdtempSync(join(os.tmpdir(), 'dsh-set-'));
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1280,900',
      'about:blank',
    ],
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

    const target = await getJson('/json/new?about:blank', { method: 'PUT' });
    const session = await Session.connect(target.webSocketDebuggerUrl);

    const settingsUrl = `${BASE}/${PAGE}#/settings`;
    await session.goto(settingsUrl);

    /* ---------- 1. 渲染 ---------- */
    console.log('=== 1. 页面渲染 ===');
    const listCount = await session.eval(`document.querySelectorAll('.settings-list__item').length`);
    check(listCount === 18, '名单项数量为 18（全部 UP 主，含不参与匹配的）', `实际 ${listCount}`);

    const sliderCount = await session.eval(`document.querySelectorAll('.score-row__range').length`);
    check(sliderCount === 8, '分数滑块为 8 个维度', `实际 ${sliderCount}`);

    const canvasCount = await session.eval(`document.querySelectorAll('.settings-preview canvas').length`);
    check(canvasCount === 1, '预览雷达图已渲染', `实际 ${canvasCount}`);

    const badgeText = await session.eval(`document.querySelector('.settings-status .tag')?.textContent || ''`);
    check(badgeText.includes('基准值'), '初始状态显示使用基准值', badgeText);

    /* ---------- 2. 搜索 ---------- */
    console.log('\n=== 2. 搜索过滤 ===');
    await session.eval(`(() => {
      const input = document.querySelector('.search-input');
      input.value = '泛式';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    const filtered = await session.eval(`document.querySelectorAll('.settings-list__item').length`);
    check(filtered >= 1 && filtered < 18, '搜索后名单被过滤', `${filtered} 项`);

    await session.eval(`(() => {
      const input = document.querySelector('.search-input');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    const restored = await session.eval(`document.querySelectorAll('.settings-list__item').length`);
    check(restored === 18, '清空搜索后恢复完整名单', `${restored} 项`);

    /* ---------- 3. 切换选中 ---------- */
    console.log('\n=== 3. 切换选中的 UP 主 ===');
    const firstId = await session.eval(`(() => {
      const item = document.querySelector('.settings-list__item');
      return item ? item.querySelector('.settings-list__name').textContent : '';
    })()`);
    await session.eval(`(() => {
      const items = document.querySelectorAll('.settings-list__item');
      items[2].click();
    })()`);
    await sleep(600);
    const thirdName = await session.eval(`document.querySelector('.settings-editor__info h2')?.textContent || ''`);
    check(Boolean(thirdName) && thirdName !== firstId, '点击第三项后编辑器切换到该 UP 主', `${firstId} → ${thirdName}`);

    /* ---------- 4. 改分数 ---------- */
    console.log('\n=== 4. 调整分数 ===');
    const changed = await session.eval(`(() => {
      const range = document.querySelector('.score-row__range');
      range.value = '95';
      range.dispatchEvent(new Event('input', { bubbles: true }));
      range.dispatchEvent(new Event('change', { bubbles: true }));
      return range.value;
    })()`);
    check(changed === '95', '滑块值已改为 95', `实际 ${changed}`);
    await sleep(700);

    const stored = await session.eval(`window.localStorage.getItem('anime-up-match:score-overrides')`);
    check(Boolean(stored) && stored.includes('95'), '覆盖已写入 localStorage', stored ? `${stored.slice(0, 60)}…` : '空');

    const badgeAfter = await session.eval(`document.querySelector('.settings-status .tag')?.textContent || ''`);
    check(badgeAfter.includes('已调整'), '顶部徽章更新为「已调整」', badgeAfter);

    const hasBadge = await session.eval(`document.querySelectorAll('.settings-list__badge').length`);
    check(hasBadge >= 1, '名单里标出了「已改」', `${hasBadge} 个`);

    /* ---------- 5. 刷新后持久化 ---------- */
    console.log('\n=== 5. 刷新持久化 ===');
    await session.goto(settingsUrl);
    await sleep(600);
    const afterReload = await session.eval(`(() => {
      const stored = window.localStorage.getItem('anime-up-match:score-overrides');
      return stored || '';
    })()`);
    check(afterReload.includes('95'), '刷新后覆盖仍在', '已保留');
    const badgeReload = await session.eval(`document.querySelector('.settings-status .tag')?.textContent || ''`);
    check(badgeReload.includes('已调整'), '刷新后徽章仍显示已调整', badgeReload);

    /* ---------- 6. 覆盖影响结果页排名 ---------- */
    console.log('\n=== 6. 覆盖影响匹配结果 ===');
    // 先造一份完整作答（40 题全选第 4 档 = 中立），并标记结果已就绪
    const seeded = await session.eval(`(() => {
      const answers = {};
      for (let i = 1; i <= 40; i++) answers['q' + String(i).padStart(2, '0')] = 3;
      window.localStorage.setItem('anime-up-match:progress', JSON.stringify({
        version: 1, answers, index: 39, updatedAt: Date.now(), finished: true,
      }));
      window.localStorage.setItem('anime-up-match:result-ready', '1');
      window.localStorage.removeItem('anime-up-match:score-overrides');
      return Object.keys(answers).length;
    })()`);
    check(seeded === 40, '已写入 40 题完整作答', `${seeded} 题`);

    // 看默认数据下的第一名（必须整页刷新：state.hydrate 只在模块加载时读取一次）
    await session.loadFresh('#/result');
    await sleep(1200);
    const topBefore = await session.eval(`(() => {
      const name = document.querySelector('.result-hero__name')?.textContent || '';
      const link = document.querySelector('.result-hero__actions a[href*="space.bilibili.com"]')?.href || '';
      const uid = (link.match(/\\/(\\d+)/) || [])[1] || '';
      return name + '|' + uid;
    })()`);
    const [nameBefore, uidBefore] = String(topBefore).split('|');
    check(Boolean(nameBefore), '默认数据下第一名已算出', `${nameBefore}（UID ${uidBefore}）`);

    // 回到设置页才能挑人改分（必须先导航，否则还在结果页上查不到名单）
    await session.loadFresh('#/settings');
    await sleep(800);

    const listCountNow = await session.eval(`document.querySelectorAll('.settings-list__item').length`);
    check(listCountNow === 18, '回到设置页后名单完整', `${listCountNow} 项`);

    // 把这位第一名的所有维度改成 0，理论上它必然掉出第一。
    // 注意：点击名单项会重建整个编辑器 DOM，所以必须分两次求值，
    // 不能在同一次求值里「先 click 再查滑块」——那时滑块还是旧的、已被移除。
    const picked = await session.eval(`(() => {
      const target = ${JSON.stringify(nameBefore)};
      const items = Array.from(document.querySelectorAll('.settings-list__item'));
      const hit = items.find((el) => {
        const name = el.querySelector('.settings-list__name');
        return name && name.textContent.trim() === target;
      });
      if (!hit) {
        return 'not-found: 目标=' + target + ' 实际=' + items.map((el) => el.querySelector('.settings-list__name')?.textContent).join(',');
      }
      hit.click();
      return 'clicked';
    })()`);
    check(picked === 'clicked', '在设置页按昵称选中了当前第一名的 UP 主', picked);

    // 等待重建完成后再读编辑器标题，确认选中的确实是它
    await sleep(800);
    const editorName = await session.eval(`document.querySelector('.settings-editor__info h2')?.textContent || ''`);
    check(editorName === nameBefore, '编辑器已切换到该 UP 主', `编辑器显示「${editorName}」`);

    const zeroResult = await session.eval(`(() => {
      const ranges = Array.from(document.querySelectorAll('.score-row__range'));
      for (const range of ranges) {
        range.value = '0';
        range.dispatchEvent(new Event('input', { bubbles: true }));
        range.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return ranges.length;
    })()`);
    check(zeroResult === 8, '把该 UP 主的 8 个维度都改成 0', `${zeroResult} 个`);

    await sleep(1200); // 等 input 的节流写入完成
    const storedAll = await session.eval(`window.localStorage.getItem('anime-up-match:score-overrides') || ''`);
    check(/:\s*0[,}]/.test(storedAll), '覆盖已写入 localStorage', storedAll ? `${storedAll.slice(0, 70)}…` : '空');

    // 回结果页看第一名是否换了（需要整页刷新，hydrate 才会读到新覆盖）
    await session.loadFresh('#/result');
    await sleep(1500);
    const nameAfter = await session.eval(`document.querySelector('.result-hero__name')?.textContent || ''`);
    check(
      Boolean(nameAfter) && nameAfter !== nameBefore,
      '把第一名改成全 0 后结果页第一名发生变化（说明覆盖真的接进了匹配算法）',
      `${nameBefore} → ${nameAfter || '(空)'}`,
    );

    /* ---------- 7. 恢复默认 ---------- */
    console.log('\n=== 7. 恢复默认值 ===');

    // 7a. 写入一条合法覆盖（用第一位 UP 主的真实 id），验证「恢复这位」
    const validId = await session.eval(`(() => {
      const stored = window.localStorage.getItem('anime-up-match:score-overrides');
      return stored ? Object.keys(JSON.parse(stored))[0] || '' : '';
    })()`);
    check(Boolean(validId), '能从 localStorage 读到被改过的 UP 主 id', validId);

    await session.loadFresh('#/settings');

    // 选中被改过的那位（名单里带「已改」标记）
    const pickedChanged = await session.eval(`(() => {
      const badge = document.querySelector('.settings-list__badge');
      if (!badge) return 'no-badge';
      badge.closest('.settings-list__item').click();
      return 'clicked';
    })()`);
    check(pickedChanged === 'clicked', '选中了带「已改」标记的 UP 主', pickedChanged);
    await sleep(800);

    const resetClicked = await session.eval(`(() => {
      const buttons = Array.from(document.querySelectorAll('.settings-editor .btn'));
      const reset = buttons.find((b) => /恢复|已是默认/.test(b.textContent || ''));
      if (!reset) return 'missing';
      if (reset.disabled) return 'disabled';
      reset.click();
      return 'clicked';
    })()`);
    check(resetClicked === 'clicked', '「恢复这位的默认值」可点击且已点击', resetClicked);
    await sleep(900);

    const afterReset = await session.eval(`window.localStorage.getItem('anime-up-match:score-overrides')`);
    check(!afterReset || afterReset === '{}' || afterReset === 'null', '恢复后该条覆盖被清除', afterReset ?? 'null');

    // 7b. 全部恢复默认：先确认至少有一条合法覆盖
    const hasOverride = await session.eval(`(() => {
      const stored = window.localStorage.getItem('anime-up-match:score-overrides');
      return stored ? Object.keys(JSON.parse(stored)).length : 0;
    })()`);
    if (hasOverride === 0) {
      // 造一条合法覆盖：选中第一位，把第一个滑块改掉
      await session.eval(`document.querySelector('.settings-list__item').click()`);
      await sleep(700);
      await session.eval(`(() => {
        const range = document.querySelector('.score-row__range');
        range.value = '7';
        range.dispatchEvent(new Event('input', { bubbles: true }));
        range.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await sleep(1000);
    }
    const beforeClear = await session.eval(`(() => {
      const stored = window.localStorage.getItem('anime-up-match:score-overrides');
      return stored ? Object.keys(JSON.parse(stored)).length : 0;
    })()`);
    check(beforeClear >= 1, '准备了一条待清除的覆盖', `${beforeClear} 条`);

    await session.loadFresh('#/settings');
    const clearClicked = await session.eval(`(() => {
      window.confirm = () => true;
      const buttons = Array.from(document.querySelectorAll('.settings-actions .btn'));
      const clear = buttons.find((b) => /全部恢复/.test(b.textContent || ''));
      if (!clear) return 'missing';
      clear.click();
      return 'clicked';
    })()`);
    check(clearClicked === 'clicked', '「全部恢复默认」可点击', clearClicked);
    await sleep(900);

    const cleared = await session.eval(`window.localStorage.getItem('anime-up-match:score-overrides')`);
    check(!cleared || cleared === '{}', '全部恢复后覆盖被清空', cleared ?? 'null');

    /* ---------- 8. 无控制台报错 ---------- */
    console.log('\n=== 8. 控制台 ===');
    const errors = session.consoleErrors.filter((e) => !/favicon|404/i.test(e));
    check(errors.length === 0, '没有控制台报错', errors.length ? errors.slice(0, 2).join(' | ') : '干净');

    session.close();

    console.log('');
    console.log(`共 ${passed + failed} 项检查，通过 ${passed} 项。`);
    if (failed > 0) {
      console.log('❌ 有未通过项');
      process.exitCode = 1;
    } else {
      console.log('✅ 全部通过');
    }
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error('检查失败：', error.message);
  process.exit(1);
});
