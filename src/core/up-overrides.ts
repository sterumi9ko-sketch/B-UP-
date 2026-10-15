import { DIMENSION_IDS } from '@core/dimensions';
import type { DimensionScores, UpProfile } from '@core/types';
import { UPS } from '@data/ups';

/**
 * UP 主维度分数的「本地覆盖」层
 * ===========================================================================
 * 需求背景：
 *   有时候想不改源码就调整某位 UP 主的维度分数（例如觉得某个维度打高了），
 *   或者想导入一份别人分享的分数表试试效果。
 *
 * 设计取舍：
 *   - 源码里的 src/data/ups/*.ts 始终是「基准数据」，不被运行时改写。
 *   - 调整结果存到 localStorage（键名 anime-up-match:score-overrides），
 *     只影响本机、本浏览器，不会上传、也不会改动仓库文件。
 *   - 想永久生效时，用设置页的「导出」功能拿到 TypeScript 片段，
 *     粘回 src/data/ups/group*.ts 即可（这一步是人工确认的，避免误改）。
 *
 * 为什么不做成写文件：
 *   本站是纯静态站点，浏览器没有写项目文件的权限，这是浏览器的安全模型，
 *   不是实现难度问题。所以提供「本地覆盖 + 一键导出」的组合。
 */

const STORAGE_KEY = 'anime-up-match:score-overrides';

/** 分数覆盖表：UP 主 id → 维度分 */
export type ScoreOverrides = Record<string, DimensionScores>;

/** 允许的分数范围 */
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

function clampScore(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(Math.min(SCORE_MAX, Math.max(SCORE_MIN, num)));
}

/** 只保留合法字段，丢弃多余键与非法值 */
function sanitize(scores: Partial<DimensionScores> | undefined): DimensionScores | null {
  if (!scores || typeof scores !== 'object') return null;
  const out = {} as DimensionScores;
  let valid = 0;
  for (const id of DIMENSION_IDS) {
    const value = clampScore((scores as Record<string, unknown>)[id]);
    if (value === null) continue;
    out[id] = value;
    valid++;
  }
  // 至少要有一半维度合法才认这条覆盖，避免脏数据把整条画像搞坏
  if (valid < DIMENSION_IDS.length / 2) return null;
  // 缺失的维度用 50（中性）补齐
  for (const id of DIMENSION_IDS) if (out[id] === undefined) out[id] = 50;
  return out;
}

/** 读取全部覆盖 */
export function loadOverrides(): ScoreOverrides {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: ScoreOverrides = {};
    const validIds = new Set(UPS.map((up) => up.id));
    for (const [id, scores] of Object.entries(parsed)) {
      if (!validIds.has(id)) continue;
      const clean = sanitize(scores as Partial<DimensionScores>);
      if (clean) out[id] = clean;
    }
    return out;
  } catch {
    return {};
  }
}

/** 保存覆盖（传空对象即清除全部） */
export function saveOverrides(overrides: ScoreOverrides): void {
  try {
    if (Object.keys(overrides).length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* 隐私模式 / 容量不足时静默忽略 */
  }
}

/** 当前生效的 UP 主名单：基准数据 + 本地覆盖 */
export function effectiveUps(overrides: ScoreOverrides): UpProfile[] {
  return UPS.map((up) => {
    const override = overrides[up.id];
    if (!override) return up;
    return { ...up, scores: { ...override } };
  });
}

/** 该 UP 主是否被本地调整过 */
export function isOverridden(overrides: ScoreOverrides, id: string): boolean {
  return Boolean(overrides[id]);
}

/** 被调整过的 UP 主数量 */
export function overrideCount(overrides: ScoreOverrides): number {
  return Object.keys(overrides).length;
}

/**
 * 导出成可以直接粘回源码的 TypeScript 片段。
 * 只导出被调整过的条目，格式与 src/data/ups/*.ts 里的写法一致。
 */
export function exportAsTypeScript(overrides: ScoreOverrides): string {
  const ids = Object.keys(overrides).sort();
  if (ids.length === 0) return '// 当前没有调整任何 UP 主的分数\n';

  const lines = [
    '// 以下片段由「UP 主数据设置」页面导出',
    '// 使用方法：把对应条目的 scores 字段替换成下面的值，然后重新构建部署。',
    '',
  ];

  for (const id of ids) {
    const up = UPS.find((item) => item.id === id);
    const scores = overrides[id];
    lines.push(`// ${up ? `${up.name}（UID ${up.uid}）` : id}`);
    lines.push(`    scores: {`);
    for (const dimension of DIMENSION_IDS) {
      lines.push(`      ${dimension}: ${scores[dimension]},`);
    }
    lines.push(`    },`);
    lines.push('');
  }

  return lines.join('\n');
}

/** 导出成 JSON（便于分享或备份） */
export function exportAsJson(overrides: ScoreOverrides): string {
  const ids = Object.keys(overrides).sort();
  const payload: Record<string, unknown> = {};
  for (const id of ids) {
    const up = UPS.find((item) => item.id === id);
    payload[id] = { name: up?.name ?? '', uid: up?.uid ?? 0, scores: overrides[id] };
  }
  return JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), overrides: payload }, null, 2);
}

/**
 * 从 JSON 导入覆盖。
 * 兼容两种格式：
 *   1. 本模块导出的 { version, overrides: { id: { scores } } }
 *   2. 直接的 { id: scores }
 */
export function importFromJson(text: string): { overrides: ScoreOverrides; imported: number; skipped: number } {
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
    const clean = sanitize(candidate ?? undefined);
    if (clean) overrides[id] = clean;
    else skipped++;
  }

  return { overrides, imported: Object.keys(overrides).length, skipped };
}
