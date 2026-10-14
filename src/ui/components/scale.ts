import { SCALE_OPTIONS } from '@core/scale';
import type { AnswerLevel } from '@core/types';
import { create } from '@ui/dom';

/**
 * 7 级作答组件
 * ---------------------------------------------------------------------------
 * 交互与无障碍设计：
 *   - 7 个可点击圆点横向排列，认同（左 3 个）/ 中立（中间）/ 不认同（右 3 个）三色区分。
 *   - 圆点大小随认同强度变化：两端最大、中立最小；选中后再加外环与填充。
 *   - 含义同时通过"颜色 + 大小 + 文字 + 选中状态"四种通道传达，不只依赖颜色。
 *   - 用 role="radiogroup" / role="radio" + 方向键，键盘可完整操作。
 *   - 触摸目标：手机上每列竖排文字，整列可点，最小高度 5rem，避免误触。
 *   - 悬停有轻微放大与提示气泡（title），选中后状态文字明确显示当前选择。
 */

export interface ScaleOptions {
  /** 当前选中项，未作答传 null */
  value: AnswerLevel | null;
  /** 选择回调 */
  onChange: (level: AnswerLevel) => void;
  /** 是否禁用（例如预览态） */
  disabled?: boolean;
  /** 用于 aria-labelledby 的元素 id */
  labelledBy?: string;
}

export interface ScaleComponent {
  element: HTMLElement;
  /** 更新状态显示（例如切题后同步高亮） */
  setValue: (value: AnswerLevel | null) => void;
}

export function createScale(options: ScaleOptions): ScaleComponent {
  const buttons: HTMLButtonElement[] = [];

  const status = create('p', {
    class: 'scale__status',
    role: 'status',
    'aria-live': 'polite',
  });

  const grid = create('div', {
    class: 'scale',
    role: 'radiogroup',
    'aria-label': '选择你对这句话的认同程度',
  });
  if (options.labelledBy) grid.setAttribute('aria-labelledby', options.labelledBy);

  let current: AnswerLevel | null = options.value;

  const updateStatus = () => {
    if (current === null) {
      status.innerHTML = '还没有作答 · 选最接近你真实习惯的那一个';
      return;
    }
    const option = SCALE_OPTIONS[current];
    const sideText = option.side === 'agree' ? '认同' : option.side === 'disagree' ? '不认同' : '中立';
    status.innerHTML = `已选择：<strong>${option.label}</strong>（${sideText}）`;
  };

  SCALE_OPTIONS.forEach((option, index) => {
    const label = create('span', { class: 'scale__label', text: option.label });
    const dot = create('span', { class: 'scale__dot', 'aria-hidden': 'true' });

    const button = create(
      'button',
      {
        class: 'scale__item',
        type: 'button',
        role: 'radio',
        'aria-checked': 'false',
        'aria-label': `${option.label}：${option.hint}`,
        title: option.hint,
        'data-size': String(option.size),
        'data-side': option.side,
        'data-level': String(option.level),
        tabindex: index === 3 ? '0' : '-1',
      },
      [dot, label],
    );

    button.addEventListener('click', () => {
      if (options.disabled) return;
      current = option.level;
      sync();
      options.onChange(option.level);
    });

    // 键盘：左右/上下方向键切换，回车/空格确认（role=radio 的常见做法）
    button.addEventListener('keydown', (event) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      if (options.disabled) return;

      let targetIndex = index;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') targetIndex = Math.max(0, index - 1);
      else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') targetIndex = Math.min(6, index + 1);
      else if (event.key === 'Home') targetIndex = 0;
      else if (event.key === 'End') targetIndex = 6;

      const target = SCALE_OPTIONS[targetIndex];
      current = target.level;
      sync();
      options.onChange(target.level);
      buttons[targetIndex]?.focus();
    });

    buttons.push(button);
    grid.append(button);
  });

  const axis = create('div', { class: 'scale__axis', 'aria-hidden': 'true' }, [
    create('span', { text: '← 认同' }),
    create('span', { text: '不认同 →' }),
  ]);

  const wrapper = create('div', {}, [grid, axis, status]);

  function sync(): void {
    buttons.forEach((button, index) => {
      const isSelected = current === index;
      // 选中状态必须在这里设置：初始渲染（例如返回上一题）也要走同一条路径，
      // 否则已作答题目回到页面时不会显示选中状态，屏幕阅读器也读不到。
      button.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      // 只有选中项在 Tab 键序列里，其余用方向键进入（radiogroup 惯例）
      button.tabIndex = isSelected ? 0 : -1;
    });
    updateStatus();
  }

  // 初始渲染就走一次完整的同步，保证「返回上一题」时选中状态正确显示
  sync();

  return {
    element: wrapper,
    setValue(value: AnswerLevel | null) {
      current = value;
      sync();
    },
  };
}
