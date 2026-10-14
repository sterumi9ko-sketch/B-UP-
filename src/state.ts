import { clearProgress, loadProgress, saveProgress, firstUnansweredIndex, isComplete, answeredCount } from '@core/storage';
import { QUESTIONS } from '@data/questions';
import type { Answers, AnswerLevel, TestOutcome } from '@core/types';
import { evaluateTest } from '@core/match';
import { UPS } from '@data/ups';

/**
 * 应用状态
 * ---------------------------------------------------------------------------
 * 只保存"答题进度"和"最近一次结果"。
 * 结果一旦算出来就固定下来，保证结果页、分享图、复制文案用的是同一份数据。
 */

const STORAGE_FLAG_RESULT_READY = 'anime-up-match:result-ready';

class AppState {
  answers: Answers = {};
  index = 0;
  outcome: TestOutcome | null = null;
  /** 是否是从"结果页"返回继续修改答案 */
  dirty = false;

  private listeners = new Set<() => void>();

  /** 从 localStorage 恢复进度；如果已有完整作答，顺带把结果算出来 */
  hydrate(): void {
    const progress = loadProgress();
    this.answers = progress.answers;
    this.index = Math.min(progress.index, QUESTIONS.length - 1);
    if (isComplete(this.answers) && this.hasStoredResult()) {
      this.outcome = evaluateTest(QUESTIONS, this.answers, UPS);
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
    const outcome = evaluateTest(QUESTIONS, this.answers, UPS);
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

  /** 清空全部进度，重新开始 */
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
    this.outcome = evaluateTest(QUESTIONS, this.answers, UPS);
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
