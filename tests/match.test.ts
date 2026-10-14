import { describe, expect, it } from 'vitest';
import { DIMENSIONS, DIMENSION_IDS } from '../src/core/dimensions';
import {
  buildRanking,
  buildStyleTags,
  computeDimensionRanges,
  computeRawScores,
  normalizeRawScores,
  scoreTest,
} from '../src/core/scoring';
import { evaluateTest } from '../src/core/match';
import { QUESTIONS } from '../src/data/questions';
import { dotAnswers, fullScores, makeUp, scaleTestSet } from './helpers';
import type { Answers, DimensionId, Question } from '../src/core/types';

describe('正式题库：结构检查', () => {
  it('题目数量不少于 30 道（当前为 40 道）', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(30);
    expect(QUESTIONS.length).toBe(40);
  });

  it('题目 id 唯一', () => {
    const ids = new Set(QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(QUESTIONS.length);
  });

  it('每道题的维度都合法、权重为正', () => {
    for (const q of QUESTIONS) {
      expect(DIMENSION_IDS).toContain(q.dimension);
      expect(q.weight).toBeGreaterThan(0);
      expect(typeof q.reverse).toBe('boolean');
      expect(q.text.length).toBeGreaterThan(6);
    }
  });

  it('40 道题在 8 个维度上分布均衡（每维度 5 题）', () => {
    const counts = Object.fromEntries(DIMENSION_IDS.map((id) => [id, 0])) as Record<DimensionId, number>;
    for (const q of QUESTIONS) counts[q.dimension] += 1;
    for (const id of DIMENSION_IDS) expect(counts[id]).toBe(5);
  });

  it('包含足量反向题（不低于 20%）', () => {
    const reverse = QUESTIONS.filter((q) => q.reverse).length;
    expect(reverse / QUESTIONS.length).toBeGreaterThanOrEqual(0.2);
  });

  it('每个维度都至少有一道反向题', () => {
    for (const id of DIMENSION_IDS) {
      const inDim = QUESTIONS.filter((q) => q.dimension === id);
      expect(inDim.some((q) => q.reverse)).toBe(true);
    }
  });

  it('8 个维度都有操作性定义与高低分说明', () => {
    expect(DIMENSIONS.length).toBe(8);
    for (const d of DIMENSIONS) {
      expect(d.definition.length).toBeGreaterThan(10);
      expect(d.highMeans.length).toBeGreaterThan(6);
      expect(d.lowMeans.length).toBeGreaterThan(6);
      expect(d.short.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('计分：极端与中立作答', () => {
  const spec = [
    { id: 'humor' as DimensionId, forward: 5, reverse: 0 },
    { id: 'research' as DimensionId, forward: 0, reverse: 5 },
  ];
  const questions = scaleTestSet(spec);

  it('全选完全认同：正向维度 100 分，反向维度 0 分', () => {
    const answers = Object.fromEntries(questions.map((q) => [q.id, 0])) as Answers;
    const result = scoreTest(questions, answers);
    expect(result.normalized.humor).toBe(100);
    expect(result.normalized.research).toBe(0);
  });

  it('全选完全不认同：正向维度 0 分，反向维度 100 分', () => {
    const answers = Object.fromEntries(questions.map((q) => [q.id, 6])) as Answers;
    const result = scoreTest(questions, answers);
    expect(result.normalized.humor).toBe(0);
    expect(result.normalized.research).toBe(100);
  });

  it('全选中立：所有维度都是 50 分', () => {
    const answers = Object.fromEntries(questions.map((q) => [q.id, 3])) as Answers;
    const result = scoreTest(questions, answers);
    for (const id of DIMENSION_IDS) {
      if (result.normalized[id] === undefined) continue;
      expect(result.normalized[id]).toBe(50);
    }
  });
});

describe('计分：原始分与权重', () => {
  it('原始分等于 分值 × 权重 的累加（反向题取反）', () => {
    const questions: Question[] = [
      { id: 'a', text: '正向题测试', dimension: 'humor', weight: 2, reverse: false },
      { id: 'b', text: '反向题测试', dimension: 'humor', weight: 1, reverse: true },
    ];
    const answers: Answers = { a: 0, b: 0 }; // 完全认同
    const raw = computeRawScores(questions, answers);
    expect(raw.humor).toBe(2 * 3 + 1 * -3); // 6 - 3 = 3
  });

  it('未作答的题目不计入，完成度正确', () => {
    const questions: Question[] = [
      { id: 'a', text: '题目一测试', dimension: 'humor', weight: 1, reverse: false },
      { id: 'b', text: '题目二测试', dimension: 'humor', weight: 1, reverse: false },
    ];
    const result = scoreTest(questions, { a: 0 });
    expect(result.answeredCount).toBe(1);
    expect(result.completion).toBe(0.5);
  });

  it('维度分数范围基于已作答题目计算，中立作答仍为 50', () => {
    const questions: Question[] = [{ id: 'a', text: '题目测试', dimension: 'humor', weight: 1, reverse: false }];
    const ranges = computeDimensionRanges(questions, new Set(['a']));
    expect(ranges.humor).toEqual({ min: -3, max: 3 });
    const normalized = normalizeRawScores({ humor: 0 } as Record<DimensionId, number>, ranges);
    expect(normalized.humor).toBe(50);
  });
});

describe('匹配：排序、并列与可复现性', () => {
  const options = { humor: 80, research: 30, empathy: 60, opinion: 70, narrative: 40, community: 55, experiment: 65, aesthetic: 45 };

  it('完全一致的画像拿到 100 分并排第一', () => {
    const twin = makeUp(1001, options);
    const other = makeUp(1002, { humor: 20, research: 90 });
    const ranking = buildRanking(fullScores(options), [other, twin]);
    expect(ranking[0].up.uid).toBe(1001);
    expect(ranking[0].similarity).toBe(100);
  });

  it('最不像的画像得到 30 分下限（不会出现负分）', () => {
    const inverted = makeUp(2001, {
      humor: 0,
      research: 100,
      empathy: 0,
      opinion: 0,
      narrative: 100,
      community: 0,
      experiment: 0,
      aesthetic: 100,
    });
    const ranking = buildRanking(
      fullScores({ humor: 100, research: 0, empathy: 100, opinion: 100, narrative: 0, community: 100, experiment: 100, aesthetic: 0 }),
      [inverted],
    );
    expect(ranking[0].similarity).toBe(30);
  });

  it('相同相似指数时按 UID 升序做稳定排序', () => {
    const target = fullScores({ humor: 70 });
    const a = makeUp(3002, { humor: 70 });
    const b = makeUp(3001, { humor: 70 });
    const c = makeUp(3003, { humor: 70 });
    const ranking = buildRanking(target, [a, b, c]);
    expect(ranking.map((r) => r.up.uid)).toEqual([3001, 3002, 3003]);
    expect(ranking.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(new Set(ranking.map((r) => r.similarity)).size).toBe(1);
  });

  it('只对 matchable === true 的 UP 主排名', () => {
    const shown = makeUp(4001, { humor: 70 });
    const hidden = makeUp(4002, { humor: 70 }, { matchable: false });
    const ranking = buildRanking(fullScores({ humor: 70 }), [shown, hidden]);
    expect(ranking.map((r) => r.up.uid)).toEqual([4001]);
  });

  it('同样输入调用两次结果完全一致（可复现）', () => {
    const ups = [makeUp(5001, { humor: 90 }), makeUp(5002, { humor: 10 }), makeUp(5003, { humor: 55 })];
    const answers = dotAnswers(QUESTIONS, 0);
    const first = evaluateTest(QUESTIONS, answers, ups);
    const second = evaluateTest(QUESTIONS, answers, ups);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe('匹配：结果解释', () => {
  it('能指出用户更强 / 更弱的维度', () => {
    const up = makeUp(6001, { humor: 90, research: 10 });
    const ranking = buildRanking(fullScores({ humor: 20, research: 80 }), [up]);
    const result = ranking[0];
    expect(result.strongerDimensions).toContain('research');
    expect(result.weakerDimensions).toContain('humor');
    expect(result.reasons.join('')).toContain('深度考据');
  });

  it('风格标签取分数最高的维度', () => {
    const tags = buildStyleTags(fullScores({ humor: 95, research: 88, empathy: 60 }));
    expect(tags[0]).toBe('幽默整活型');
    expect(tags.length).toBeGreaterThanOrEqual(2);
    expect(tags.length).toBeLessThanOrEqual(3);
  });
});

describe('完整流程：evaluateTest', () => {
  const ups = [
    // 画像 A：与"全部完全认同"的作答最接近（幽默、社群、叙事高，考据低）
    makeUp(7001, { humor: 95, research: 15, empathy: 90, opinion: 85, narrative: 90, community: 95, experiment: 85, aesthetic: 80 }),
    // 画像 B：与"全部完全不认同"的作答最接近（考据、审美高，幽默、社群低）
    makeUp(7002, { humor: 10, research: 95, empathy: 20, opinion: 30, narrative: 25, community: 10, experiment: 35, aesthetic: 90 }),
    // 画像 C：中庸型
    makeUp(7003, { humor: 55, research: 50, empathy: 55, opinion: 52, narrative: 50, community: 58, experiment: 48, aesthetic: 60 }),
    // 画像 D：情绪共鸣与叙事型
    makeUp(7004, { humor: 45, research: 40, empathy: 95, opinion: 55, narrative: 90, community: 70, experiment: 50, aesthetic: 85 }),
  ];
  const uidOf = (outcome: ReturnType<typeof evaluateTest>) => outcome.ranking.map((r) => r.up.uid);

  /** 先用固定作答算出"理想观众"的维度分，再把它当成 UP 主画像，用于验证匹配方向是否正确 */
  const profileFor = (level: 0 | 3 | 6) =>
    evaluateTest(QUESTIONS, dotAnswers(QUESTIONS, level), ups).normalized;

  it('前三名按相似指数降序，且 rank 连续', () => {
    const outcome = evaluateTest(QUESTIONS, dotAnswers(QUESTIONS, 0), ups);
    expect(outcome.top3.length).toBe(3);
    expect(outcome.top3.map((r) => r.rank)).toEqual([1, 2, 3]);
    for (let i = 1; i < outcome.top3.length; i++) {
      expect(outcome.top3[i - 1].similarity).toBeGreaterThanOrEqual(outcome.top3[i].similarity);
    }
    expect(outcome.best.rank).toBe(1);
  });

  it('未答完时完成度小于 1，答完时为 1', () => {
    const partial = evaluateTest(QUESTIONS, dotAnswers(QUESTIONS.slice(0, 20), 0), ups);
    expect(partial.completion).toBeCloseTo(0.5, 5);
    const full = evaluateTest(QUESTIONS, dotAnswers(QUESTIONS, 0), ups);
    expect(full.completion).toBe(1);
  });

  it('与作答完全同向的画像拿到接近 100 的相似指数并排第一', () => {
    for (const level of [0, 3, 6] as const) {
      const twin = makeUp(9000 + level, profileFor(level));
      const outcome = evaluateTest(QUESTIONS, dotAnswers(QUESTIONS, level), [...ups, twin]);
      expect(outcome.best.up.uid).toBe(9000 + level);
      expect(outcome.best.similarity).toBeGreaterThan(99);
    }
  });

  it('"完全认同"与"完全不认同"得到的排名明显不同（说明作答真的影响结果）', () => {
    const agree = uidOf(evaluateTest(QUESTIONS, dotAnswers(QUESTIONS, 0), ups));
    const disagree = uidOf(evaluateTest(QUESTIONS, dotAnswers(QUESTIONS, 6), ups));
    expect(agree).not.toEqual(disagree);
  });

  it('相似指数始终落在 30~100 之间', () => {
    for (const level of [0, 3, 6] as const) {
      const outcome = evaluateTest(QUESTIONS, dotAnswers(QUESTIONS, level), ups);
      for (const r of outcome.ranking) {
        expect(r.similarity).toBeGreaterThanOrEqual(30);
        expect(r.similarity).toBeLessThanOrEqual(100);
      }
    }
  });

  it('没有可匹配的 UP 主时抛出明确错误', () => {
    expect(() => evaluateTest(QUESTIONS, dotAnswers(QUESTIONS, 3), [makeUp(8001, {}, { matchable: false })])).toThrow(
      /matchable/,
    );
  });

  it('存在未核实数据时给出提示文案', () => {
    const withUnverified = [...ups, makeUp(8002, {}, { verification: 'unverified' })];
    const outcome = evaluateTest(QUESTIONS, dotAnswers(QUESTIONS, 3), withUnverified);
    expect(outcome.dataNotice).toBeTruthy();
    expect(outcome.dataNotice).toContain('尚未核实');
  });
});
