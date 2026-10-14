/**
 * verify-live.mjs
 * ---------------------------------------------------------------------------
 * 对已部署的线上站点做验收：抓取首页、逐个验证它引用的资源是否可访问、
 * 并检查占位图等静态资源，以及 GitHub Pages 那种子路径部署是否正确。
 *
 * 用法：
 *   node scripts/verify-live.mjs                        # 默认检查 b-up.pages.dev
 *   node scripts/verify-live.mjs https://你的域名
 *   node scripts/verify-live.mjs https://user.github.io/repo/
 */

const base = (process.argv[2] ?? 'https://b-up.pages.dev/').replace(/\/+$/, '') + '/';

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? `  （${detail}）` : ''}`);
}

/** 把 HTML 里的相对/绝对地址补全成完整 URL */
function resolve(url) {
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return new URL(url.replace(/^\.\//, ''), base).href;
}

async function get(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    return { status: res.status, text, url: res.url };
  } catch (error) {
    return { status: 0, text: '', error: error.message };
  }
}

async function main() {
  console.log(`检查站点：${base}\n`);

  /* ---------------- 1. 首页 ---------------- */
  console.log('=== 1. 首页 ===');
  const home = await get(base);
  if (home.status === 0) {
    check(false, '首页可访问', home.error);
    return;
  }
  check(home.status === 200, `首页 HTTP ${home.status}`, `${home.text.length} 字节`);

  const title = /<title>([\s\S]*?)<\/title>/.exec(home.text)?.[1]?.trim();
  check(Boolean(title), '页面有标题', title);
  check(!/Connection timed out|Error code 522/.test(home.text), '不是 Cloudflare 错误页');
  check(home.text.includes('id="app"'), '包含应用挂载点 #app');

  /* ---------------- 2. 首页引用的资源 ---------------- */
  console.log('\n=== 2. 首页引用的资源 ===');
  const assets = [...home.text.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg|png|webp))"/g)].map((m) => m[1]);
  check(assets.length > 0, '页面引用了外部资源', `${assets.length} 个`);

  for (const asset of assets) {
    const url = resolve(asset);
    const res = await get(url);
    check(res.status === 200, `${asset}`, `HTTP ${res.status}${res.text ? `, ${res.text.length} 字节` : ''}`);
  }

  /* ---------------- 3. 关键静态资源 ---------------- */
  console.log('\n=== 3. 静态资源 ===');
  const placeholder = await get(resolve('images/placeholders/up-placeholder.svg'));
  check(placeholder.status === 200, '占位图 images/placeholders/up-placeholder.svg', `HTTP ${placeholder.status}`);

  /* ---------------- 4. 根路径回退（哈希路由不应产生 404）---------------- */
  console.log('\n=== 4. 路由与回退 ===');
  for (const path of ['#/gallery', '#/about', '#/test']) {
    const res = await get(base + path);
    check(res.status === 200 && res.text.includes('id="app"'), `根路径 + ${path} 返回应用页面`, `HTTP ${res.status}`);
  }

  /* ---------------- 5. 子路径部署提示 ---------------- */
  const isSubpath = new URL(base).pathname.replace(/\/$/, '').length > 0;
  if (isSubpath) {
    console.log('\n=== 5. 子路径部署检查（GitHub Pages 场景）===');
    const expectedPrefix = new URL(base).pathname;
    const scriptRef = /<script[^>]+src="([^"]+)"/.exec(home.text)?.[1] ?? '';
    check(
      scriptRef.startsWith(expectedPrefix) || scriptRef.startsWith('./'),
      '资源引用与部署子路径匹配',
      `script src = ${scriptRef}`,
    );
  }

  console.log('');
  console.log(failures === 0 ? '全部检查通过' : `有 ${failures} 项未通过`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('检查失败：', err.message);
  process.exit(1);
});
