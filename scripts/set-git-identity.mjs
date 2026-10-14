/**
 * set-git-identity.mjs
 * ---------------------------------------------------------------------------
 * 配置 git 提交身份，并（可选）把仓库里已有的提交改成你的身份。
 *
 * 为什么需要这个脚本：
 *   本项目初始化时机器上还没有任何 git 身份配置，为了先把仓库建起来，
 *   首次提交用了一个占位身份。这个脚本帮你一次性换回自己的名字和邮箱。
 *
 * 用法（在项目根目录执行）：
 *   node scripts/set-git-identity.mjs "你的名字" "你的邮箱"
 *   node scripts/set-git-identity.mjs "你的名字" "你的邮箱" --global   # 同时设为全局默认
 *
 * 说明：
 *   - 名字里有空格或中文都没问题（用引号包起来即可）
 *   - 邮箱建议用 GitHub 账号里的邮箱；不想暴露真实邮箱可以用
 *     形如 12345678+用户名@users.noreply.github.com 的隐私邮箱
 *   - 默认只改当前仓库的配置（不动你的全局 git 设置）
 *   - 会用 --reset-author 把已有提交的作者信息一并改掉
 */

import { execFileSync } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2).filter((a) => a !== '--global');
const useGlobal = process.argv.includes('--global');
const [name, email] = args;

if (!name || !email) {
  console.error('用法：node scripts/set-git-identity.mjs "你的名字" "你的邮箱" [--global]');
  console.error('例如：node scripts/set-git-identity.mjs "张三" "zhangsan@example.com"');
  process.exit(1);
}

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`邮箱格式看着不太对：${email}`);
  process.exit(1);
}

/** 用 execFileSync 传参数组，避免引号/中文被 shell 二次解析 */
function git(...gitArgs) {
  return execFileSync('git', gitArgs, { stdio: 'inherit' });
}

function gitOutput(...gitArgs) {
  try {
    return execFileSync('git', gitArgs, { stdio: 'pipe', encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

if (!gitOutput('rev-parse', '--is-inside-work-tree')) {
  console.error('❌ 当前目录不是 git 仓库。请先在项目根目录执行。');
  process.exit(1);
}

const scope = useGlobal ? '--global' : '--local';
console.log(`=== 设置提交身份（${useGlobal ? '全局' : '仅当前仓库'}）===`);
git('config', scope, 'user.name', name);
git('config', scope, 'user.email', email);
console.log(`  user.name  = ${gitOutput('config', 'user.name')}`);
console.log(`  user.email = ${gitOutput('config', 'user.email')}`);

const commitCount = Number(gitOutput('rev-list', '--count', 'HEAD') || 0);
if (commitCount > 0) {
  console.log(`\n=== 把已有 ${commitCount} 个提交的作者信息改成你的 ===`);
  // 用环境变量传入作者/提交者信息，再 --reset-author 让提交采用新身份
  execFileSync('git', ['commit', '--amend', '--no-edit', '--reset-author'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: name,
      GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: name,
      GIT_COMMITTER_EMAIL: email,
    },
  });
  console.log('\n=== 改完后的提交记录 ===');
  console.log(gitOutput('log', '--format=%h  %an <%ae>  %s'));
} else {
  console.log('\n（仓库里还没有提交，无需修改作者信息）');
}

console.log('\n✅ 完成。下一步：');
console.log('   1. 在 GitHub 网页创建一个空仓库（不要勾选 README/.gitignore/license）');
console.log('   2. 执行：node scripts/push-to-github.mjs 你的用户名/仓库名');
console.log('   详细说明见 docs/GITHUB.md');
