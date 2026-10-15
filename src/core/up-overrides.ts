import { DIMENSION_IDS } from '@core/dimensions';
import type { DimensionScores, UpCategory, UpProfile } from '@core/types';
import { UPS } from '@data/ups';

/**
 * UP 主名单的「本地自定义」层
 * ===========================================================================
 * 提供三件事，全部只作用于本机浏览器：
 *
 *   1. 分数覆盖   改某位现有 UP 主的 8 维分数
 *   2. 新增 UP 主 自己加一位（必须填齐必要数据，见下方 REQUIRED_FIELDS）
 *   3. 移除 UP 主 把现有的从匹配名单里去掉（可随时恢复）
 *
 * 为什么不做成写文件：
 *   本站是纯静态站点，浏览器没有写项目文件的权限，这是浏览器的安全模型，
 *   不是实现难度问题。所以采用「本地编辑 + 一键导出」的组合：
 *   在页面上调好之后导出代码片段，粘回 src/data/ups/group*.ts 即永久生效。
 *
 * 数据分层：
 *   src/data/ups/group*.ts   ← 基准数据，永不被运行时改写
 *   localStorage             ← 覆盖 / 新增 / 移除（本模块负责）
 *   导出片段                 ← 人工粘回源码，变成新的基准数据
 */

const STORAGE_KEY = 'anime-up-match:score-overrides';
const CUSTOM_KEY = 'anime-up-match:custom-ups';
const HIDDEN_KEY = 'anime-up-match:hidden-ups';

/** 允许的分数范围 */
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

/** 分数覆盖表：UP 主 id → 维度分 */
export type ScoreOverrides = Record<string, DimensionScores>;

/** 可选的 UP 主分类（与 src/core/types.ts 的 UpCategory 保持一致） */
export const UP_CATEGORIES: UpCategory[] = [
  '动画杂谈与评论',
  '剧情与世界观考据',
  '动漫文化科普',
  '吐槽与搞笑整活',
  '混剪与MAD/AMV',
  '推荐与资讯',
  '二次元综合文化',
];

/**
 * 新增 UP 主时必须由用户提供的数据。
 * 对应需求「可以添加删减 UP，但是需要提供相关的数据」：
 * 与其允许只填一半，不如强制把可核实的字段填齐。
 */
export const REQUIRED_FIELDS = [
  { key: 'name', label: '昵称', hint: 'B 站公开昵称，例如「泛式」' },
  { key: 'uid', label: 'B 站 UID', hint: '纯数字，站点用它生成主页链接' },
  { key: 'category', label: '内容分类', hint: '决定图鉴页的筛选归类' },
  { key: 'summary', label: '一句话风格', hint: '结果页与卡片上显示的那句话' },
  { key: 'scores', label: '8 个维度分数', hint: '每项 0–100，分档标准见 docs/SCORING.md' },
] as const;

/** 自定义 UP 主的输入（新增表单填写的内容） */
export interface CustomUpInput {
  name: string;
  uid: number;
  category: UpCategory;
  summary: string;
  scores: DimensionScores;
  /** 可选：风格标签，默认由分类与高分维度推导 */
  tags?: string[];
  /** 可选：较长介绍 */
  intro?: string;
  /** 可选：主要创作内容 */
  contentFocus?: string;
  /** 可选：资料来源链接 */
  sourceUrl?: string;
}

/** 校验结果 */
export interface ValidationResult {
  ok: boolean;
  /** 字段名 → 错误说明 */
  errors: Record<string, string>;
}

/** 本地名单状态 */
export interface RosterState {
  overrides: ScoreOverrides;
  custom: UpProfile[];
  hidden: string[];
}

/* ====================================================================== */
/* 通用工具                                                               */
/* ====================================================================== */

function clampScore(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(Math.min(SCORE_MAX, Math.max(SCORE_MIN, num)));
}

/** 只保留合法维度，丢弃多余键与非法值 */
function sanitizeScores(scores: Partial<DimensionScores> | undefined): DimensionScores | null {
  if (!scores || typeof scores !== 'object') return null;
  const out = {} as DimensionScores;
  let valid = 0;
  for (const id of DIMENSION_IDS) {
    const value = clampScore((scores as Record<string, unknown>)[id]);
    if (value === null) continue;
    out[id] = value;
    valid++;
  }
  // 至少要有一半维度合法才认这条数据，避免脏数据把画像搞坏
  if (valid < DIMENSION_IDS.length / 2) return null;
  for (const id of DIMENSION_IDS) if (out[id] === undefined) out[id] = 50;
  return out;
}

function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* 隐私模式 / 容量不足时静默忽略 */
  }
}

/** 生成不冲突的站内 id */
function nextCustomId(existing: Iterable<string>): string {
  const taken = new Set(existing);
  let n = 1;
  while (taken.has(`up_custom_${String(n).padStart(3, '0')}`)) n++;
  return `up_custom_${String(n).padStart(3, '0')}`;
}

/** 由分类与最高分维度推导标签，省掉手填标签这一步 */
function deriveTags(input: Pick<CustomUpInput, 'category' | 'scores' | 'tags'>): string[] {
  if (input.tags?.length) return input.tags.slice(0, 5);
  const sorted = DIMENSION_IDS.map((id) => ({ id, score: input.scores?.[id] ?? 0 })).sort(
    (a, b) => b.score - a.score,
  );
  const names: Record<string, string> = {
    humor: '幽默整活',
    research: '深度考据',
    empathy: '情绪共鸣',
    opinion: '观点鲜明',
    narrative: '叙事创作',
    community: '社群互动',
    experiment: '实验创新',
    aesthetic: '审美表达',
  };
  return [input.category, ...sorted.slice(0, 2).map((item) => names[item.id])].slice(0, 3);
}

/* ====================================================================== */
/* 校验                                                                   */
/* ====================================================================== */

/**
 * 校验新增 / 编辑 UP 主的输入。
 * 需求要求「需要提供相关的数据」，所以这里是硬校验：
 * 缺任何一项必填数据都不允许保存。
 */
export function validateCustomUp(
  input: Partial<CustomUpInput>,
  existing: UpProfile[],
  editingId?: string,
): ValidationResult {
  const errors: Record<string, string> = {};

  /* 昵称 */
  const name = String(input.name ?? '').trim();
  if (!name) errors.name = '请填写昵称';
  else if (name.length > 30) errors.name = '昵称不要超过 30 个字';
  else if (existing.some((up) => up.id !== editingId && up.name === name)) {
    errors.name = '名单里已经有同名 UP 主了';
  }

  /* UID */
  const hasUid = input.uid !== undefined && input.uid !== null && String(input.uid) !== '';
  const uid = Number(input.uid);
  if (!hasUid) errors.uid = '请填写 B 站 UID';
  else if (!Number.isInteger(uid) || uid <= 0) errors.uid = 'UID 必须是正整数';
  else if (existing.some((up) => up.id !== editingId && up.uid === uid)) {
    errors.uid = `UID ${uid} 已经在名单里了`;
  }

  /* 分类 */
  if (!input.category || !UP_CATEGORIES.includes(input.category)) {
    errors.category = '请选择内容分类';
  }

  /* 一句话风格 */
  const summary = String(input.summary ?? '').trim();
  if (!summary) errors.summary = '请填写一句话风格说明';
  else if (summary.length > 80) errors.summary = '不要超过 80 个字';

  /* 8 维分数：必须全部提供且在范围内 */
  const scores = input.scores as Partial<DimensionScores> | undefined;
  if (!scores || typeof scores !== 'object') {
    errors.scores = '请填写 8 个维度的分数';
  } else {
    let missing = 0;
    let bad = false;
    for (const id of DIMENSION_IDS) {
      const raw = (scores as Record<string, unknown>)[id];
      if (raw === undefined || raw === null || raw === ('' as unknown)) {
        missing++;
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value) || value < SCORE_MIN || value > SCORE_MAX || !Number.isInteger(value)) {
        bad = true;
      }
    }
    if (missing > 0) errors.scores = `还有 ${missing} 个维度没填`;
    else if (bad) errors.scores = '分数必须是 0–100 的整数';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

/* ====================================================================== */
/* 读写 localStorage                                                       */
/* ====================================================================== */

export function loadOverrides(): ScoreOverrides {
  const raw = readString(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const validIds = new Set(UPS.map((up) => up.id));
    const out: ScoreOverrides = {};
    for (const [id, scores] of Object.entries(parsed)) {
      if (!validIds.has(id)) continue;
      const clean = sanitizeScores(scores as Partial<DimensionScores>);
      if (clean) out[id] = clean;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveOverrides(overrides: ScoreOverrides): void {
  writeString(STORAGE_KEY, Object.keys(overrides).length ? JSON.stringify(overrides) : null);
}

/** 读取自定义 UP 主（逐条校验，脏数据直接丢弃） */
export function loadCustomUps(): UpProfile[] {
  const raw = readString(CUSTOM_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: UpProfile[] = [];
    for (const item of parsed) {
      const profile = sanitizeCustomProfile(item as Partial<UpProfile>);
      if (profile) out.push(profile);
    }
    return out;
  } catch {
    return [];
  }
}

export function saveCustomUps(custom: UpProfile[]): void {
  writeString(CUSTOM_KEY, custom.length ? JSON.stringify(custom) : null);
}

export function loadHidden(): string[] {
  const raw = readString(HIDDEN_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const validIds = new Set(UPS.map((up) => up.id));
    return parsed.filter((id): id is string => typeof id === 'string' && validIds.has(id));
  } catch {
    return [];
  }
}

export function saveHidden(hidden: string[]): void {
  writeString(HIDDEN_KEY, hidden.length ? JSON.stringify(hidden) : null);
}

/** 把存储里的一条自定义档案修成合法 UpProfile；不合法返回 null */
function sanitizeCustomProfile(item: Partial<UpProfile> | undefined): UpProfile | null {
  if (!item || typeof item !== 'object') return null;
  const scores = sanitizeScores(item.scores);
  if (!scores) return null;

  const name = String(item.name ?? '').trim();
  const uid = Number(item.uid);
  if (!name || !Number.isInteger(uid) || uid <= 0) return null;

  const category: UpCategory = UP_CATEGORIES.includes(item.category as UpCategory)
    ? (item.category as UpCategory)
    : '二次元综合文化';

  return {
    id: typeof item.id === 'string' && item.id ? item.id : `up_custom_${uid}`,
    uid,
    name,
    category,
    tags:
      Array.isArray(item.tags) && item.tags.length
        ? item.tags.map(String).slice(0, 5)
        : deriveTags({ category, scores }),
    summary: String(item.summary ?? '').trim() || '用户添加的 UP 主',
    intro: String(item.intro ?? '').trim() || '这条档案由用户在设置页添加，尚未经过资料核实。',
    contentFocus: String(item.contentFocus ?? '').trim() || '（用户未填写）',
    observedStyle: Array.isArray(item.observedStyle) ? item.observedStyle.map(String).slice(0, 6) : [],
    scores,
    scoreRationale:
      String(item.scoreRationale ?? '').trim() ||
      '分数由用户在设置页填写，未逐条核对公开作品，仅供参考。',
    sources:
      Array.isArray(item.sources) && item.sources.length
        ? item.sources
        : [{ label: 'B站空间（用户提供）', url: `https://space.bilibili.com/${uid}` }],
    verification: 'unverified',
    image: typeof item.image === 'string' ? item.image : undefined,
    matchable: item.matchable !== false,
  };
}

/* ====================================================================== */
/* 组装生效名单                                                           */
/* ====================================================================== */

/**
 * 当前生效的 UP 主名单：
 *   基准数据 − 已移除 + 分数覆盖 + 自定义新增
 */
export function effectiveUps(state: RosterState): UpProfile[] {
  const hidden = new Set(state.hidden);

  const base = UPS.filter((up) => !hidden.has(up.id)).map((up) => {
    const override = state.overrides[up.id];
    return override ? { ...up, scores: { ...override } } : up;
  });

  // 自定义名单按 UID 去重，避免与基准数据撞车
  const takenUids = new Set(base.map((up) => up.uid));
  const custom = state.custom.filter((up) => !takenUids.has(up.uid));

  return [...base, ...custom];
}

/** 该 UP 主是否被本地改过分数 */
export function isOverridden(overrides: ScoreOverrides, id: string): boolean {
  return Boolean(overrides[id]);
}

/** 是否是自己添加的 */
export function isCustom(custom: UpProfile[], id: string): boolean {
  return custom.some((up) => up.id === id);
}

/** 本地调整总数（覆盖 + 自定义 + 移除） */
export function changeCount(state: RosterState): number {
  return Object.keys(state.overrides).length + state.custom.length + state.hidden.length;
}

/* ====================================================================== */
/* 导出                                                                   */
/* ====================================================================== */

/** 导出成可直接粘回 src/data/ups/group*.ts 的片段 */
export function exportAsTypeScript(state: RosterState): string {
  const lines: string[] = [
    '// 以下片段由「UP 主数据设置」页面导出',
    '// 用法：',
    '//   分数调整 → 替换对应 UP 主档案里的 scores 字段',
    '//   移除名单 → 把对应档案的 matchable 改成 false（或整条删除）',
    '//   新增 UP 主 → 按下面的对象补进 src/data/ups/group3.ts 的数组里',
    '',
  ];

  const overrideIds = Object.keys(state.overrides).sort();
  if (overrideIds.length) {
    lines.push('/* ---------- 1. 分数调整 ---------- */', '');
    for (const id of overrideIds) {
      const up = UPS.find((item) => item.id === id);
      lines.push(`// ${up ? `${up.name}（UID ${up.uid}）` : id}`);
      lines.push('    scores: {');
      for (const dimension of DIMENSION_IDS) {
        lines.push(`      ${dimension}: ${state.overrides[id][dimension]},`);
      }
      lines.push('    },', '');
    }
  }

  if (state.hidden.length) {
    lines.push('/* ---------- 2. 从匹配名单里移除 ---------- */', '');
    for (const id of [...state.hidden].sort()) {
      const up = UPS.find((item) => item.id === id);
      lines.push(`// ${up ? `${up.name}（UID ${up.uid}）` : id} → 把该档案的 matchable 改成 false`);
    }
    lines.push('');
  }

  if (state.custom.length) {
    lines.push('/* ---------- 3. 新增的 UP 主 ---------- */', '');
    for (const up of state.custom) {
      lines.push('  {');
      lines.push(`    id: '${up.id}',`);
      lines.push(`    uid: ${up.uid},`);
      lines.push(`    name: ${JSON.stringify(up.name)},`);
      lines.push(`    category: ${JSON.stringify(up.category)},`);
      lines.push(`    tags: [${up.tags.map((t) => JSON.stringify(t)).join(', ')}],`);
      lines.push(`    summary: ${JSON.stringify(up.summary)},`);
      lines.push(`    intro: ${JSON.stringify(up.intro)},`);
      lines.push(`    contentFocus: ${JSON.stringify(up.contentFocus)},`);
      lines.push('    observedStyle: [],');
      lines.push('    scores: {');
      for (const dimension of DIMENSION_IDS) {
        lines.push(`      ${dimension}: ${up.scores[dimension]},`);
      }
      lines.push('    },');
      lines.push(`    scoreRationale: ${JSON.stringify(up.scoreRationale)},`);
      lines.push('    sources: [');
      lines.push(`      { label: 'B站空间', url: 'https://space.bilibili.com/${up.uid}' },`);
      lines.push('    ],');
      lines.push("    verification: 'unverified',");
      lines.push('    matchable: true,');
      lines.push('  },');
      lines.push('');
    }
  }

  if (lines.length <= 6) return '// 当前没有任何本地调整\n';
  return lines.join('\n');
}

/** 导出成 JSON（便于备份或分享） */
export function exportAsJson(state: RosterState): string {
  return JSON.stringify(
    {
      version: 2,
      generatedAt: new Date().toISOString(),
      overrides: state.overrides,
      custom: state.custom,
      hidden: state.hidden,
    },
    null,
    2,
  );
}

/** 从 JSON 导入（兼容 v1 只有 overrides 的格式） */
export function importFromJson(text: string): { state: RosterState; imported: number; skipped: number } {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const source = (parsed.overrides ?? parsed) as Record<string, unknown>;
  const validIds = new Set(UPS.map((up) => up.id));

  const overrides: ScoreOverrides = {};
  let skipped = 0;

  for (const [id, value] of Object.entries(source)) {
    if (!validIds.has(id)) {
      skipped++;
      continue;
    }
    const candidate =
      value && typeof value === 'object' && 'scores' in (value as Record<string, unknown>)
        ? ((value as { scores: Partial<DimensionScores> }).scores ?? null)
        : (value as Partial<DimensionScores>);
    const clean = sanitizeScores(candidate ?? undefined);
    if (clean) overrides[id] = clean;
    else skipped++;
  }

  const custom: UpProfile[] = [];
  if (Array.isArray(parsed.custom)) {
    for (const item of parsed.custom) {
      const profile = sanitizeCustomProfile(item as Partial<UpProfile>);
      if (profile) custom.push(profile);
      else skipped++;
    }
  }

  const hidden: string[] = Array.isArray(parsed.hidden)
    ? parsed.hidden.filter((id): id is string => typeof id === 'string' && validIds.has(id))
    : [];

  return {
    state: { overrides, custom, hidden },
    imported: Object.keys(overrides).length + custom.length + hidden.length,
    skipped,
  };
}

/* ====================================================================== */
/* 增删                                                                   */
/* ====================================================================== */

/** 用表单输入构造一条完整的自定义档案 */
export function buildCustomProfile(input: CustomUpInput, existingIds: Iterable<string>): UpProfile {
  const uid = Number(input.uid);
  const scores = sanitizeScores(input.scores) ?? emptyScores();
  return {
    id: nextCustomId(existingIds),
    uid,
    name: String(input.name).trim(),
    category: input.category,
    tags: deriveTags({ category: input.category, scores, tags: input.tags }),
    summary: String(input.summary).trim(),
    intro: String(input.intro ?? '').trim() || '这条档案由用户在设置页添加，尚未经过资料核实。',
    contentFocus: String(input.contentFocus ?? '').trim() || '（用户未填写）',
    observedStyle: [],
    scores,
    scoreRationale: '分数由用户在设置页填写，未逐条核对公开作品，仅供参考。',
    sources: [
      {
        label: 'B站空间（用户提供）',
        url: input.sourceUrl?.trim() || `https://space.bilibili.com/${uid}`,
        fetchedAt: new Date().toISOString().slice(0, 10),
      },
    ],
    verification: 'unverified',
    matchable: true,
  };
}

/** 空白的 8 维分数（默认 50 中性，用户需要逐个调整） */
export function emptyScores(): DimensionScores {
  const scores = {} as DimensionScores;
  for (const id of DIMENSION_IDS) scores[id] = 50;
  return scores;
}
