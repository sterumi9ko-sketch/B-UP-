import { siteConfig } from '@config';
import { DIMENSIONS, DIMENSION_IDS } from '@core/dimensions';
import { isDecisive, scoreForAnswer } from '@core/scale';
import type {
  Answers,
  AnswerLevel,
  DimensionId,
  DimensionScores,
  Question,
  UpProfile,
} from '@core/types';

/**
 * 计分模块
 * ---------------------------------------------------------------------------
 * 流程：
 *   1. 逐题取分值（反向题取反），乘以题目权重，累加到"该题主维度"的原始分上。
 *   2. 用该维度理论上可能出现的最大、最小原始分，把原始分线性映射到 0~100。
 *      映射使用真实可达的上下界，因此即使某个维度里反向题较多，
 *      0 分依然代表"该维度中性"，50 分代表"居中"，100 分代表"该维度最强"。
 */

/** 单个维度的可达分数范围 */
export interface DimensionRange {
  min: number;
  max: number;
}

/**
 * 计算每个维度理论上可达的最小/最大原始分。
 * 只统计"已作答"的题目（partial 情况下用于估算完成度）。
 */
export function computeDimensionRanges(
  questions: Question[],
  answeredIds?: Set<string>,
): Record<DimensionId, DimensionRange> {
  const ranges = {} as Record<DimensionId, DimensionRange>;
  for (const id of DIMENSION_IDS) ranges[id] = { min: 0, max: 0 };

  for (const q of questions) {
    if (answeredIds && !answeredIds.has(q.id)) continue;
    const maxAnswerValue = 3;
    const contribution = q.weight * maxAnswerValue;
    // 正向题：认同 → 加分；反向题：认同 → 减分
    const positive = q.reverse ? -contribution : contribution;
    const negative = -positive;
    ranges[q.dimension].max += positive > negative ? positive : negative;
    ranges[q.dimension].min += positive > negative ? negative : positive;
  }
  return ranges;
}

/** 计算各维度的原始加权分 */
export function computeRawScores(questions: Question[], answers: Answers): Record<DimensionId, number> {
  const raw = {} as Record<DimensionId, number>;
  for (const id of DIMENSION_IDS) raw[id] = 0;

  for (const q of questions) {
    const answer = answers[q.id];
    if (answer === undefined) continue;
    raw[q.dimension] += scoreForAnswer(answer, q.reverse) * q.weight;
  }
  return raw;
}

/**
 * 把原始分标准化到 0~100。
 * normalized = (raw - min) / (max - min) * 100
 * 若 max === min（该维度没有题目），返回 50（中性），并保证结果一定落在 [0, 100]。
 */
export function normalizeRawScores(
  raw: Record<DimensionId, number>,
  ranges: Record<DimensionId, DimensionRange>,
): DimensionScores {
  const out = {} as DimensionScores;
  for (const id of DIMENSION_IDS) {
    const { min, max } = ranges[id];
    if (max === min) {
      out[id] = 50;
      continue;
    }
    const value = ((raw[id] - min) / (max - min)) * 100;
    out[id] = clamp(value, 0, 100);
  }
  return out;
}

/**
 * 一次算完：原始分 + 标准化分 + 计分元信息。
 */
export interface ScoringBreakdown {
  rawScores: Record<DimensionId, number>;
  normalized: DimensionScores;
  ranges: Record<DimensionId, DimensionRange>;
  /** 已作答题数 */
  answeredCount: number;
  /** 总题数 */
  totalCount: number;
  /** 完成度 0~1 */
  completion: number;
  /** 作答明确度 0~1（选了 ±2 / ±3 的题目占比） */
  decisiveness: number;
}

export function scoreTest(questions: Question[], answers: Answers): ScoringBreakdown {
  const answeredList = questions.filter((q) => answers[q.id] !== undefined);
  const answeredIds = new Set(answeredList.map((q) => q.id));

  const rawScores = computeRawScores(questions, answers);
  const ranges = computeDimensionRanges(questions, answeredIds);
  const normalized = normalizeRawScores(rawScores, ranges);

  const totalCount = questions.length;
  const answeredCount = answeredList.length;
  const completion = totalCount === 0 ? 0 : answeredCount / totalCount;

  const decisiveCount = answeredList.filter((q) => isDecisive(answers[q.id] as AnswerLevel)).length;
  const decisiveness = answeredCount === 0 ? 0 : decisiveCount / answeredCount;

  return { rawScores, normalized, ranges, answeredCount, totalCount, completion, decisiveness };
}

/* -------------------------------------------------------------------------- */
/* 匹配算法                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 加权欧氏距离：
 *   distance = sqrt( Σ weight_d × (user_d - up_d)² )
 * 维度权重来自用户答案（该维度题目的权重之和），保证"题多/题重的维度"影响更大。
 * 若没有自定义权重，则退化为 1，即普通欧氏距离。
 */
export function weightedEuclideanDistance(
  user: Partial<DimensionScores>,
  up: DimensionScores,
  weights?: Partial<Record<DimensionId, number>>,
): number {
  let sum = 0;
  let used = 0;
  for (const id of DIMENSION_IDS) {
    const u = user[id];
    if (u === undefined) continue;
    const w = weights?.[id] ?? 1;
    const d = u - up[id];
    sum += w * d * d;
    used += 1;
  }
  if (used === 0) return 0;
  return Math.sqrt(sum);
}

/**
 * 距离 → 风格相似指数（0~100）。
 * similarity = (1 - distance / maxDistance) × 100，再夹到 [minSimilarity, 100]。
 * 这是一个"相对相似度"刻度，不是统计学意义上的准确率。
 */
export function distanceToSimilarity(distance: number): number {
  const { maxDistance, minSimilarity } = siteConfig.match;
  const value = (1 - distance / maxDistance) * 100;
  return Math.round(clamp(value, minSimilarity, 100) * 10) / 10;
}

/** 计算某位 UP 主的匹配明细 */
export function matchOne(
  userScores: DimensionScores,
  up: UpProfile,
  weights?: Partial<Record<DimensionId, number>>,
): Omit<import('@core/types').MatchResult, 'rank'> {
  const distance = weightedEuclideanDistance(userScores, up.scores, weights);
  const similarity = distanceToSimilarity(distance);

  const diffs = DIMENSION_IDS.map((id) => {
    const diff = round2(userScores[id] - up.scores[id]);
    return {
      dimension: id,
      userScore: round1(userScores[id]),
      upScore: round1(up.scores[id]),
      diff,
      absDiff: Math.abs(diff),
      weight: weights?.[id] ?? 1,
    };
  });

  const sorted = [...diffs].sort((a, b) => b.diff - a.diff);
  const strongerDimensions = sorted.filter((d) => d.diff > 0).slice(0, 2).map((d) => d.dimension);
  const weakerDimensions = sorted
    .filter((d) => d.diff < 0)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 2)
    .map((d) => d.dimension);

  const closest = [...diffs].sort((a, b) => a.absDiff - b.absDiff).slice(0, 2);

  const nameOf = (id: DimensionId) => DIMENSIONS.find((d) => d.id === id)?.name ?? id;
  const reasons: string[] = [];
  if (closest.length) {
    reasons.push(
      `你们在「${closest.map((d) => nameOf(d.dimension)).join('」和「')}」上最接近（分差都在 ${Math.round(
        closest[closest.length - 1].absDiff,
      )} 分以内）。`,
    );
  }
  if (strongerDimensions.length) {
    reasons.push(`你比 TA 更偏「${strongerDimensions.map(nameOf).join('、')}」。`);
  }
  if (weakerDimensions.length) {
    reasons.push(`TA 比你更偏「${weakerDimensions.map(nameOf).join('、')}」。`);
  }

  return { up, similarity, distance: round1(distance), strongerDimensions, weakerDimensions, diffs, reasons };
}

/**
 * 生成完整结果：排序 → 前三名 → 风格标签。
 * 排序规则（保证同样输入永远得到同样结果）：
 *   1. 相似指数降序
 *   2. 距离升序
 *   3. UID 升序
 */
export function buildRanking(
  userScores: DimensionScores,
  ups: UpProfile[],
  options: { weights?: Partial<Record<DimensionId, number>>; take?: number } = {},
): import('@core/types').MatchResult[] {
  const matchable = ups.filter((u) => u.matchable);
  const results = matchable.map((up, index) => ({ ...matchOne(userScores, up, options.weights), index }));

  results.sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity;
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (a.up.uid !== b.up.uid) return a.up.uid - b.up.uid;
    return a.index - b.index;
  });

  const limited = options.take ? results.slice(0, options.take) : results;
  return limited.map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * 根据用户最强的维度生成风格标签。
 * 规则：取分数最高的 2 个维度；若第三名与第二名差距 ≤ 5 分，也一并列出（最多 3 个）。
 */
export function buildStyleTags(normalized: DimensionScores): string[] {
  const sorted = DIMENSION_IDS.map((id) => ({ id, score: normalized[id] })).sort((a, b) => b.score - a.score);
  const tags: string[] = [];
  const first = sorted[0];
  const second = sorted[1];
  const third = sorted[2];
  if (first) tags.push(`${dimensionName(first.id)}型`);
  if (second) tags.push(`${dimensionName(second.id)}突出`);
  if (third && second && third.score >= second.score - 5) tags.push(`兼顾${dimensionName(third.id)}`);
  return tags;
}

function dimensionName(id: DimensionId): string {
  return DIMENSIONS.find((d) => d.id === id)?.name ?? id;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
