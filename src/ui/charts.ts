import { DIMENSIONS } from '@core/dimensions';
import type { DimensionScores } from '@core/types';
import { create } from '@ui/dom';

/**
 * 雷达图（Canvas 绘制）
 * ---------------------------------------------------------------------------
 * 为什么用 Canvas 而不是引一个图表库：
 *   站点只需要一张 8 维雷达图，手写 Canvas 约 100 行，
 *   不增加任何依赖，也能自定义成暖色设计风格。
 *
 * 无障碍：Canvas 旁边会同步渲染一份文字版的分数说明（见 renderScoreBars），
 * 让屏幕阅读器用户也能获取同样的信息。
 */

export interface RadarSeries {
  /** 系列名称（图例用） */
  name: string;
  scores: DimensionScores;
  /** 主色 */
  stroke: string;
  fill: string;
  dashed?: boolean;
}

export interface RadarOptions {
  size?: number;
  series: RadarSeries[];
  /** 动画时长（毫秒），0 表示不动画 */
  animate?: boolean;
}

const RING_COUNT = 4;
const MAX_SCORE = 100;

export function renderRadar(options: RadarOptions): HTMLCanvasElement {
  const size = options.size ?? 380;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const canvas = create('canvas', {
    class: 'radar',
    width: size * dpr,
    height: size * dpr,
    role: 'img',
    'aria-label': buildAriaLabel(options.series),
  });
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(dpr, dpr);

  const draw = (progress: number) => {
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 34;
    const count = DIMENSIONS.length;

    // 网格环
    ctx.strokeStyle = getVar('--color-border', '#e6ddcf');
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= RING_COUNT; ring++) {
      const r = (radius * ring) / RING_COUNT;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const point = polar(cx, cy, r, i, count);
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // 轴线
    for (let i = 0; i < count; i++) {
      const point = polar(cx, cy, radius, i, count);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    // 数据系列
    for (const series of options.series) {
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const value = clamp(series.scores[DIMENSIONS[i].id] ?? 0, 0, MAX_SCORE);
        const r = (radius * value * progress) / MAX_SCORE;
        const point = polar(cx, cy, r, i, count);
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      ctx.closePath();
      ctx.fillStyle = series.fill;
      ctx.fill();
      ctx.strokeStyle = series.stroke;
      ctx.lineWidth = 2;
      ctx.setLineDash(series.dashed ? [5, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);

      // 数据点
      ctx.fillStyle = series.stroke;
      for (let i = 0; i < count; i++) {
        const value = clamp(series.scores[DIMENSIONS[i].id] ?? 0, 0, MAX_SCORE);
        const r = (radius * value * progress) / MAX_SCORE;
        const point = polar(cx, cy, r, i, count);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 维度标签与刻度
    // 注意：canvas 的 font 必须同时给出字号与字体族；只写字体族会被忽略并退回默认的 10px。
    // 这里根据画布尺寸换算字号，保证在手机上也能看清。
    const labelSize = Math.max(12, Math.round(size * 0.037));
    ctx.font = `600 ${labelSize}px ${getVar('--font-sans', 'sans-serif')}`;
    ctx.fillStyle = getVar('--color-text-soft', '#5c5349');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < count; i++) {
      const labelPoint = polar(cx, cy, radius + labelSize + 4, i, count);
      ctx.fillText(DIMENSIONS[i].short, labelPoint.x, labelPoint.y);
    }

    // 中心到边缘的刻度说明
    ctx.textAlign = 'left';
    ctx.fillStyle = getVar('--color-text-muted', '#8a7f72');
    ctx.font = `${Math.max(10, labelSize - 2)}px ${getVar('--font-sans', 'sans-serif')}`;
    ctx.fillText('100', cx + 4, cy - radius + 2);
    ctx.fillText('50', cx + 4, cy - radius / 2 + 2);
  };

  if (options.animate === false) {
    draw(1);
    return canvas;
  }

  let raf = 0;
  const start = performance.now();
  const duration = 720;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    draw(1 - Math.pow(1 - t, 3));
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  // 组件被移除时取消动画，避免无谓的绘制
  canvas.addEventListener(
    'DOMNodeRemovedFromDocument',
    () => cancelAnimationFrame(raf),
    { once: true },
  );

  return canvas;
}

function polar(cx: number, cy: number, radius: number, index: number, count: number) {
  // 从正上方开始，顺时针分布
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

function getVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function buildAriaLabel(series: RadarSeries[]): string {
  const parts = series.map((s) => {
    const items = DIMENSIONS.map((d) => `${d.name} ${Math.round(s.scores[d.id] ?? 0)} 分`).join('，');
    return `${s.name}：${items}`;
  });
  return `风格维度雷达图。${parts.join('。')}`;
}

/**
 * 横向评分条：展示用户各维度得分，并可选标记对比对象的分数。
 * 这是雷达图的"文字版"，同时也给屏幕阅读器提供等价信息。
 */
export function renderScoreBars(
  userScores: DimensionScores,
  compare?: { scores: DimensionScores; name: string },
): HTMLElement {
  const list = create('ul', { class: 'bars' });

  for (const dimension of DIMENSIONS) {
    const value = clamp(userScores[dimension.id] ?? 0, 0, 100);
    const row = create('li', { class: 'bar-row' });

    const label = create('span', { class: 'bar-row__label', text: dimension.name });
    const track = create('div', { class: 'bar-row__track', role: 'img', 'aria-label': `${dimension.name} ${Math.round(value)} 分` });
    const fill = create('div', { class: 'bar-row__fill' });
    fill.style.width = '0%';
    track.append(fill);

    if (compare) {
      const upValue = clamp(compare.scores[dimension.id] ?? 0, 0, 100);
      const mark = create('div', { class: 'bar-row__mark' });
      mark.style.left = `calc(${upValue}% - 1px)`;
      mark.title = `${compare.name}：${Math.round(upValue)} 分`;
      track.append(mark);
    }

    const valueEl = create('span', { class: 'bar-row__value', text: '' });
    row.append(label, track, valueEl);
    list.append(row);

    // 进场动画：下一帧再设置宽度
    requestAnimationFrame(() => {
      fill.style.width = `${value}%`;
    });

    const animateValue = (from: number, to: number) => {
      const startTime = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / 600);
        const eased = 1 - Math.pow(1 - t, 3);
        valueEl.textContent = String(Math.round(from + (to - from) * eased));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    animateValue(0, value);

    if (compare) {
      valueEl.title = `${compare.name}：${Math.round(compare.scores[dimension.id] ?? 0)} 分`;
    }
  }

  return list;
}
