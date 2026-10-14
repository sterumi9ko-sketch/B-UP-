/**
 * DOM 小工具
 * ---------------------------------------------------------------------------
 * 站点刻意不引入前端框架：页面结构用模板字符串渲染，交互用原生事件处理。
 * 这样做的好处是依赖极少、构建产物小、代码改起来直观。
 */

/** 创建元素：create('div', { class: 'card' }, [child, '文本']) */
export function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | null | undefined> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'text') el.textContent = String(value);
    else if (key === 'html') el.innerHTML = String(value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) el.append(child);
  return el;
}

/** 转义 HTML，所有用户可见文本都经过它，避免注入 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function qs<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector);
}

export function qsa<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/** 数字格式化：87.6 / 3 / 1,234 */
export function formatNumber(value: number, digits = 1): string {
  const fixed = Number.isInteger(value) ? value.toString() : value.toFixed(digits);
  return fixed;
}

export function formatDateTime(iso: string | number | undefined): string {
  if (iso === undefined) return '';
  const date = typeof iso === 'number' ? new Date(iso) : new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 简易 toast 提示 */
let toastTimer: number | undefined;

export function toast(message: string, duration = 2400): void {
  let el = qs<HTMLDivElement>('.toast');
  if (!el) {
    el = create('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = message;
  el.dataset.visible = 'true';
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (el) el.dataset.visible = 'false';
  }, duration);
}

/** 复制文本到剪贴板，返回是否成功 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 退回到旧方案 */
  }
  try {
    const ta = create('textarea', { class: 'visually-hidden' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** 触发文件下载 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = create('a', { href: dataUrl, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * 通用弹层：支持 Esc 关闭、点击遮罩关闭、焦点返回。
 * 返回关闭函数。
 */
export function openModal(content: HTMLElement, options: { label: string } = { label: '详情' }): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKeydown);
    previouslyFocused?.focus?.();
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
    if (event.key === 'Tab') {
      // 把焦点留在弹层内
      const focusables = qsa<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        backdrop,
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const backdrop = create('div', { class: 'detail-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-label': options.label }, [
    content,
  ]);
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', onKeydown);
  document.body.append(backdrop);

  const firstFocusable = qs<HTMLElement>('button, a[href], input', content);
  firstFocusable?.focus();

  return close;
}

/** 用 requestAnimationFrame 让某个数值从 from 动画到 to（用于分数揭晓） */
export function animateNumber(
  from: number,
  to: number,
  duration: number,
  onUpdate: (value: number) => void,
  onDone?: () => void,
): () => void {
  let raf = 0;
  let cancelled = false;
  const start = performance.now();

  const step = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / duration);
    // easeOutCubic
    const eased = 1 - Math.pow(1 - t, 3);
    onUpdate(from + (to - from) * eased);
    if (t < 1) raf = requestAnimationFrame(step);
    else onDone?.();
  };

  raf = requestAnimationFrame(step);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}

/** 让动画在下一次绘制后开始（保证 CSS transition 生效） */
export function nextFrame(fn: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}
