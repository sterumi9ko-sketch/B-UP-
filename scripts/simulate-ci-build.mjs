/**
 * simulate-ci-build.mjs
 * ---------------------------------------------------------------------------
 * 模拟「在 Cloudflare Pages 上从零构建」：把 git 跟踪的文件复制到一个干净目录，
 * 然后按 Cloudflare 的配置执行 `npm ci` + `npm run build`，
 * 看是否真的能产出 dist/。
 *
 * 为什么要做这件事：
 *   本地能构建 ≠ 云端能构建。云端没有 node_modules、没有 .npm-cache、
 *   没有未提交的文件。只有从「仓库里真实存在的内容」出发跑通，
 *   才能确定部署不会卡在构建阶段。
 *
 * 用法：node scripts/simulate-ci-build.mjs [目标目录]
 */

import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import process from 'node:process';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');
const target = process.argv[2] ?? join(os.tmpdir(), 'dsh-ci-sim');

/**
 * 执行 npm 命令并把输出直接透传给用户。
 *
 * 为什么不直接 spawn "npm"：
 *   Windows 上 npm 是 npm.cmd 批处理文件，而 Node 出于安全不允许直接 spawn
 *   .cmd（CVE-2024-27980 之后会报 EINVAL）；用 shell: true 绕过又会触发
 *   DEP0190 警告（参数不转义）。两种都不理想。
 *
 * 解法：直接用 node 执行 npm 自己的 JS 入口（npm-cli.js），
 * 既不需要 shell，也不会有任何警告。
 */
function npmEntry() {
  if (process.env.npm_execpath) return process.env.npm_execpath;

  // 从当前 node 可执行文件位置推断 npm-cli.js
  const nodeDir = dirname(process.execPath);
  const candidates = [
    join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(nodeDir, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function run(command, args, options = {}) {
  const entry = command === 'npm' ? npmEntry() : null;
  const file = entry ? process.execPath : command;
  const finalArgs = entry ? [entry, ...args] : args;

  console.log(`\n$ ${command} ${args.join(' ')}`);

  try {
    return execFileSync(file, finalArgs, {
      cwd: options.cwd,
      stdio: 'inherit',
      env: options.env ?? process.env,
    });
  } catch (error) {
    console.error(`\n（命令退出码 ${error.status ?? '未知'}：${command} ${args.join(' ')}）`);
    if (error.message) console.error(String(error.message).split('\n')[0]);
    if (error.stdout) console.error(String(error.stdout));
    if (error.stderr) console.error(String(error.stderr));
    throw error;
  }
}

function capture(command, args, cwd) {
  return execSync(`${command} ${args.join(' ')}`, { cwd, encoding: 'utf8' }).trim();
}

/* -------------------------------------------------------------------------- */
/* 1. 准备干净目录                                                              */
/* -------------------------------------------------------------------------- */
console.log(`准备干净目录：${target}`);
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

const tracked = capture('git', ['ls-files'], projectRoot).split('\n').filter(Boolean);
console.log(`仓库跟踪的文件：${tracked.length} 个`);

let copied = 0;
for (const relative of tracked) {
  const source = join(projectRoot, relative);
  const destination = join(target, relative);
  fs.mkdirSync(dirname(destination), { recursive: true });
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, destination);
    copied++;
  }
}
console.log(`已复制 ${copied} 个文件`);

// 安全检查：干净目录里不应出现这些东西
for (const forbidden of ['node_modules', 'dist', 'site', 'standalone', '.ssh-push', '.npm-cache']) {
  if (fs.existsSync(join(target, forbidden))) {
    console.error(`❌ 干净目录里出现了 ${forbidden}，说明它被提交进仓库了`);
    process.exit(1);
  }
}
console.log('✅ 干净目录里没有 node_modules / dist / site / standalone / 私钥');

/* -------------------------------------------------------------------------- */
/* 2. npm ci（Cloudflare 使用的安装方式）                                        */
/* -------------------------------------------------------------------------- */
console.log('\n=== 步骤 1/2：npm ci（模拟 Cloudflare 安装阶段）===');

/**
 * 决定 npm 用哪个缓存目录。
 * - 云端 CI：用平台默认缓存（不要干预）
 * - 本地受限沙箱：默认缓存在工作区外、可能不可写，此时用项目内缓存
 *
 * 判断方式：环境变量 DSH_* 存在说明运行在 DSH 沙箱里；
 * 也可以用 --cache <目录> 强制指定。
 */
const cacheIndex = process.argv.indexOf('--cache');
const forcedCache = cacheIndex >= 0 ? process.argv[cacheIndex + 1] : null;
const inSandbox = Object.keys(process.env).some((key) => key.startsWith('DSH_'));
// 用绝对路径，避免相对路径在不同工作目录下解析到不同位置
const cacheDir = forcedCache
  ? join(projectRoot, forcedCache)
  : inSandbox
    ? join(projectRoot, '.npm-cache')
    : null;

const ciArgs = ['ci', '--no-audit', '--no-fund'];
if (cacheDir) {
  ciArgs.push('--cache', cacheDir);
  console.log(`（受限环境：使用项目内缓存 ${cacheDir}）`);
}

try {
  run('npm', ciArgs, { cwd: target });
} catch {
  console.error('\n❌ npm ci 失败');
  console.error('   如果报 EPERM 且路径指向工作区外的 node_cache，');
  console.error('   说明当前环境不允许写默认缓存，改用：');
  console.error('     npm ci --cache ./.npm-cache');
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* 3. npm run build（Cloudflare 的 Build command）                              */
/* -------------------------------------------------------------------------- */
console.log('\n=== 步骤 2/2：npm run build（模拟 Cloudflare 构建阶段）===');
try {
  run('npm', ['run', 'build'], { cwd: target });
} catch {
  console.error('\n❌ npm run build 失败');
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* 4. 校验产物                                                                  */
/* -------------------------------------------------------------------------- */
console.log('\n=== 校验产物 ===');
const dist = join(target, 'dist');
if (!fs.existsSync(join(dist, 'index.html'))) {
  console.error('❌ dist/index.html 不存在');
  process.exit(1);
}

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const files = walk(dist);
console.log(`dist/ 共 ${files.length} 个文件：`);
for (const file of files) {
  console.log(`  ${file.slice(dist.length + 1)}  (${(fs.statSync(file).size / 1024).toFixed(1)} KB)`);
}

const html = fs.readFileSync(join(dist, 'index.html'), 'utf8');
const hasScript = /<script[^>]+src="[^"]*assets\/[^"]+\.js"/.test(html);
const hasStyle = /<link[^>]+href="[^"]*assets\/[^"]+\.css"/.test(html);
const jsExists = files.some((f) => f.endsWith('.js'));
const cssExists = files.some((f) => f.endsWith('.css'));

console.log('');
console.log(`  index.html 引用了脚本：${hasScript ? '是' : '否'}`);
console.log(`  index.html 引用了样式：${hasStyle ? '是' : '否'}`);
console.log(`  产物里有 .js：${jsExists ? '是' : '否'}`);
console.log(`  产物里有 .css：${cssExists ? '是' : '否'}`);

if (hasScript && hasStyle && jsExists && cssExists) {
  console.log('\n✅ 模拟构建成功：Cloudflare Pages 用 `npm run build` + 输出目录 `dist` 即可部署');
} else {
  console.error('\n❌ 产物不完整');
  process.exit(1);
}
