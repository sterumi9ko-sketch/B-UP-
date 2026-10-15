import { clearProgress, loadProgress, saveProgress, firstUnansweredIndex, isComplete, answeredCount } from '@core/storage';
import { QUESTIONS } from '@data/questions';
import type { Answers, AnswerLevel, TestOutcome } from '@core/types';
import { evaluateTest } from '@core/match';
import {
  buildCustomProfile,
  changeCount,
  effectiveUps,
  emptyScores,
  isCustom,
  loadCustomUps,
  loadHidden,
  loadOverrides,
  saveCustomUps,
  saveHidden,
  saveOverrides,
  type CustomUpInput,
  type RosterState,
  type ScoreOverrides,
} from '@core/up-overrides';
import type { UpProfile } from '@core/types';

/** 把分数夹到 0~100 的整数 */
function clamp100(value: number): number {
  return Math.round(Math.min(100, Math.max(0, Number(value) || 0)));
}

/**
 * 应用状态
 * ---------------------------------------------------------------------------
 * 保存四样东西：
 *   1. 答题进度（answers / index）
 *   2. 最近一次结果（outcome）—— 算出来就固定，保证结果页、分享图、复制文案一致
 *   3. UP 主名单的本地调整（分数覆盖 / 新增 / 移除），由「UP 主数据设置」页修改
 *
 * 注意：这些调整只存在本机 localStorage，不改动 src/data/ups 里的基准数据。
 */

const STORAGE_FLAG_RESULT_READY = 'anime-up-match:result-ready';

class AppState {
  answers: Answers = {};
  index = 0;
  outcome: TestOutcome | null = null;
  /** 是否是从"结果页"返回继续修改答案 */
  dirty = false;

  /** 分数覆盖：UP 主 id → 8 维分数 */
  overrides: ScoreOverrides = {};
  /** 用户自己添加的 UP 主 */
  custom: UpProfile[] = [];
  /** 被移出匹配名单的现有 UP 主 id */
  hidden: string[] = [];

  private listeners = new Set<() => void>();

  /** 从 localStorage 恢复进度与名单调整；如果已有完整作答，顺带把结果算出来 */
  hydrate(): void {
    const progress = loadProgress();
    this.answers = progress.answers;
    this.index = Math.min(progress.index, QUESTIONS.length - 1);
    this.overrides = loadOverrides();
    this.custom = loadCustomUps();
    this.hidden = loadHidden();
    if (isComplete(this.answers) && this.hasStoredResult()) {
      this.outcome = evaluateTest(QUESTIONS, this.answers, this.roster);
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private persist(finished = false): void {
    saveProgress({
      version: 1,
      answers: this.answers,
      index: this.index,
      updatedAt: Date.now(),
      finished,
    });
  }

  /** 本地名单调整的完整状态 */
  get rosterState(): RosterState {
    return { overrides: this.overrides, custom: this.custom, hidden: this.hidden };
  }

  /** 当前生效的 UP 主名单（基准数据 − 已移除 + 覆盖 + 新增） */
  get roster(): UpProfile[] {
    return effectiveUps(this.rosterState);
  }

  /** 本地调整总数（覆盖 + 新增 + 移除） */
  get changeCount(): number {
    return changeCount(this.rosterState);
  }

  /** 被本地改过分数的数量 */
  get overriddenCount(): number {
    return Object.keys(this.overrides).length;
  }

  /** 自己添加的 UP 主数量 */
  get customCount(): number {
    return this.custom.length;
  }

  /** 被移出名单的数量 */
  get hiddenCount(): number {
    return this.hidden.length;
  }

  /** 某位 UP 主是否是自己添加的 */
  isCustomUp(id: string): boolean {
    return isCustom(this.custom, id);
  }

  /* ------------------------------------------------------------------ */
  /* 分数调整                                                            */
  /* ------------------------------------------------------------------ */

  /** 设置某位 UP 主某个维度的分数（自动夹到 0~100） */
  setScore(upId: string, dimension: keyof ScoreOverrides[string], value: number): void {
    // 自定义 UP 主的分数直接改它自己的档案，不写进覆盖表
    if (this.isCustomUp(upId)) {
      this.custom = this.custom.map((up) =>
        up.id === upId ? { ...up, scores: { ...up.scores, [dimension]: clamp100(value) } } : up,
      );
      saveCustomUps(this.custom);
    } else {
      const zone = this.roster.find((up) => up.id === upId);
      const current = this.overrides[upId] ?? { ...(zone?.scores ?? emptyScores()) };
      this.overrides = { ...this.overrides, [upId]: { ...current, [dimension]: clamp100(value) } };
      saveOverrides(this.overrides);
    }
    this.refreshOutcome();
    this.emit();
  }

  /** 覆盖某位 UP 主的全部维度分数 */
  setScores(upId: string, scores: Record<string, number>): void {
    const cleaned = emptyScores();
    for (const [key, value] of Object.entries(scores)) {
      cleaned[key as keyof ScoreOverrides[string]] = clamp100(value);
    }

    if (this.isCustomUp(upId)) {
      this.custom = this.custom.map((up) => (up.id === upId ? { ...up, scores: cleaned } : up));
      saveCustomUps(this.custom);
    } else {
      this.overrides = { ...this.overrides, [upId]: cleaned };
      saveOverrides(this.overrides);
    }
    this.refreshOutcome();
    this.emit();
  }

  /** 撤销某位 UP 主的本地分数调整，回到基准值 */
  resetUp(upId: string): void {
    if (!(upId in this.overrides)) return;
    const next = { ...this.overrides };
    delete next[upId];
    this.overrides = next;
    saveOverrides(this.overrides);
    this.refreshOutcome();
    this.emit();
  }

  /* ------------------------------------------------------------------ */
  /* 增删 UP 主                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * 添加一位 UP 主。
   * 数据必须完整（调用方应先跑 validateCustomUp 校验），这里只负责写入。
   */
  addCustomUp(input: CustomUpInput): UpProfile {
    const takenIds = [...this.roster.map((up) => up.id), ...this.custom.map((up) => up.id)];
    const profile = buildCustomProfile(input, takenIds);
    this.custom = [...this.custom, profile];
    saveCustomUps(this.custom);
    this.refreshOutcome();
    this.emit();
    return profile;
  }

  /** 删除自己添加的 UP 主 */
  removeCustomUp(id: string): void {
    if (!this.isCustomUp(id)) return;
    this.custom = this.custom.filter((up) => up.id !== id);
    saveCustomUps(this.custom);
    this.refreshOutcome();
    this.emit();
  }

  /**
   * 把一位 UP 主移出名单。
   * 对自定义 UP 主等价于删除；对基准数据只是移出（可随时恢复）。
   */
  hideUp(id: string): void {
    if (this.isCustomUp(id)) {
      this.removeCustomUp(id);
      return;
    }
    if (this.hidden.includes(id)) return;
    this.hidden = [...this.hidden, id];
    saveHidden(this.hidden);
    this.refreshOutcome();
    this.emit();
  }

  /** 把移出的 UP 主放回名单 */
  unhideUp(id: string): void {
    if (!this.hidden.includes(id)) return;
    this.hidden = this.hidden.filter((item) => item !== id);
    saveHidden(this.hidden);
    this.refreshOutcome();
    this.emit();
  }

  /** 撤销全部本地调整（分数 / 新增 / 移除都清掉） */
  resetAll(): void {
    this.overrides = {};
    this.custom = [];
    this.hidden = [];
    saveOverrides({});
    saveCustomUps([]);
    saveHidden([]);
    this.refreshOutcome();
    this.emit();
  }

  /** 用一份导入的数据替换当前名单调整 */
  replaceRoster(next: RosterState): void {
    this.overrides = next.overrides;
    this.custom = next.custom;
    this.hidden = next.hidden;
    saveOverrides(this.overrides);
    saveCustomUps(this.custom);
    saveHidden(this.hidden);
    this.refreshOutcome();
    this.emit();
  }

  /**
   * 名单变更后重算结果。
   * 只有答完题时才重算；否则保持 null。
   */
  private refreshOutcome(): void {
    if (!this.isComplete) return;
    this.outcome = evaluateTest(QUESTIONS, this.answers, this.roster);
  }

  get total(): number {
    return QUESTIONS.length;
  }

  get currentQuestion() {
    return QUESTIONS[this.index];
  }

  get answeredCount(): number {
    return answeredCount(this.answers);
  }

  get completion(): number {
    return this.answeredCount / this.total;
  }

  get isComplete(): boolean {
    return isComplete(this.answers);
  }

  answer(questionId: string, level: AnswerLevel): void {
    this.answers[questionId] = level;
    this.dirty = true;
    this.persist();
    this.emit();
  }

  goTo(index: number): void {
    this.index = Math.min(Math.max(0, index), this.total - 1);
    this.persist();
    this.emit();
  }

  next(): void {
    if (this.index < this.total - 1) this.goTo(this.index + 1);
  }

  prev(): void {
    if (this.index > 0) this.goTo(this.index - 1);
  }

  /** 跳到第一道未作答的题目 */
  jumpToFirstUnanswered(): void {
    this.goTo(firstUnansweredIndex(this.answers));
  }

  /** 提交：计算并固定结果 */
  submit(): TestOutcome {
    const outcome = evaluateTest(QUESTIONS, this.answers, this.roster);
    this.outcome = outcome;
    this.dirty = false;
    this.persist(true);
    try {
      window.localStorage.setItem(STORAGE_FLAG_RESULT_READY, '1');
    } catch {
      /* 忽略 */
    }
    this.emit();
    return outcome;
  }

  /** 清空全部进度，重新开始（不清除 UP 主分数覆盖） */
  reset(): void {
    this.answers = {};
    this.index = 0;
    this.outcome = null;
    this.dirty = false;
    clearProgress();
    try {
      window.localStorage.removeItem(STORAGE_FLAG_RESULT_READY);
    } catch {
      /* 忽略 */
    }
    this.emit();
  }

  /**
   * 重新计算当前结果（不改动答案）。
   * 用途：UP 主数据更新后，让结果页反映最新数据。
   */
  recompute(): TestOutcome | null {
    if (!this.isComplete) return null;
    this.outcome = evaluateTest(QUESTIONS, this.answers, this.roster);
    return this.outcome;
  }

  private hasStoredResult(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_FLAG_RESULT_READY) === '1';
    } catch {
      return false;
    }
  }
}

export const state = new AppState();
