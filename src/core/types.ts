/**
 * 领域类型定义
 * ---------------------------------------------------------------------------
 * 这里只有类型，没有逻辑，方便阅读和跨模块复用。
 */

/** 8 个创作风格维度的标识 */
export type DimensionId =
  | 'humor'
  | 'research'
  | 'empathy'
  | 'opinion'
  | 'narrative'
  | 'community'
  | 'experiment'
  | 'aesthetic';

/** 维度定义 */
export interface Dimension {
  id: DimensionId;
  /** 展示名称，例如"幽默整活" */
  name: string;
  /** 两个字母的简写，用于雷达图的短标签 */
  short: string;
  /** 一句话操作性定义：这个维度到底在测什么 */
  definition: string;
  /** 高分（75+）代表的行为特征 */
  highMeans: string;
  /** 低分（40 以下）代表的行为特征 */
  lowMeans: string;
}

/** 7 级认同程度的选项索引：0 = 完全认同 … 6 = 完全不认同 */
export type AnswerLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 用户答案表：题目 id → 选项索引 */
export type Answers = Record<string, AnswerLevel>;

/** 题目定义 */
export interface Question {
  /** 题目 id，例如 'q01'。answers 里用它作为键。 */
  id: string;
  /** 题干 */
  text: string;
  /** 主要测量维度（每题恰好一个主维度，保证 40 题在 8 个维度上均衡分布） */
  dimension: DimensionId;
  /** 题目权重，默认 1（加权欧氏距离里会用到） */
  weight: number;
  /** 是否为反向计分题 */
  reverse: boolean;
}

/** 某个维度上的分数向量：维度 → 0~100 分 */
export type DimensionScores = Record<DimensionId, number>;

/** UP 主内容分类 */
export type UpCategory =
  | '动画杂谈与评论'
  | '剧情与世界观考据'
  | '动漫文化科普'
  | '吐槽与搞笑整活'
  | '混剪与MAD/AMV'
  | '推荐与资讯'
  | '二次元综合文化';

/** UP 主资料的内容核实状态 */
export type VerificationStatus =
  /** 昵称、UID、签名、投稿内容都已通过公开接口核实 */
  | 'verified'
  /** 部分字段来自公开检索，未逐条核对 */
  | 'partial'
  /** 尚未核实的占位数据，不得作为正式结果上线 */
  | 'unverified';

/** 公开资料来源 */
export interface SourceRef {
  /** 来源说明，例如"B站空间资料接口" */
  label: string;
  /** 链接 */
  url: string;
  /** 抓取/查证时间（ISO 日期字符串） */
  fetchedAt?: string;
}

/** UP 主风格档案 */
export interface UpProfile {
  /** 站内编号，用于图片文件名与排序，例如 'up_001' */
  id: string;
  /** B 站数字 UID */
  uid: number;
  /** 昵称 */
  name: string;
  /** 内容分类 */
  category: UpCategory;
  /** 3~5 个风格标签 */
  tags: string[];
  /** 一句话风格总结（结果页与图鉴卡片使用） */
  summary: string;
  /** 较长的创作风格介绍 */
  intro: string;
  /** 主要创作内容说明 */
  contentFocus: string;
  /** 基于公开投稿可观察到的表达特征（只描述作品，不推测私人性格） */
  observedStyle: string[];
  /** 8 维风格评分（0~100） */
  scores: DimensionScores;
  /** 评分依据：每个维度为什么给这个分 */
  scoreRationale: string;
  /** 公开资料来源 */
  sources: SourceRef[];
  /** 核实状态 */
  verification: VerificationStatus;
  /** 公开粉丝量快照（仅作参考，会随时间变化） */
  fansSnapshot?: number;
  /** 参考资料核实时间 */
  verifiedAt?: string;
  /** 站内图片文件名（不含扩展名与目录），默认等于 id */
  image?: string;
  /** 是否参与匹配（false 时只出现在图鉴里做展示） */
  matchable: boolean;
}

/** 单个维度的匹配明细 */
export interface DimensionDiff {
  dimension: DimensionId;
  userScore: number;
  upScore: number;
  /** 有符号差异：userScore - upScore，正数表示用户更强 */
  diff: number;
  /** 绝对差 */
  absDiff: number;
  /** 随机抽取用的权重（重要度） */
  weight: number;
}

/** 一位 UP 主的匹配结果 */
export interface MatchResult {
  up: UpProfile;
  rank: number;
  /** 风格相似指数 0~100 */
  similarity: number;
  /** 加权欧氏距离（越小越像） */
  distance: number;
  /** 用户比这位 UP 主更明显的维度（按差异从大到小，最多 2 个） */
  strongerDimensions: DimensionId[];
  /** 用户比这位 UP 主更弱的维度（按差异从大到小，最多 2 个） */
  weakerDimensions: DimensionId[];
  /** 逐维度对比明细 */
  diffs: DimensionDiff[];
  /** 可读的匹配理由 */
  reasons: string[];
}

/** 完整测试结果 */
export interface TestOutcome {
  /** 各维度原始加权分（可能为负） */
  rawScores: Record<DimensionId, number>;
  /** 各维度 0~100 标准化分 */
  normalized: DimensionScores;
  /** 排名列表（全部可匹配 UP 主，按相似指数降序） */
  ranking: MatchResult[];
  /** 前三名 */
  top3: MatchResult[];
  /** 最佳匹配 */
  best: MatchResult;
  /** 用户主要风格标签 */
  styleTags: string[];
  /** 完成度 0~1 */
  completion: number;
  /** 作答明确度 0~1 */
  decisiveness: number;
  /** 置信度 0~1 */
  confidence: number;
  /** 置信度档位 */
  confidenceLevel: 'high' | 'medium' | 'low';
  /** 数据说明（例如存在未核实数据时的提示） */
  dataNotice: string | null;
}
