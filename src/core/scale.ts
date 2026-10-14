import { siteConfig } from '@config';
import type { AnswerLevel } from '@core/types';

/**
 * 7 级作答刻度
 * ---------------------------------------------------------------------------
 * 分值定义在 src/config.ts 的 test.scale 里：完全认同 +3 → 完全不认同 -3。
 * 这里只负责把选项索引翻译成分值、以及把选项翻译成可读文案。
 */

export interface ScaleOption {
  /** 选项索引 0~6 */
  level: AnswerLevel;
  /** 分值，反向题需要取反 */
  value: number;
  /** 主文案 */
  label: string;
  /** 辅助文案（鼠标悬停/无障碍朗读） */
  hint: string;
  /** 该选项属于"认同 / 中立 / 不认同"哪一侧 */
  side: 'agree' | 'neutral' | 'disagree';
  /** 相对大小档位 0~3，用于把圆点画成大中小 */
  size: 0 | 1 | 2 | 3;
}

const LABELS = [
  { label: '完全认同', hint: '说得太对了，完全是我' },
  { label: '非常认同', hint: '基本就是我' },
  { label: '比较认同', hint: '稍微偏认同' },
  { label: '中立', hint: '说不好 / 两者都行' },
  { label: '不太认同', hint: '稍微偏不认同' },
  { label: '非常不认同', hint: '基本不是我' },
  { label: '完全不认同', hint: '完全不是我' },
] as const;

/**
 * 生成 7 个选项。
 * 圆点大小：两端最大（3），向中间递减，中立最小（0）。
 */
export const SCALE_OPTIONS: ScaleOption[] = siteConfig.test.scale.map((value, index) => {
  const level = index as AnswerLevel;
  const side: ScaleOption['side'] = index < 3 ? 'agree' : index > 3 ? 'disagree' : 'neutral';
  const distance = Math.abs(index - 3);
  const size = (side === 'neutral' ? 0 : distance) as ScaleOption['size'];
  const meta = LABELS[index];
  return { level, value, label: meta.label, hint: meta.hint, side, size };
});

/** 选项索引 → 分值 */
export function valueOfLevel(level: AnswerLevel): number {
  return siteConfig.test.scale[level] ?? 0;
}

/** 选项索引 → 文案 */
export function labelOfLevel(level: AnswerLevel): string {
  return LABELS[level]?.label ?? '';
}

/**
 * 计算某题实际计入的分值。
 * 反向题取反：这样"完全认同一个反向题"等价于"完全不认同一个正向题"。
 */
export function scoreForAnswer(level: AnswerLevel, reverse: boolean): number {
  const v = valueOfLevel(level);
  return reverse ? -v : v;
}

/** 判断一次作答是否"明确"（选了 ±2 或 ±3） */
export function isDecisive(level: AnswerLevel): boolean {
  return level <= 1 || level >= 5;
}
