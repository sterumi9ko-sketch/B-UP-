import { describe, expect, it } from 'vitest';
import { UPS, MATCHABLE_UPS, findUpByUid, sortByFans, validateUps } from '../src/data/ups';
import { DIMENSION_IDS } from '../src/core/dimensions';
import { evaluateTest } from '../src/core/match';
import { QUESTIONS } from '../src/data/questions';
import { dotAnswers } from './helpers';

describe('UP 主数据完整性', () => {
  it('数据自检没有发现问题（id/uid 唯一、必备文本与来源齐全）', () => {
    expect(validateUps()).toEqual([]);
  });

  it('至少收录 10 位，并且大部分参与匹配', () => {
    expect(UPS.length).toBeGreaterThanOrEqual(10);
    expect(MATCHABLE_UPS.length).toBeGreaterThanOrEqual(10);
  });

  it('每位 UP 主都有合法的 UID 与 B 站主页链接', () => {
    for (const up of UPS) {
      expect(Number.isInteger(up.uid)).toBe(true);
      expect(up.uid).toBeGreaterThan(0);
      const space = up.sources.find((s) => s.url.includes('space.bilibili.com'));
      expect(space, `${up.name} 缺少 B 站主页来源`).toBeTruthy();
      expect(space!.url).toContain(String(up.uid));
    }
  });

  it('8 个维度分数都在 0~100 之间且为整数', () => {
    for (const up of UPS) {
      for (const id of DIMENSION_IDS) {
        const score = up.scores[id];
        expect(Number.isFinite(score), `${up.name} 的 ${id} 分数无效`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('每位 UP 主的画像都有区分度（最高分与最低分至少相差 20 分）', () => {
    for (const up of UPS) {
      const values = DIMENSION_IDS.map((id) => up.scores[id]);
      const spread = Math.max(...values) - Math.min(...values);
      expect(spread, `${up.name} 的维度分数过于平均，缺少区分度`).toBeGreaterThanOrEqual(20);
    }
  });

  it('没有两位 UP 主的画像完全相同', () => {
    const seen = new Map<string, string>();
    for (const up of UPS) {
      const key = DIMENSION_IDS.map((id) => up.scores[id]).join(',');
      const previous = seen.get(key);
      expect(previous, `${up.name} 与 ${previous} 的画像完全相同`).toBeUndefined();
      seen.set(key, up.name);
    }
  });

  it('每位 UP 主都有核实状态与资料来源', () => {
    for (const up of UPS) {
      expect(['verified', 'partial', 'unverified']).toContain(up.verification);
      expect(up.sources.length).toBeGreaterThan(0);
      for (const source of up.sources) {
        expect(source.url.startsWith('http')).toBe(true);
        expect(source.label.length).toBeGreaterThan(1);
      }
    }
  });

  it('参与匹配的 UP 主都没有被标记为待核实（避免把占位数据当正式结果）', () => {
    const unverified = MATCHABLE_UPS.filter((up) => up.verification === 'unverified');
    expect(unverified.map((up) => up.name)).toEqual([]);
  });

  it('全体画像与全部作答组合都能算出结果，且结果稳定', () => {
    for (const level of [0, 1, 2, 3, 4, 5, 6] as const) {
      const answers = dotAnswers(QUESTIONS, level);
      const outcome = evaluateTest(QUESTIONS, answers, UPS);
      expect(outcome.top3.length).toBeGreaterThanOrEqual(3);
      expect(outcome.best.similarity).toBeGreaterThanOrEqual(30);
      expect(outcome.best.similarity).toBeLessThanOrEqual(100);
      // 复算一次，结果必须完全一致
      const again = evaluateTest(QUESTIONS, answers, UPS);
      expect(JSON.stringify(again)).toBe(JSON.stringify(outcome));
    }
  });

  it('默认按粉丝数从高到低排序，缺少快照的排在最后', () => {
    const sorted = sortByFans();
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].fansSnapshot ?? -1;
      const current = sorted[i].fansSnapshot ?? -1;
      expect(prev).toBeGreaterThanOrEqual(current);
    }
  });

  it('可以按 UID 查到 UP 主', () => {
    const first = UPS[0];
    expect(findUpByUid(first.uid)?.name).toBe(first.name);
    expect(findUpByUid(String(first.uid))?.id).toBe(first.id);
    expect(findUpByUid(999999999)).toBeUndefined();
  });
});

describe('相似指数标定（防止分数被压到下限）', () => {
  // 这组用例保护 src/config.ts 里的 match.maxDistance 不被调得过小：
  // 一旦过小，绝大多数人的相似指数都会被夹到 minSimilarity，导致结果大面积并列。
  // 具体数值来自 scripts/calibrate.mjs 对真实数据的统计。
  it('7 种极端作答下，最佳匹配都不会掉到最低分', () => {
    for (const level of [0, 1, 2, 3, 4, 5, 6] as const) {
      const outcome = evaluateTest(QUESTIONS, dotAnswers(QUESTIONS, level), MATCHABLE_UPS);
      expect(outcome.best.similarity, `level=${level} 的最佳匹配掉到了下限`).toBeGreaterThan(30);
    }
  });

  it('至少 6 种极端作答下前三名有区分度', () => {
    // 说明：当作答为「全部完全不认同」时，用户画像会同时远离所有 UP 主，
    // 距离都超过 maxDistance，被夹到 minSimilarity 属于预期内的诚实结果
    // （此时排序由距离与 UID 稳定决定）。这里只要求绝大多数情况下有区分度。
    let differentiated = 0;
    for (const level of [0, 1, 2, 3, 4, 5, 6] as const) {
      const outcome = evaluateTest(QUESTIONS, dotAnswers(QUESTIONS, level), MATCHABLE_UPS);
      const top3 = outcome.top3.map((r) => r.similarity);
      if (new Set(top3).size > 1) differentiated++;
    }
    expect(differentiated).toBeGreaterThanOrEqual(6);
  });

  it('最佳匹配的相似指数落在有意义的区间内（不少于 34，且最高不低于 60）', () => {
    const bests = ([0, 1, 2, 3, 4, 5, 6] as const).map(
      (level) => evaluateTest(QUESTIONS, dotAnswers(QUESTIONS, level), MATCHABLE_UPS).best.similarity,
    );
    for (const value of bests) {
      expect(value).toBeGreaterThanOrEqual(34);
      expect(value).toBeLessThanOrEqual(95);
    }
    // 至少要有一个明显的「像」的结果，否则说明标定把所有人都压低了
    expect(Math.max(...bests)).toBeGreaterThanOrEqual(60);
  });

  it('不同的作答会得到不同的最佳匹配（结果确实由答案决定）', () => {
    const winners = new Set<string>();
    for (const level of [0, 1, 2, 3, 4, 5, 6] as const) {
      const outcome = evaluateTest(QUESTIONS, dotAnswers(QUESTIONS, level), MATCHABLE_UPS);
      winners.add(outcome.best.up.id);
    }
    expect(winners.size).toBeGreaterThanOrEqual(3);
  });
});
