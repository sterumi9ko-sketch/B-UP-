import type {
  Answers,
  AnswerLevel,
  DimensionId,
  DimensionScores,
  Question,
  UpCategory,
  UpProfile,
} from '../src/core/types';
import { DIMENSION_IDS } from '../src/core/dimensions';

/** 测试用题目规格 */
export interface DimensionSpec {
  id: DimensionId;
  forward: number;
  reverse: number;
}

/**
 * 按规格生成一小套测试题（不依赖正式题库，方便构造极端情况）。
 */
export function scaleTestSet(specs: DimensionSpec[]): Question[] {
  const questions: Question[] = [];
  let n = 0;
  for (const spec of specs) {
    for (let i = 0; i < spec.forward; i++) {
      questions.push({ id: `f${++n}`, text: `${spec.id} 正向题 ${i + 1}`, dimension: spec.id, weight: 1, reverse: false });
    }
    for (let i = 0; i < spec.reverse; i++) {
      questions.push({ id: `r${++n}`, text: `${spec.id} 反向题 ${i + 1}`, dimension: spec.id, weight: 1, reverse: true });
    }
  }
  return questions;
}

/** 给所有题目填同一个选项 */
export function dotAnswers(questions: Question[], level: AnswerLevel): Answers {
  const answers: Answers = {};
  for (const q of questions) answers[q.id] = level;
  return answers;
}

/** 完整的 8 维分数向量（缺省 50 分） */
export function fullScores(partial: Partial<DimensionScores> = {}): DimensionScores {
  const scores = {} as DimensionScores;
  for (const id of DIMENSION_IDS) scores[id] = partial[id] ?? 50;
  return scores;
}

/** 构造测试用 UP 主 */
export function makeUp(
  uid: number,
  scores: Partial<DimensionScores>,
  overrides: Partial<UpProfile> = {},
): UpProfile {
  return {
    id: `up_test_${uid}`,
    uid,
    name: `测试UP${uid}`,
    category: '动画杂谈与评论' as UpCategory,
    tags: ['测试'],
    summary: '测试用档案',
    intro: '测试用档案',
    contentFocus: '测试',
    observedStyle: ['测试'],
    scores: fullScores(scores),
    scoreRationale: '测试',
    sources: [{ label: 'test', url: `https://space.bilibili.com/${uid}` }],
    verification: 'verified',
    matchable: true,
    ...overrides,
  };
}
