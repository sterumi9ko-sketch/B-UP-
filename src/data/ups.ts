import type { UpProfile } from '@core/types';
import { UPS_GROUP_1 } from '@data/ups/group1';
import { UPS_GROUP_2 } from '@data/ups/group2';
import { UPS_GROUP_3 } from '@data/ups/group3';

/**
 * UP 主名单（统一出口）
 * ---------------------------------------------------------------------------
 * 要增删 UP 主时：
 *   1. 在 src/data/ups/ 下选一个分组文件（或新建 group4.ts）
 *   2. 按 UpProfile 结构添加一条档案，id 用 up_0XX 形式且全站唯一
 *   3. 到这里把新分组的数组加进 ALL_GROUPS
 *   4. 在 docs/ASSETS.md 里补一行头像对照表
 *
 * 名单里所有 UP 主的 UID 都经过 B 站公开接口核实；
 * 每位档案都带 sources 与 verification 字段，方便复核。
 */
const ALL_GROUPS: UpProfile[][] = [UPS_GROUP_1, UPS_GROUP_2, UPS_GROUP_3];

/** 全部 UP 主（含不参与匹配的条目，例如团队账号） */
export const UPS: UpProfile[] = ALL_GROUPS.flat();

/**
 * 默认排序：粉丝数从高到低（没有粉丝快照的排在最后），
 * 这个顺序用于图鉴页的"默认视图"与文档中的名单排列。
 */
export function sortByFans(list: UpProfile[] = UPS): UpProfile[] {
  return [...list].sort((a, b) => (b.fansSnapshot ?? -1) - (a.fansSnapshot ?? -1));
}

/** 参与匹配的 UP 主（matchable === true） */
export const MATCHABLE_UPS: UpProfile[] = UPS.filter((up) => up.matchable);

/** 按 UID 查找 */
export function findUpByUid(uid: number | string): UpProfile | undefined {
  const target = String(uid);
  return UPS.find((up) => String(up.uid) === target);
}

/** 开发期自检：id 与 uid 必须唯一，否则会污染图片映射与匹配结果 */
export function validateUps(list: UpProfile[] = UPS): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const uids = new Set<number>();

  for (const up of list) {
    if (ids.has(up.id)) problems.push(`重复的 id：${up.id}`);
    ids.add(up.id);

    if (uids.has(up.uid)) problems.push(`重复的 uid：${up.uid}（${up.name}）`);
    uids.add(up.uid);

    if (!up.name || !up.summary || !up.intro) problems.push(`${up.id} 缺少必要文本字段`);
    if (up.tags.length < 3) problems.push(`${up.id} 的风格标签少于 3 个`);
    if (!up.sources.length) problems.push(`${up.id} 没有资料来源`);
  }
  return problems;
}
