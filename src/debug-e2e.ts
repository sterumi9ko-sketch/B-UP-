/**
 * 端到端检查脚本（浏览器内运行）
 * ---------------------------------------------------------------------------
 * 用途：在不依赖单元测试环境的情况下，用真实浏览器跑一遍完整流程，
 *       验证「答题 → 计分 → 匹配 → 结果页渲染」这条链路。
 *
 * 使用方式：构建后打开 /debug.html?level=0
 *   它会自动填完全部题目、提交并跳转到结果页，便于人工查看或截图。
 *
 * 这个文件只用于开发期验证，不影响正式页面。
 */
import { QUESTIONS } from '@data/questions';
import { state } from '@state';
import type { Answers, AnswerLevel } from '@core/types';

const params = new URLSearchParams(window.location.search);
const level = Number(params.get('level') ?? '0');
const pattern = params.get('pattern') ?? 'flat';

/** 按指定规律填答案，用于构造不同的结果 */
function buildAnswers(): Answers {
  const answers: Answers = {};
  QUESTIONS.forEach((question, index) => {
    if (pattern === 'zigzag') {
      answers[question.id] = (index % 7) as AnswerLevel;
    } else if (pattern === 'mixed') {
      // 前 20 题强烈认同，后 20 题强烈不认同
      answers[question.id] = (index < 20 ? 0 : 6) as AnswerLevel;
    } else {
      answers[question.id] = Math.min(6, Math.max(0, level)) as AnswerLevel;
    }
  });
  return answers;
}

const answers = buildAnswers();

// 写入状态并提交
for (const [id, value] of Object.entries(answers)) {
  state.answer(id, value);
}
state.submit();

const outcome = state.outcome;

// 页面右上角显示一个简短的检查结果，方便截图确认数据是真的算出来的
const box = document.createElement('div');
box.style.cssText =
  'position:fixed;right:12px;bottom:12px;z-index:999;background:#2F2A25;color:#fff;font:12px/1.6 ui-monospace,monospace;padding:10px 12px;border-radius:10px;max-width:46ch;white-space:pre-wrap';
box.textContent = [
  '端到端检查',
  `作答规律: ${pattern}${pattern === 'flat' ? ' / level=' + level : ''}`,
  `完成度: ${(outcome?.completion ?? 0).toFixed(2)}`,
  `最佳匹配: ${outcome?.best.up.name} (${outcome?.best.similarity})`,
  `前三名: ${outcome?.top3.map((m) => `${m.up.name}:${m.similarity}`).join('  ')}`,
  `风格标签: ${outcome?.styleTags.join(' / ')}`,
  `数据提示: ${outcome?.dataNotice ?? '无'}`,
].join('\n');
document.body.append(box);

// 跳到结果页
window.location.hash = '#/result';

// 问题检查：把任何控制台错误显示出来
window.addEventListener('error', (event) => {
  box.textContent += `\n\n!! 运行时错误: ${event.message}`;
  box.style.background = '#B0442F';
});
