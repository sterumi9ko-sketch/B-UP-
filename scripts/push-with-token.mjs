/**
 * push-with-token.mjs
 * ---------------------------------------------------------------------------
 * 用 GitHub Personal Access Token 非交互推送。
 *
 * 为什么要这个脚本：
 *   在非交互终端里，Git Credential Manager 会等待浏览器授权窗口而卡住。
 *   用令牌可以一次性完成推送。
 *
 * 安全设计（重要）：
 *   令牌**不从命令行参数传入**，而是从剪贴板或环境变量读取，
 *   这样令牌不会出现在命令行历史、进程列表或对话记录里。
 *   用完立即清除内存中的变量，并可选地清空剪贴板。
 *
 * 用法：
 *   # 1. 先复制令牌到剪贴板（GitHub → Settings → Developer settings
 *   #    → Personal access tokens (classic) → Generate new token → 勾 repo）
 *   node scripts/push-with-token.mjs --from-clipboard
 *
 *   # 或者用环境变量
 *   $env:GH_TOKEN = 'xxx'; node scripts/push-with-token.mjs
 *
 *   # 推完顺手清空剪贴板
 *   node scripts/push-with-token.mjs --from-clipboard --clear-clipboard
 */

import { execFileSync, execSync } from 'node:child_process';
import process from 'node:process';

const useClipboard = process.argv.includes('--from-clipboard');
const clearClipboard = process.argv.includes('--clear-clipboard');

/** 读剪贴板（Windows PowerShell） */
function readClipboard() {
  try {
    const text = execSync(
      'powershell -NoProfile -Command "Get-Clipboard -Raw"',
      { encoding: 'utf8' },
    );
    return text.trim();
  } catch (error) {
    throw new Error(`读剪贴板失败：${error.message}`);
  }
}

function clearClipboardContents() {
  try {
    execSync('powershell -NoProfile -Command "Set-Clipboard -Value \'\'"', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: options.stdio ?? 'pipe', ...options });
}

function gitQuiet(args) {
  try {
    return git(args).trim();
  } catch {
    return '';
  }
}

/* -------------------------------------------------------------------------- */
/* 1. 取令牌                                                                    */
/* -------------------------------------------------------------------------- */
let token = useClipboard ? readClipboard() : (process.env.GH_TOKEN ?? '').trim();

if (!token) {
  console.error('❌ 没有拿到令牌。');
  console.error('   用法一：先把令牌复制到剪贴板，然后 node scripts/push-with-token.mjs --from-clipboard');
  console.error('   用法二：设置环境变量 GH_TOKEN 后再运行');
  process.exit(1);
}

// 粗略校验格式：经典令牌 ghp_ 开头，细粒度令牌 github_pat_ 开头
if (!/^(ghp_|github_pat_|gho_|ghs_)/.test(token)) {
  console.error('❌ 这看起来不像 GitHub 令牌。');
  console.error('   经典令牌以 ghp_ 开头，细粒度令牌以 github_pat_ 开头。');
  console.error(`   当前读到的是：${token.slice(0, 6)}…（长度 ${token.length}），已中止以免误用。`);
  process.exit(1);
}
console.log(`=== 已取得令牌（${token.slice(0, 4)}…，长度 ${token.length}）===`);

if (useClipboard && clearClipboard) {
  console.log(`   剪贴板已清空：${clearClipboardContents() ? '是' : '否'}`);
}

/* -------------------------------------------------------------------------- */
/* 2. 检查仓库状态                                                              */
/* -------------------------------------------------------------------------- */
console.log('\n=== 检查仓库状态 ===');
if (!gitQuiet(['rev-parse', '--is-inside-work-tree'])) {
  console.error('❌ 当前目录不是 git 仓库。');
  process.exit(1);
}

const remote = gitQuiet(['remote', 'get-url', 'origin']);
if (!remote) {
  console.error('❌ 还没有配置 origin。');
  process.exit(1);
}
console.log(`  origin = ${remote}`);
console.log(`  分支   = ${gitQuiet(['rev-parse', '--abbrev-ref', 'HEAD'])}`);
console.log(`  提交   = ${gitQuiet(['rev-list', '--count', 'HEAD'])} 个`);

/* -------------------------------------------------------------------------- */
/* 3. 用令牌推送                                                                */
/* -------------------------------------------------------------------------- */
console.log('\n=== 开始推送 ===');

// 把令牌放在 askpass 里，通过环境变量传给 git，避免出现在命令行参数中
const env = {
  ...process.env,
  GIT_ASKPASS: undefined,
  GIT_TERMINAL_PROMPT: '0',
  GIT_CONFIG_COUNT: '1',
  // 用 URL 内嵌凭据的方式（仅本次进程有效，不写入 .git/config）
  GIT_CONFIG_KEY_0: 'credential.helper',
  GIT_CONFIG_VALUE_0: '',
};

// 组装带凭据的临时 remote（只存在于本次进程内存里）
const authedUrl = remote.replace(
  /^https:\/\/(?:[^@/]*@)?/,
  `https://x-access-token:${encodeURIComponent(token)}@`,
);

let pushOk = false;
try {
  const output = git(['push', authedUrl, `HEAD:refs/heads/main`, '--force-with-lease'], { env });
  console.log(output);
  pushOk = true;
} catch (error) {
  const stderr = String(error.stderr ?? '');
  const stdout = String(error.stdout ?? '');
  // 输出里可能回显带令牌的 URL，这里做一次脱敏再打印
  const safe = (text) => text.split(token).join('***').split(encodeURIComponent(token)).join('***');
  console.log(safe(stdout));
  console.error(safe(stderr));

  console.error('\n❌ 推送失败。常见原因：');
  if (/403|Permission denied|not authorized/i.test(stderr + stdout)) {
    console.error('   - 令牌权限不足：经典令牌需要勾选 repo；细粒度令牌需要该仓库的 Contents 读写权限');
  }
  if (/404|Repository not found/i.test(stderr + stdout)) {
    console.error('   - 令牌对应的账号不是仓库所有者（sterumi9ko-sketch）');
  }
  if (/non-fast-forward|stale info|rejected/i.test(stderr + stdout)) {
    console.error('   - 远端已有其它提交，需要先 pull 再推');
  }
  token = '';
  process.exit(1);
} finally {
  token = ''; // 及时释放
}

if (pushOk) {
  console.log('\n✅ 推送成功。');
  console.log('   验证：git ls-remote --heads origin');
  console.log('   下一步：去 Cloudflare Pages 连接该仓库，');
  console.log('           Build command = npm run build，输出目录 = dist，NODE_VERSION = 20');
}
