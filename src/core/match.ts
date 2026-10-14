import { siteConfig } from '@config';
import { DIMENSION_IDS } from '@core/dimensions';
import { buildRanking, buildStyleTags, scoreTest, type ScoringBreakdown } from '@core/scoring';
import type { Answers, DimensionId, Question, TestOutcome, UpProfile } from '@core/types';

/**
 * 匹配主流程
 * ---------------------------------------------------------------------------
 * 1. 读取用户答案
 * 2. 正/反向计分 + 按维度加权汇总（scoreTest）
 * 3. 标准化到 0~100
 * 4. 读取 UP 主画像
 * 5. 计算加权欧氏距离
 * 6. 距离 → 风格相似指数 0~100
 * 7. 排序、取前三
 * 8. 生成解释文本与风格标签
 *
 * 整个过程是纯函数：同样的题目、答案与 UP 主数据，永远得到同样的结果。
 */
export function evaluateTest(questions: Question[], answers: Answers, ups: UpProfile[]): TestOutcome {
  const breakdown: ScoringBreakdown = scoreTest(questions, answers);

  // 维度权重 = 该维度已作答题目权重之和。这样"题目更多的维度"对匹配影响更大。
  const weights = computeDimensionWeights(questions, answers);

  const all = buildRanking(breakdown.normalized, ups, { weights });
  const top3 = all.slice(0, 3);
  const best = top3[0];

  if (!best) {
    throw new Error('没有可用于匹配的 UP 主数据：请检查 src/data/ups 中的 matchable 字段。');
  }

  const confidence = breakdown.completion * 0.6 + breakdown.decisiveness * 0.4;
  const confidenceLevel =
    confidence >= siteConfig.confidence.high ? 'high' : confidence >= siteConfig.confidence.medium ? 'medium' : 'low';

  const dataNotice = buildDataNotice(ups);

  return {
    rawScores: breakdown.rawScores,
    normalized: breakdown.normalized,
    ranking: all,
    top3,
    best,
    styleTags: buildStyleTags(breakdown.normalized),
    completion: breakdown.completion,
    decisiveness: breakdown.decisiveness,
    confidence,
    confidenceLevel,
    dataNotice,
  };
}

/**
 * 计算每个维度的权重。
 * ---------------------------------------------------------------------------
 * 权重 = 该维度已作答题目的权重和，再做「归一化」：整体缩放到平均值为 1。
 *
 * 为什么要归一化：
 *   如果直接用原始权重（每个维度 5 题 → 每个维度权重 5），
 *   加权欧氏距离会整体被放大 √5 ≈ 2.24 倍，
 *   于是相似指数被整体压低、大量结果挤在下限，不同的人看起来"都不像"。
 *   归一化之后，权重仍然保留"题目更多的维度影响更大"的性质，
 *   但距离量级回到正常范围，可以按 docs 里的统计口径来标定 maxDistance。
 *
 * 例：8 个维度各 5 题 → 原始权重都是 5，平均值 5，归一化后都是 1（等权）。
 *     若某维度有 10 题、其它维度各 5 题 → 该维度权重约为 2，影响力是别人的两倍。
 */
export function computeDimensionWeights(
  questions: Question[],
  answers: Answers,
): Record<DimensionId, number> {
  const raw = {} as Record<DimensionId, number>;
  for (const id of DIMENSION_IDS) raw[id] = 0;
  for (const q of questions) {
    if (answers[q.id] === undefined) continue;
    raw[q.dimension] += q.weight;
  }
  for (const id of DIMENSION_IDS) {
    if (raw[id] <= 0) raw[id] = 1;
  }

  const values = DIMENSION_IDS.map((id) => raw[id]);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean <= 0) return raw;

  const normalized = {} as Record<DimensionId, number>;
  for (const id of DIMENSION_IDS) normalized[id] = raw[id] / mean;
  return normalized;
}

/**
 * 数据提示：如果参与匹配的 UP 主里有未核实数据，必须在结果页明确告知用户。
 * 这样即使以后临时加入待补充的数据，也不会把占位资料当作正式结果展示。
 */
export function buildDataNotice(ups: UpProfile[]): string | null {
  const matchable = ups.filter((u) => u.matchable);
  const unverified = matchable.filter((u) => u.verification === 'unverified');
  const partial = matchable.filter((u) => u.verification === 'partial');

  if (unverified.length) {
    return `当前参与匹配的 ${matchable.length} 位 UP 主中，有 ${unverified.length} 位资料尚未核实，结果仅供参考。`;
  }
  if (partial.length) {
    return `当前参与匹配的 ${matchable.length} 位 UP 主中，有 ${partial.length} 位的部分字段仍在补充核实中。`;
  }
  return null;
}

/** 结果页与分享图共用的样式文案 */
export function confidenceText(level: TestOutcome['confidenceLevel']): string {
  switch (level) {
    case 'high':
      return '作答明确，匹配结果区分度较高';
    case 'medium':
      return '作答较为均衡，结果可参考';
    default:
      return '中立选项较多，建议重测一次以获得更清晰的结果';
  }
}
