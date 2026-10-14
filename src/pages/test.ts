import { QUESTION_COUNT, QUESTIONS } from '@data/questions';
import { DIMENSION_MAP } from '@core/dimensions';
import { state } from '@state';
import { create, nextFrame, toast } from '@ui/dom';
import { createScale, type ScaleComponent } from '@ui/components/scale';
import { navigate } from '@ui/router';
import type { AnswerLevel } from '@core/types';
import type { PageRenderer } from '@ui/page-types';

/**
 * 答题页
 * ---------------------------------------------------------------------------
 * 流程：
 *   - 一次显示一道题，选择后短暂反馈再自动进入下一题（可关闭自动跳转）
 *   - 上一题 / 下一题按钮随时可用，返回上一题会保留原来的选择
 *   - 底部有题号网格，可以快速跳到任意题目检查
 *   - 答完全部题目后按钮变为"查看我的 UP 主匹配结果"；未答完不允许提交
 *   - 进度实时写入 localStorage，刷新页面不丢
 */
export const renderTest: PageRenderer = () => {
  const scaleHost = create('div');
  const progressBar = create('div', { class: 'progress__bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' });
  const progressText = create('span', { class: 'text-muted' });
  const progressPercent = create('span', { class: 'text-muted' });
  const questionIndexLabel = create('p', { class: 'question-card__index' });
  const questionText = create('p', { class: 'question-card__text', id: 'question-text' });
  const questionHint = create('p', { class: 'question-card__hint' });
  const card = create('article', { class: 'question-card', 'aria-labelledby': 'question-text' }, [
    questionIndexLabel,
    questionText,
    questionHint,
    scaleHost,
  ]);

  const counter = create('span', { class: 'quiz__counter' });
  const prevButton = create('button', { class: 'btn btn--secondary', type: 'button', text: '上一题' });
  const nextButton = create('button', { class: 'btn', type: 'button', text: '下一题' });

  const autoAdvanceToggle = create('input', {
    type: 'checkbox',
    id: 'auto-advance',
    checked: 'checked',
  });
  const autoAdvanceRow = create('label', {
    class: 'text-muted',
    for: 'auto-advance',
    style: 'display:inline-flex; align-items:center; gap: var(--space-2); font-size: var(--text-sm); cursor:pointer;',
  }, [autoAdvanceToggle, create('span', { text: '选择后自动进入下一题' })]);

  const gridHost = create('div', { class: 'question-grid' });
  const gridSection = create('details', { class: 'card card--flat', style: 'margin-top: var(--space-5);' }, [
    create('summary', { text: '题目速览（可跳转检查）', style: 'cursor:pointer; font-weight:600;' }),
    create('div', { style: 'margin-top: var(--space-4);' }, [gridHost]),
  ]);

  const actions = create('div', { class: 'quiz__actions' }, [prevButton, counter, nextButton]);

  const container = create('div', { class: 'container' }, [
    create('div', { class: 'quiz' }, [
      create('div', { class: 'quiz__topbar' }, [
        create('span', { text: '创作风格测试' }),
        create('span', { class: 'quiz__counter', text: `共 ${QUESTION_COUNT} 题` }),
      ]),
      create('div', { class: 'progress' }, [progressBar]),
      create('div', { class: 'progress__legend' }, [progressText, progressPercent]),
      card,
      actions,
      create('p', { class: 'quiz__hint' }, [
        autoAdvanceRow,
      ]),
      gridSection,
    ]),
  ]);

  /* ------------------------------------------------------------------ */
  /* 状态与渲染                                                          */
  /* ------------------------------------------------------------------ */
  let scale: ScaleComponent | null = null;
  let advancing = false;
  let autoAdvanceTimer: number | undefined;

  function currentAnswer(): AnswerLevel | null {
    const question = QUESTIONS[state.index];
    const value = state.answers[question.id];
    return value === undefined ? null : value;
  }

  function isLastQuestion(): boolean {
    return state.index === QUESTIONS.length - 1;
  }

  function renderProgress(): void {
    const percent = Math.round(state.completion * 100);
    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute('aria-valuenow', String(percent));
    progressText.textContent = `已完成 ${state.answeredCount} / ${QUESTION_COUNT}`;
    progressPercent.textContent = `${percent}%`;
  }

  function renderGrid(): void {
    gridHost.innerHTML = '';
    QUESTIONS.forEach((question, index) => {
      const button = create('button', {
        class: 'question-grid__item',
        type: 'button',
        text: String(index + 1),
        'data-answered': state.answers[question.id] === undefined ? 'false' : 'true',
        'aria-label': `第 ${index + 1} 题${state.answers[question.id] === undefined ? '（未作答）' : '（已作答）'}`,
      });
      if (index === state.index) button.setAttribute('aria-current', 'true');
      button.addEventListener('click', () => {
        state.goTo(index);
        renderQuestion(false);
      });
      gridHost.append(button);
    });
  }

  function renderActions(): void {
    prevButton.disabled = state.index === 0;
    counter.textContent = `第 ${state.index + 1} / ${QUESTION_COUNT} 题`;

    if (isLastQuestion()) {
      const complete = state.isComplete;
      nextButton.textContent = complete ? '查看我的 UP 主匹配结果' : '检查未答完的题目';
      nextButton.disabled = false;
      nextButton.classList.toggle('btn--secondary', !complete);
    } else {
      nextButton.textContent = '下一题';
      nextButton.disabled = false;
      nextButton.classList.toggle('btn--secondary', false);
    }
  }

  /** 渲染当前题目；animate=true 时播放切换动画 */
  function renderQuestion(animate = true): void {
    const question = QUESTIONS[state.index];
    const dimension = DIMENSION_MAP[question.dimension];
    const answer = currentAnswer();

    const doRender = () => {
      questionIndexLabel.textContent = `第 ${state.index + 1} 题 / 共 ${QUESTION_COUNT} 题 · ${dimension.name}`;
      questionText.textContent = question.text;
      questionHint.textContent = answer === null
        ? `这一题看的是「${dimension.name}」。按你平时真实的习惯选就好，不用考虑"哪种更好"。`
        : `这一题看的是「${dimension.name}」。你上次选的是「${answerLabel(answer)}」，可以随时改动。`;

      scaleHost.innerHTML = '';
      scale = createScale({
        value: answer,
        labelledBy: 'question-text',
        onChange: (level) => {
          state.answer(question.id, level);
          questionHint.textContent = `这一题看的是「${dimension.name}」。已记录：${answerLabel(level)}。`;
          renderProgress();
          renderGrid();
          renderActions();

          if (autoAdvanceToggle.checked && !isLastQuestion()) {
            advancing = true;
            if (autoAdvanceTimer) window.clearTimeout(autoAdvanceTimer);
            autoAdvanceTimer = window.setTimeout(() => {
              advancing = false;
              if (!isLastQuestion()) {
                state.next();
                renderQuestion(true);
              }
            }, 320);
          }
        },
      });
      scaleHost.append(scale.element);

      renderProgress();
      renderGrid();
      renderActions();

      if (animate) {
        card.classList.remove('question-card--leaving');
        card.style.animation = 'none';
        nextFrame(() => {
          card.style.animation = '';
        });
      }
    };

    if (!animate) {
      doRender();
      return;
    }

    // 切换动画：旧卡片淡出，新卡片升起
    card.classList.add('question-card--leaving');
    window.setTimeout(() => {
      card.classList.remove('question-card--leaving');
      doRender();
      nextFrame(() => {
        card.style.animation = 'none';
        nextFrame(() => {
          card.style.animation = '';
        });
      });
    }, 140);
  }

  /* ------------------------------------------------------------------ */
  /* 事件                                                                */
  /* ------------------------------------------------------------------ */
  prevButton.addEventListener('click', () => {
    if (advancing) return;
    state.prev();
    renderQuestion(true);
  });

  nextButton.addEventListener('click', () => {
    if (advancing) return;
    if (isLastQuestion()) {
      if (!state.isComplete) {
        const missing = QUESTION_COUNT - state.answeredCount;
        toast(`还有 ${missing} 题没有作答，已经帮你跳到第一道未作答的题目`);
        state.jumpToFirstUnanswered();
        renderQuestion(true);
        return;
      }
      submit();
      return;
    }
    state.next();
    renderQuestion(true);
  });

  function submit(): void {
    if (!state.isComplete) {
      toast('请先答完全部题目');
      return;
    }
    state.submit();
    navigate('/result');
  }

  const onKeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    // 在输入框/按钮上不劫持按键
    if (target.closest('input, textarea, select')) return;
    if (event.key === 'ArrowRight' && (event.altKey || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      nextButton.click();
    } else if (event.key === 'ArrowLeft' && (event.altKey || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      prevButton.click();
    }
  };
  window.addEventListener('keydown', onKeydown);

  const cleanup = () => {
    window.removeEventListener('keydown', onKeydown);
    if (autoAdvanceTimer) window.clearTimeout(autoAdvanceTimer);
  };

  renderQuestion(false);

  return { element: container, cleanup };
};

function answerLabel(level: AnswerLevel): string {
  return ['完全认同', '非常认同', '比较认同', '中立', '不太认同', '非常不认同', '完全不认同'][level] ?? '';
}
