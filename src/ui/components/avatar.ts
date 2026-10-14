import { attachAvatarFallback } from '@core/assets';
import type { UpProfile } from '@core/types';
import { create } from '@ui/dom';

/**
 * 头像组件
 * ---------------------------------------------------------------------------
 * 统一处理"图片缺失"的情况：
 *   1. 依次尝试 public/images/ups/<编号>.webp / .png / .jpg / .jpeg / .svg / .avif
 *   2. 都没有时，自动降级为文字占位头像（内联 SVG，不会出现破图图标）
 *
 * 想给某位 UP 主换图，只需把图片按 docs/ASSETS.md 的文件名放进 public/images/ups/。
 */
export function createAvatar(
  up: Pick<UpProfile, 'id' | 'image' | 'name' | 'uid'>,
  options: { className?: string; size?: number; eager?: boolean } = {},
): HTMLElement {
  const wrapper = create('div', { class: options.className ?? 'up-card__avatar' });
  const img = create('img', {
    alt: `${up.name} 的头像`,
    loading: options.eager ? 'eager' : 'lazy',
    decoding: 'async',
    width: options.size ?? 160,
    height: options.size ?? 160,
  });
  attachAvatarFallback(img, up, up.uid);
  wrapper.append(img);
  return wrapper;
}

/** 结果页大图版本 */
export function createHeroAvatar(up: UpProfile, rankLabel?: string): HTMLElement {
  const wrapper = create('div', { class: 'result-hero__avatar' });
  const img = create('img', {
    alt: `${up.name} 的头像`,
    loading: 'eager',
    decoding: 'async',
  });
  attachAvatarFallback(img, up, up.uid);
  wrapper.append(img);
  if (rankLabel) wrapper.append(create('span', { class: 'result-hero__rank', text: rankLabel }));
  return wrapper;
}
