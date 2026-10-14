import { describe, expect, it } from 'vitest';
import { DIMENSION_IDS } from '../src/core/dimensions';
import {
  computeDimensionRanges,
  computeRawScores,
  distanceToSimilarity,
  normalizeRawScores,
  scoreTest,
  weightedEuclideanDistance,
} from '../src/core/scoring';
import { dotAnswers, scaleTestSet } from './helpers';
import type { DimensionId, Question } from '../src/core/types';

describe('反向计分', () => {
  const questions = scaleTestSet([
    { id: 'humor', forward: 5, reverse: 0 },
    { id: 'research', forward: 0, reverse: 5 },
  ]);

  it('反向题答"完全认同"会降低该维度分数，正向题则相反', () => {
    const ranges = computeDimensionRanges(questions, new Set(questions.map((q) => q.id)));
    const agree = dotAnswers(questions, 0);
    const raw = computeRawScores(questions, agree);
    expect(raw.humor).toBe(15); // 5 题 × +3
    expect(raw.research).toBe(-15); // 5 题 × -3

    const normalized = normalizeRawScores(raw, ranges);
    expect(normalized.humor).toBe(100);
    expect(normalized.research).toBe(0);
  });

  it('对反向题选"完全不认同"得到正向的高分', () => {
    const ranges = computeDimensionRanges(questions, new Set(questions.map((q) => q.id)));
    const disagree = dotAnswers(questions, 6);
    const normalized = normalizeRawScores(computeRawScores(questions, disagree), ranges);
    expect(normalized.research).toBe(100);
    expect(normalized.humor).toBe(0);
  });

  it('反向题的 +3 与正向题的 -3 对"维度强弱"的作用方向相反但幅度一致', () => {
    const forward: Question = { id: 'a', text: '正向题测试文本', dimension: 'humor', weight: 1, reverse: false };
    const reverse: Question = { id: 'b', text: '反向题测试文本', dimension: 'humor', weight: 1, reverse: true };
    const ranges = computeDimensionRanges([forward, reverse], new Set(['a', 'b']));
    // 正向题"完全认同"（+3）与反向题"完全认同"（-3）的作用互相抵消
    expect(computeRawScores([forward, reverse], { a: 0, b: 0 }).humor).toBe(0);
    // 反向题选"完全不认同"得到 +3，方向与正向题的"完全认同"一致，但两者不会同时出现
    expect(computeRawScores([forward, reverse], { a: 0, b: 6 }).humor).toBe(6);
    expect(normalizeRawScores({ humor: 0 } as Record<DimensionId, number>, ranges).humor).toBe(50);
    expect(normalizeRawScores({ humor: 6 } as Record<DimensionId, number>, ranges).humor).toBe(100);
  });
});

describe('维度标准化', () => {
  it('最小值映射到 0、最大值映射到 100、中值映射到 50', () => {
    const questions = scaleTestSet([
      { id: 'humor', forward: 5, reverse: 0 },
      { id: 'research', forward: 3, reverse: 2 },
    ]);
    const ids = new Set(questions.map((q) => q.id));
    const ranges = computeDimensionRanges(questions, ids);

    expect(normalizeRawScores({ humor: ranges.humor.min, research: 0 } as Record<DimensionId, number>, ranges).humor).toBe(0);
    expect(normalizeRawScores({ humor: ranges.humor.max, research: 0 } as Record<DimensionId, number>, ranges).humor).toBe(100);
    const neutral = normalizeRawScores({ humor: 0, research: 0 } as Record<DimensionId, number>, ranges);
    expect(neutral.humor).toBe(50);
    expect(neutral.research).toBe(50);
  });

  it('正向 / 反向题混排的维度，中立作答依然落在 50 分', () => {
    const questions = scaleTestSet([{ id: 'humor', forward: 4, reverse: 1 }]);
    const result = scoreTest(questions, dotAnswers(questions, 3));
    expect(result.normalized.humor).toBeCloseTo(50, 5);
  });

  it('7 种作答方式下所有维度都在 0~100 之间', () => {
    const questions = scaleTestSet([
      { id: 'humor', forward: 4, reverse: 1 },
      { id: 'research', forward: 1, reverse: 4 },
    ]);
    for (const level of [0, 1, 2, 3, 4, 5, 6] as const) {
      const result = scoreTest(questions, dotAnswers(questions, level));
      for (const id of DIMENSION_IDS) {
        const score = result.normalized[id];
        if (score === undefined) continue;
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('极端作答不会出现 NaN', () => {
    const questions = scaleTestSet([{ id: 'humor', forward: 0, reverse: 0 }]);
    const result = scoreTest(questions, {});
    expect(Number.isNaN(result.normalized.humor)).toBe(false);
    expect(result.normalized.humor).toBe(50);
  });
});

describe('加权欧氏距离与相似指数', () => {
  const a = { humor: 80, research: 20 } as Record<DimensionId, number>;

  it('完全相同的向量距离为 0，相似指数为 100', () => {
    const distance = weightedEuclideanDistance(a, { ...a });
    expect(distance).toBeCloseTo(0, 10);
    expect(distanceToSimilarity(0)).toBe(100);
  });

  it('维度权重会放大距离', () => {
    const b = { humor: 0, research: 20 } as Record<DimensionId, number>;
    const plain = weightedEuclideanDistance(a, b);
    const weighted = weightedEuclideanDistance(a, b, { humor: 4 });
    expect(weighted).toBeGreaterThan(plain);
    expect(weighted).toBeCloseTo(plain * 2, 5);
  });

  it('相似指数随距离单调下降，并被夹在 [minSimilarity, 100] 之间', () => {
    expect(distanceToSimilarity(10)).toBeGreaterThan(distanceToSimilarity(50));
    expect(distanceToSimilarity(1000)).toBe(30);
    expect(distanceToSimilarity(0)).toBe(100);
  });

  it('只比较用户作答过的维度', () => {
    const partialUser = { humor: 80 } as Record<DimensionId, number>;
    const up = { humor: 80, research: 100, narrative: 0 } as Record<DimensionId, number>;
    expect(weightedEuclideanDistance(partialUser, up)).toBeCloseTo(0, 10);
  });
});
