/**
 * push-via-deploy-key.mjs
 * ---------------------------------------------------------------------------
 * 用项目内的专用部署密钥（.ssh-push/id_ed25519）通过 SSH 推送。
 *
 * 为什么需要它：
 *   在某些非交互终端里，Git Credential Manager 弹不出浏览器授权窗口，
 *   HTTPS 推送会卡住。SSH + 部署密钥可以绕开浏览器交互：
 *   只要把公钥加到 GitHub 一次，之后可以一直非交互推送。
 *
 * 安全说明：
 *   - 私钥位于 .ssh-push/id_ed25519，已加入 .gitignore 与 .git/info/exclude，
 *     不会被提交到仓库
 *   - 脚本只使用这一份密钥（IdentitiesOnly=yes），不会去动你其它的 SSH 配置
 *
 * 用法：
 *   node scripts/push-via-deploy-key.mjs          # 推送到 origin
 *   node scripts/push-via-deploy-key.mjs --check  # 只测 SSH 连通性，不推送
 *   node scripts/push-via-deploy-key.mjs --force  # 本地改写过历史（amend 过）时使用
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const checkOnly = process.argv.includes('--check');
const forcePush = process.argv.includes('--force');

const KEY = '.ssh-push/id_ed25519';
const KNOWN_HOSTS = '.ssh-push/known_hosts';

if (!fs.existsSync(KEY)) {
  console.error(`❌ 找不到部署密钥：${KEY}`);
  console.error('   请先在项目根目录生成：');
  console.error('   ssh-keygen -t ed25519 -f .ssh-push/id_ed25519 -N "" -C "deploy-key"');
  process.exit(1);
}

const sshOptions = [
  '-i',
  KEY,
  '-o',
  'IdentitiesOnly=yes',
  '-o',
  'StrictHostKeyChecking=accept-new',
  ...(fs.existsSync(KNOWN_HOSTS) ? ['-o', `UserKnownHostsFile=${KNOWN_HOSTS}`] : []),
];

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe', ...options });
}

/** 让所有走 origin 的 git 命令都用这份密钥与 known_hosts，避免 Host key verification failed */
const gitSshCommand = `ssh ${sshOptions.join(' ')}`;
const gitArgs = (args) => ['-c', `core.sshCommand=${gitSshCommand}`, ...args];

/* -------------------------------------------------------------------------- */
/* 1. 测试 SSH 连通性                                                           */
/* -------------------------------------------------------------------------- */
console.log('=== 测试 SSH 连通性 ===');
let sshOk = false;
try {
  const out = run('ssh', [...sshOptions, '-T', 'git@github.com']);
  console.log(out.trim());
  sshOk = true;
} catch (error) {
  // ssh -T 成功时返回 1 并把问候语写在 stderr，所以这里要同时看两边
  const text = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  if (/successfully authenticated|Hi .+!/.test(text)) {
    console.log(text.trim());
    console.log('✅ 部署密钥已被 GitHub 接受');
    sshOk = true;
  } else if (/Permission denied \(publickey\)/.test(text)) {
    console.error('❌ 仍被拒绝：公钥还没有加到 GitHub 仓库的 Deploy keys');
    console.error('   请把下面这行的内容粘贴到：');
    console.error('   https://github.com/sterumi9ko-sketch/B-UP-/settings/keys');
    console.error('   （标题随便填，务必勾选 “Allow write access”）');
    console.error('');
    console.error(fs.readFileSync(`${KEY}.pub`, 'utf8').trim());
  } else {
    console.error(text.trim() || error.message);
  }
}

if (checkOnly || !sshOk) {
  process.exit(sshOk ? 0 : 1);
}

/* -------------------------------------------------------------------------- */
/* 2. 推送                                                                      */
/* -------------------------------------------------------------------------- */
console.log('\n=== 推送 main 分支 ===');
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
console.log(`  分支：${branch}`);

try {
  const out = run('git', gitArgs(['push', '-u', ...(forcePush ? ['--force-with-lease'] : []), 'origin', branch]));
  console.log(out.trim());
} catch (error) {
  console.error(String(error.stdout ?? ''));
  console.error(String(error.stderr ?? ''));
  const text = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  if (/read only/i.test(text)) {
    console.error('\n❌ 推送失败：这个部署密钥是只读的。');
    console.error('   去仓库的 Settings → Deploy keys，编辑该 key，勾上 “Allow write access”。');
  } else {
    console.error('\n❌ 推送失败');
  }
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* 3. 验证远端确实收到（fetch 回本地比对，不依赖 API 缓存）                        */
/* -------------------------------------------------------------------------- */
const localHead = run('git', ['rev-parse', 'HEAD']).trim();
console.log('\n=== 验证远端 ===');
try {
  run('git', gitArgs(['fetch', 'origin', branch]));
  const remoteHead = run('git', ['rev-parse', 'FETCH_HEAD']).trim();
  const fileCount = run('git', ['ls-tree', '-r', '--name-only', 'FETCH_HEAD'])
    .split('\n')
    .filter(Boolean).length;

  console.log(`  远端 refs=${remoteHead.slice(0, 7)}  本地 HEAD=${localHead.slice(0, 7)}`);
  console.log(`  远端文件数：${fileCount}`);

  if (remoteHead === localHead) {
    console.log('\n✅ 推送成功，远端与本地完全一致。');
    console.log('   仓库地址：https://github.com/sterumi9ko-sketch/B-UP-');
  } else {
    console.log('\n⚠️ 远端与本地 HEAD 不一致，请检查是否有多人推送。');
    process.exit(1);
  }
} catch (error) {
  console.log(String(error.stderr ?? error.message));
  console.log('\n⚠️ 推送命令已执行，但验证步骤失败（可能只是网络波动）。');
  console.log('   可手动验证：git ls-remote --heads origin');
}
