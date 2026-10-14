/**
 * push-to-github.mjs
 * ---------------------------------------------------------------------------
 * 把本地仓库连接到你的 GitHub 仓库并推送（第一次会触发浏览器登录）。
 *
 * 用法（在项目根目录执行）：
 *   node scripts/push-to-github.mjs https://github.com/你的用户名/仓库名.git
 *   node scripts/push-to-github.mjs 你的用户名/仓库名          # 简写也行
 *
 * 它会做三件事：
 *   1. 检查 git 身份（user.name / user.email）是否已配置，没配就提示你怎么配
 *   2. 设置/更新 remote origin
 *   3. 推送 main 分支（推送时 Git Credential Manager 会弹出浏览器让你登录 GitHub）
 *
 * 它不会替你创建 GitHub 上的仓库 —— 仓库需要你先在网页上建好（空仓库，不要加 README）。
 */

import { execSync } from 'node:child_process';
import process from 'node:process';

const raw = process.argv[2];

if (!raw) {
  console.error('用法：node scripts/push-to-github.mjs <仓库地址或 用户名/仓库名>');
  console.error('例如：node scripts/push-to-github.mjs myname/anime-up-match');
  process.exit(1);
}

/** 把 用户名/仓库名 简写补全成完整地址 */
function toRemoteUrl(input) {
  if (/^git@/.test(input)) return input.replace(/\/+$/, '').replace(/\.git$/, '') + '.git';

  if (/^https?:\/\//i.test(input)) {
    const url = input.replace(/\/+$/, '');
    // 以 .git 结尾（且不是仓库名本身就叫 xxx.git/ 的怪情况）时保持原样
    return /\.git$/i.test(url) ? url : `${url}.git`;
  }

  if (/^[\w.-]+\/[\w.-]+$/.test(input)) return `https://github.com/${input}.git`;

  throw new Error(`看不懂这个地址：${input}`);
}

/** 执行命令并把输出原样透传（推送时的登录提示要让你看到） */
function run(command, { quiet = false, allowFail = false } = {}) {
  try {
    return execSync(command, {
      stdio: quiet ? 'pipe' : 'inherit',
      encoding: 'utf8',
    });
  } catch (error) {
    if (allowFail) return null;
    console.error(`\n❌ 命令失败：${command}`);
    if (error.stdout) console.error(String(error.stdout));
    process.exit(1);
  }
}

function output(command) {
  try {
    return execSync(command, { stdio: 'pipe', encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const remote = toRemoteUrl(raw);

console.log('=== 1/4 检查仓库状态 ===');
if (!output('git rev-parse --is-inside-work-tree')) {
  console.error('❌ 当前目录不是 git 仓库。请先执行：git init -b main');
  process.exit(1);
}
console.log(`  当前分支：${output('git rev-parse --abbrev-ref HEAD')}`);
console.log(`  提交数量：${output('git rev-list --count HEAD') || 0}`);

console.log('\n=== 2/4 检查提交身份 ===');
const name = output('git config user.name');
const email = output('git config user.email');
if (!name || !email) {
  console.error('❌ 还没有配置提交身份，请先运行下面两行（换成你自己的）：');
  console.error('');
  console.error('   git config --global user.name "你的名字"');
  console.error('   git config --global user.email "你的邮箱"');
  console.error('');
  console.error('   提示：邮箱建议用 GitHub 账号里的邮箱，或者用隐私邮箱');
  console.error('   形如 12345678+你的用户名@users.noreply.github.com（在 GitHub 设置里能看到）。');
  process.exit(1);
}
console.log(`  user.name  = ${name}`);
console.log(`  user.email = ${email}`);

console.log('\n=== 3/4 设置 remote origin ===');
const existing = output('git remote get-url origin');
if (existing) {
  console.log(`  已有 origin：${existing}`);
  if (existing !== remote) {
    run(`git remote set-url origin "${remote}"`);
    console.log(`  已更新为：${remote}`);
  } else {
    console.log('  与目标一致，无需修改。');
  }
} else {
  run(`git remote add origin "${remote}"`);
  console.log(`  已添加：${remote}`);
}

console.log('\n=== 4/4 推送到 GitHub ===');
console.log('  如果这是第一次推送，会弹出浏览器让你登录 GitHub 并授权。');
console.log('  登录一次之后，Git Credential Manager 会把凭据存好，以后不用再登录。');
console.log('');

const branch = output('git rev-parse --abbrev-ref HEAD') || 'main';
run(`git push -u origin ${branch}`);

console.log('\n✅ 推送完成。');
console.log('   接下来可以去 Cloudflare Pages 连接这个仓库，构建配置：');
console.log('     Build command          = npm run build');
console.log('     Build output directory = dist');
console.log('     环境变量                NODE_VERSION = 20');
console.log('   详细步骤见 docs/DEPLOY.md');
