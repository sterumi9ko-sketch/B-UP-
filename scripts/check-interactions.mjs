/**
 * check-interactions.mjs
 * ---------------------------------------------------------------------------
 * 用真实 Chrome（DevTools 协议）把答题交互完整跑一遍。
 *
 * 和单元测试的区别：单元测试验证纯函数，这里验证**真实浏览器里点下去会发生什么**：
 *   1. 点圆点后是否被记录
 *   2. 自动跳下一题是否真的生效；关掉开关后是否不再自动跳
 *   3. 上一题 / 下一题是否保留已选答案
 *   4. 题目速览能否跳转
 *   5. 未答完时点提交是否被拦住并跳到未作答的题
 *   6. 答完 40 题后是否出现「查看我的 UP 主匹配结果」
 *   7. 提交后结果页是否真的算出来了（最佳匹配、前三名、雷达图、分享图）
 *   8. 刷新页面后进度是否恢复（localStorage）
 *   9. 键盘方向键能否操作圆点
 *  10. 控制台是否有报错
 *
 * 用法：node scripts/check-interactions.mjs --base http://localhost:4173
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
const PORT = 9400 + Math.floor(Math.random() * 90);
/** 页面文件名；用 file:// 打开时必须写全 index.html，否则会打开目录列表 */
const PAGE = getArg('--page', 'index.html');
const TOTAL = 40;

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* 继续找 */
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

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('WebSocket 连接失败')), { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const consoleErrors = [];

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(message.params?.exceptionDetails?.text ?? '未知异常');
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') {
      consoleErrors.push(
        (message.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200),
      );
    }
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

  /** 在页面里求值并取回 JSON 结果 */
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression: `(() => { ${expression} })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`页面内求值抛错：${result.exceptionDetails.text}`);
    }
    return result.result?.value;
  };

  return { send, evaluate, close: () => ws.close(), consoleErrors };
}

/* -------------------------------------------------------------------------- */
/* 测试断言                                                                    */
/* -------------------------------------------------------------------------- */

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  const mark = condition ? '✅' : '❌';
  console.log(`${mark} ${name}${detail ? `  （${detail}）` : ''}`);
}

async function main() {
  const browser = findBrowser();
  if (!browser) {
    console.log('没有找到 Chrome/Edge，跳过交互检查。');
    return;
  }

  const userDataDir = fs.mkdtempSync(join(os.tmpdir(), 'dsh-interact-'));
  const child = spawn(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1280,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

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

    const target = await getJson('/json/new?about:blank', { method: 'PUT' });
    const client = await connect(target.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    /* ---------------- 打开答题页并清空旧进度 ---------------- */
    await client.send('Page.navigate', { url: `${BASE}/${PAGE}#/test` });
    await sleep(2500);
    await client.evaluate(`localStorage.clear(); return true;`);
    await client.send('Page.navigate', { url: `${BASE}/${PAGE}#/test` });
    await sleep(2500);

    const counters = () =>
      client.evaluate(`
        const el = document.querySelector('.quiz__counter');
        const items = [...document.querySelectorAll('.quiz__counter')].map((n) => n.textContent.trim());
        return JSON.stringify({
          actionsCounter: el ? el.textContent.trim() : null,
          all: items,
          answered: document.querySelector('.progress__legend span')?.textContent.trim() ?? null,
          title: document.querySelector('.question-card__index')?.textContent.trim() ?? null,
        });
      `);

    let info = JSON.parse(await counters());
    check('答题页初始显示第 1 题', info.title?.includes('第 1 题'), info.title);
    check('答题页初始进度为 0/40', info.answered?.includes('0 / 40'), info.answered);
    check('渲染出 7 个作答圆点', (await client.evaluate(`return document.querySelectorAll('.scale__item').length;`)) === 7);

    /* ---------------- 1. 点击圆点是否被记录 ---------------- */
    await client.evaluate(`
      document.querySelectorAll('.scale__item')[0].click();
      return true;
    `);
    await sleep(120);
    const afterFirstClick = JSON.parse(await counters());
    check('点击圆点后进度变为 1/40', afterFirstClick.answered?.includes('1 / 40'), afterFirstClick.answered);

    /* ---------------- 2. 自动跳转到下一题 ---------------- */
    await sleep(600); // 等自动前进的 320ms 定时器
    const afterAuto = JSON.parse(await counters());
    check('选择后自动进入第 2 题', afterAuto.title?.includes('第 2 题'), afterAuto.title);

    /* ---------------- 3. 返回上一题是否保留答案 ---------------- */
    await client.evaluate(`
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '上一题').click();
      return true;
    `);
    await sleep(500);
    const backInfo = JSON.parse(
      await client.evaluate(`
        const selected = document.querySelector('.scale__item[aria-checked="true"]');
        return JSON.stringify({
          title: document.querySelector('.question-card__index')?.textContent.trim() ?? null,
          selectedLabel: selected ? selected.querySelector('.scale__label')?.textContent.trim() : null,
          status: document.querySelector('.scale__status')?.textContent.trim() ?? null,
        });
      `),
    );
    check('上一题回到第 1 题', backInfo.title?.includes('第 1 题'), backInfo.title);
    check('上一题保留原来的选择', backInfo.selectedLabel === '完全认同', `选中的是「${backInfo.selectedLabel}」`);
    check('状态文字显示当前选择', backInfo.status?.includes('完全认同'), backInfo.status);

    /* ---------------- 4. 关闭自动前进后不应再跳题 ---------------- */
    await client.evaluate(`
      const toggle = document.getElementById('auto-advance');
      if (toggle.checked) toggle.click();
      return toggle.checked;
    `);
    await client.evaluate(`
      document.querySelectorAll('.scale__item')[2].click();
      return true;
    `);
    await sleep(700);
    const noAuto = JSON.parse(await counters());
    check('关闭自动前进后停留在第 1 题', noAuto.title?.includes('第 1 题'), noAuto.title);
    check('关闭自动前进后仍记录了答案', noAuto.answered?.includes('1 / 40'), noAuto.answered);

    /* ---------------- 5. 键盘方向键操作圆点 ---------------- */
    await client.evaluate(`
      document.querySelector('.scale__item[aria-checked="true"]').focus();
      return true;
    `);
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await sleep(200);
    const afterKey = JSON.parse(
      await client.evaluate(`
        const selected = document.querySelector('.scale__item[aria-checked="true"]');
        const focused = document.activeElement;
        return JSON.stringify({
          selectedLabel: selected ? selected.querySelector('.scale__label')?.textContent.trim() : null,
          focusedIsDot: focused?.classList?.contains('scale__item') ?? false,
        });
      `),
    );
    check('方向键可以切换选项', afterKey.selectedLabel === '中立', `现在是「${afterKey.selectedLabel}」`);
    check('方向键切换后焦点仍在圆点上', afterKey.focusedIsDot === true);

    /* ---------------- 6. 恢复自动前进 ---------------- */
    await client.evaluate(`
      const toggle = document.getElementById('auto-advance');
      if (!toggle.checked) toggle.click();
      return toggle.checked;
    `);

    /* ---------------- 7. 未答完时提交应被拦住 ---------------- */
    // 先跳到最后一题（用题目速览）
    await client.evaluate(`
      const details = document.querySelector('details');
      details.open = true;
      return true;
    `);
    await sleep(200);
    await client.evaluate(`
      const items = [...document.querySelectorAll('.question-grid__item')];
      items[items.length - 1].click();
      return true;
    `);
    await sleep(500);
    const lastInfo = JSON.parse(await counters());
    check('题目速览可以跳到最后一题', lastInfo.title?.includes('第 40 题'), lastInfo.title);

    const lastButtonText = await client.evaluate(`
      const buttons = [...document.querySelectorAll('button')];
      const next = buttons.find((b) => b.textContent.includes('检查未答完') || b.textContent.includes('查看我的'));
      return next ? next.textContent.trim() : null;
    `);
    check('未答完时按钮提示检查未答完的题目', lastButtonText?.includes('检查未答完'), lastButtonText);

    await client.evaluate(`
      const buttons = [...document.querySelectorAll('button')];
      const next = buttons.find((b) => b.textContent.includes('检查未答完'));
      next.click();
      return true;
    `);
    await sleep(600);
    const jumpedInfo = JSON.parse(await counters());
    const jumpedToUnanswered = !jumpedInfo.title?.includes('第 40 题');
    check('点提交会跳到第一道未作答的题目', jumpedToUnanswered, jumpedInfo.title);
    check('此时仍在答题页（没有产生结果）', !(await client.evaluate(`return location.hash.includes('result');`)));

    /* ---------------- 8. 答完全部 40 题 ---------------- */
    // 关闭自动前进，这样节奏完全由脚本控制，不会出现"点完圆点又被自动跳走"的错位
    await client.evaluate(`
      const toggle = document.getElementById('auto-advance');
      if (toggle.checked) toggle.click();
      return toggle.checked;
    `);

    let guard = 0;
    let answeredEveryQuestion = true;
    while (guard++ < 300) {
      const state = JSON.parse(
        await client.evaluate(`
          const selected = document.querySelector('.scale__item[aria-checked="true"]');
          const done = document.querySelector('.progress__legend span')?.textContent.trim() ?? '';
          return JSON.stringify({ done, hasAnswer: Boolean(selected) });
        `),
      );
      if (state.done.includes('40 / 40')) break;

      // 每题都必须先作答再前进，这样 40 题都会被真正点过一次
      if (!state.hasAnswer) {
        const level = guard % 7;
        await client.evaluate(`document.querySelectorAll('.scale__item')[${level}].click(); return true;`);
        await sleep(180);
      } else {
        // 已作答：推进到下一题；如果在最后一题且已答完，循环条件会在下一轮退出
        const advanced = await client.evaluate(`
          const next = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('下一题'));
          if (next) { next.click(); return true; }
          return false;
        `);
        if (!advanced) {
          // 最后一题且已作答：直接检查完成度
          const done = await client.evaluate(
            `return document.querySelector('.progress__legend span')?.textContent.trim() ?? '';`,
          );
          if (!done.includes('40 / 40')) answeredEveryQuestion = false;
          break;
        }
        await sleep(180);
      }
    }

    check('每一道题都是通过点击圆点作答的', answeredEveryQuestion === true);

    const finished = JSON.parse(await counters());
    check('40 题全部作答完成', finished.answered?.includes('40 / 40'), finished.answered);

    const submitLabel = await client.evaluate(`
      const buttons = [...document.querySelectorAll('button')];
      const next = buttons.find((b) => b.textContent.includes('查看我的') || b.textContent.includes('检查未答完'));
      return next ? next.textContent.trim() : null;
    `);
    check('答完后按钮变为「查看我的 UP 主匹配结果」', submitLabel?.includes('查看我的'), submitLabel);

    /* ---------------- 9. 刷新后进度恢复 ---------------- */
    const beforeReload = await client.evaluate(`
      const saved = localStorage.getItem('anime-up-match:progress');
      return saved ? JSON.parse(saved).answers ? Object.keys(JSON.parse(saved).answers).length : 0 : 0;
    `);
    check('localStorage 里保存了 40 条答案', beforeReload === TOTAL, `实际 ${beforeReload} 条`);

    await client.send('Page.navigate', { url: `${BASE}/${PAGE}#/test` });
    await sleep(2500);
    const afterReload = JSON.parse(await counters());
    check('刷新后进度仍然是 40/40', afterReload.answered?.includes('40 / 40'), afterReload.answered);

    /* ---------------- 10. 提交并检查结果页 ---------------- */
    await client.evaluate(`
      const next = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('查看我的'));
      next.click();
      return true;
    `);
    await sleep(3500);

    const result = JSON.parse(
      await client.evaluate(`
        return JSON.stringify({
          hash: location.hash,
          name: document.querySelector('.result-hero__name')?.textContent.trim() ?? null,
          score: document.querySelector('.score-ring__value')?.textContent.trim() ?? null,
          podium: document.querySelectorAll('.podium__card').length,
          canvas: document.querySelectorAll('canvas').length,
          shareImage: Boolean(document.querySelector('.share-preview img')),
          caption: (document.querySelector('.share-caption')?.value ?? '').slice(0, 40),
          tags: [...document.querySelectorAll('.tag--accent')].map((t) => t.textContent.trim()),
          bars: document.querySelectorAll('.bar-row').length,
          diffRows: document.querySelectorAll('.diff-table tbody tr').length,
          disclaimer: document.body.innerText.includes('娱乐性质的创作风格匹配'),
          reasonText: document.querySelector('.card li')?.textContent.trim() ?? '',
        });
      `),
    );

    check('提交后跳转到结果页', result.hash.includes('result'), result.hash);
    check('结果页显示了最佳匹配昵称', Boolean(result.name), result.name);
    check('风格相似指数已渲染', Number(result.score) > 0, result.score);
    check('前三名卡片数量为 3', result.podium === 3, `实际 ${result.podium}`);
    check('雷达图 canvas 存在', result.canvas >= 1, `实际 ${result.canvas}`);
    check('分享图已自动生成', result.shareImage === true);
    check('分享文案已填充', result.caption.length > 0, result.caption);
    check('风格标签已渲染', result.tags.length >= 2, result.tags.join(' / '));
    check('维度评分条数量为 8', result.bars === 8, `实际 ${result.bars}`);
    check('逐维度对比表有 8 行', result.diffRows === 8, `实际 ${result.diffRows}`);
    check('匹配理由有内容', result.reasonText.length > 5, result.reasonText.slice(0, 30));
    check('页面包含免责声明', result.disclaimer === true);

    /* ---------------- 11. 排行榜内部一致性 ---------------- */
    const consistency = JSON.parse(
      await client.evaluate(`
        const scores = [...document.querySelectorAll('.podium__score')].map((el) => {
          const m = el.textContent.match(/([0-9]+\\.[0-9]+)/);
          return m ? Number(m[1]) : null;
        });
        return JSON.stringify({ scores });
      `),
    );
    const sortedOk =
      consistency.scores.length === 3 &&
      consistency.scores[0] >= consistency.scores[1] &&
      consistency.scores[1] >= consistency.scores[2];
    check('前三名按相似指数降序排列', sortedOk, consistency.scores.join(' ≥ '));

    /* ---------------- 12. 控制台错误 ---------------- */
    check('整个流程没有控制台报错', client.consoleErrors.length === 0, client.consoleErrors.slice(0, 2).join(' | '));

    client.close();
    await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`, { headers: { Host: 'localhost' } });

    /* ---------------- 汇总 ---------------- */
    const failed = results.filter((r) => !r.ok);
    console.log(`\n共 ${results.length} 项检查，通过 ${results.length - failed.length} 项。`);
    if (failed.length) {
      console.log('未通过：');
      for (const item of failed) console.log(`  ❌ ${item.name}  ${item.detail}`);
      process.exitCode = 1;
    } else {
      console.log('✅ 全部通过');
    }
  } finally {
    child.kill();
  }
}

main().catch((err) => {
  console.error('交互检查失败：', err.message);
  process.exit(1);
});
