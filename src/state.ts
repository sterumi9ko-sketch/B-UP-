import { clearProgress, loadProgress, saveProgress, firstUnansweredIndex, isComplete, answeredCount } from '@core/storage';
import { QUESTIONS } from '@data/questions';
import type { Answers, AnswerLevel, TestOutcome } from '@core/types';
import { evaluateTest } from '@core/match';
import {
  effectiveUps,
  loadOverrides,
  overrideCount,
  saveOverrides,
  type ScoreOverrides,
} from '@core/up-overrides';

/**
 * 应用状态
 * ---------------------------------------------------------------------------
 * 保存三样东西：
 *   1. 答题进度（answers / index）
 *   2. 最近一次结果（outcome）—— 算出来就固定，保证结果页、分享图、复制文案一致
 *   3. UP 主维度分数的本地覆盖（overrides）—— 由「UP 主数据设置」页面修改
 *
 * 注意：覆盖只存在本机 localStorage，不改动 src/data/ups 里的基准数据。
 */

const STORAGE_FLAG_RESULT_READY = 'anime-up-match:result-ready';

class AppState {
  answers: Answers = {};
  index = 0;
  outcome: TestOutcome | null = null;
  /** 是否是从"结果页"返回继续修改答案 */
  dirty = false;
  /** UP 主分数的本地覆盖 */
  overrides: ScoreOverrides = {};

  private listeners = new Set<() => void>();

  /** 从 localStorage 恢复进度与覆盖；如果已有完整作答，顺带把结果算出来 */
  hydrate(): void {
    const progress = loadProgress();
    this.answers = progress.answers;
    this.index = Math.min(progress.index, QUESTIONS.length - 1);
    this.overrides = loadOverrides();
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

  /** 当前生效的 UP 主名单（基准数据 + 本地覆盖） */
  get roster() {
    return effectiveUps(this.overrides);
  }

  /** 被本地调整过分数的 UP 主数量 */
  get overriddenCount(): number {
    return overrideCount(this.overrides);
  }

  /* ------------------------------------------------------------------ */
  /* UP 主分数覆盖                                                       */
  /* ------------------------------------------------------------------ */

  /** 设置某位 UP 主某个维度的分数（会自动夹到 0~100） */
  setScore(upId: string, dimension: keyof ReturnType<typeof effectiveUps>[number]['scores'], value: number): void {
    const current = this.overrides[upId] ?? { ...(this.roster.find((up) => up.id === upId)?.scores ?? {}) };
    const clamped = Math.round(Math.min(100, Math.max(0, value)));
    this.overrides = { ...this.overrides, [upId]: { ...current, [dimension]: clamped } as typeof current };
    saveOverrides(this.overrides);
    this.refreshOutcome();
    this.emit();
  }

  /** 把某位 UP 主的全部分数设成同一份值 */
  setScores(upId: string, scores: Record<string, number>): void {
    this.overrides = { ...this.overrides, [upId]: { ...scores } as never };
    saveOverrides(this.overrides);
    this.refreshOutcome();
    this.emit();
  }

  /** 撤销某位 UP 主的本地调整，回到源码里的基准值 */
  resetUp(upId: string): void {
    if (!(upId in this.overrides)) return;
    const next = { ...this.overrides };
    delete next[upId];
    this.overrides = next;
    saveOverrides(this.overrides);
    this.refreshOutcome();
    this.emit();
  }

  /** 撤销全部本地调整 */
  resetAllOverrides(): void {
    this.overrides = {};
    saveOverrides(this.overrides);
    this.refreshOutcome();
    this.emit();
  }

  /** 用一份导入的覆盖替换当前覆盖 */
  replaceOverrides(overrides: ScoreOverrides): void {
    this.overrides = overrides;
    saveOverrides(this.overrides);
    this.refreshOutcome();
    this.emit();
  }

  /**
   * 覆盖变更后重算结果。
   * 只有答完题（存在可复算的答案）时才重算；否则保持 null。
   * 这样设置页改完分数，回到结果页看到的就是新数据算出来的排名。
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
