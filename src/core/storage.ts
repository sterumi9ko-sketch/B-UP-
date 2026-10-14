import type { Answers, AnswerLevel } from '@core/types';
import { QUESTIONS } from '@data/questions';

/**
 * 本地答题记录
 * ---------------------------------------------------------------------------
 * 用户数据只存在浏览器 localStorage 里，不会上传到任何服务器。
 * 刷新页面、关掉浏览器再回来，都能恢复进度。
 */

const STORAGE_KEY = 'anime-up-match:progress';
/** 数据结构版本号：以后修改题目结构时递增，可自动丢弃不兼容的旧记录 */
const STORAGE_VERSION = 1;

export interface Progress {
  version: number;
  /** 题目 id → 选项索引 */
  answers: Answers;
  /** 当前正在回答第几题（从 0 开始） */
  index: number;
  /** 最近一次更新时间（毫秒时间戳） */
  updatedAt: number;
  /** 是否已经答完过一次（用于首页显示"继续上次的进度"） */
  finished: boolean;
}

export function createEmptyProgress(): Progress {
  return { version: STORAGE_VERSION, answers: {}, index: 0, updatedAt: Date.now(), finished: false };
}

/** localStorage 是否可用（隐私模式或被禁用时可能抛异常） */
export function storageAvailable(): boolean {
  try {
    const k = '__probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取进度。
 * 做了防御性处理：
 * - JSON 损坏、版本不符 → 返回空进度
 * - 题目 id 已不存在（题目被改过）→ 丢弃该条答案
 * - 选项索引越界 → 丢弃该条答案
 */
export function loadProgress(): Progress {
  const empty = createEmptyProgress();
  if (!storageAvailable()) return empty;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return empty;
  }
  if (!raw) return empty;

  try {
    const parsed = JSON.parse(raw) as Partial<Progress>;
    if (parsed.version !== STORAGE_VERSION || typeof parsed.answers !== 'object' || parsed.answers === null) {
      return empty;
    }

    const validIds = new Set(QUESTIONS.map((q) => q.id));
    const answers: Answers = {};
    for (const [id, value] of Object.entries(parsed.answers)) {
      if (!validIds.has(id)) continue;
      if (typeof value !== 'number' || value < 0 || value > 6) continue;
      answers[id] = value as AnswerLevel;
    }

    const maxIndex = Math.max(0, QUESTIONS.length - 1);
    const index = typeof parsed.index === 'number' ? Math.min(Math.max(0, Math.floor(parsed.index)), maxIndex) : 0;

    return {
      version: STORAGE_VERSION,
      answers,
      index,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      finished: parsed.finished === true,
    };
  } catch {
    return empty;
  }
}

/** 保存进度（写入失败时静默忽略，不影响答题） */
export function saveProgress(progress: Progress): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...progress, version: STORAGE_VERSION, updatedAt: Date.now() }),
    );
  } catch {
    /* 忽略：容量不足或隐私模式 */
  }
}

/** 清空进度（重新测试时调用） */
export function clearProgress(): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 忽略 */
  }
}

/** 统计已作答题数 */
export function answeredCount(answers: Answers): number {
  return QUESTIONS.reduce((n, q) => (answers[q.id] !== undefined ? n + 1 : n), 0);
}

/** 是否已答完全部题目 */
export function isComplete(answers: Answers): boolean {
  return answeredCount(answers) === QUESTIONS.length;
}

/** 找到第一道还没回答的题目下标（用于"继续答题"） */
export function firstUnansweredIndex(answers: Answers): number {
  const idx = QUESTIONS.findIndex((q) => answers[q.id] === undefined);
  return idx === -1 ? QUESTIONS.length - 1 : idx;
}
