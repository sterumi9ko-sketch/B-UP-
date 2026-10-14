import type { UpProfile } from '@core/types';

/**
 * 图片路径映射
 * ---------------------------------------------------------------------------
 * 约定优于配置：
 *   头像文件放在 public/images/ups/ 下，文件名 = <UP主编号>.<扩展名>，
 *   例如 up_001.webp / up_001.png / up_001.jpg / up_001.svg。
 *
 * 想换文件名？在 src/data/ups/*.ts 里给某个 UP 主加 image: 'my-avatar' 即可，
 * 也可以给 image 写完整路径（以 / 或 http 开头）。
 *
 * 图片缺失时不会出现破损图标：找不到文件会自动降级为文字占位图。
 */

const UPS_DIR = 'images/ups';
const PLACEHOLDER_DIR = 'images/placeholders';

/** 依次尝试的扩展名（按优先级） */
export const IMAGE_EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg', 'svg', 'avif'] as const;

/** 占位图路径 */
export const PLACEHOLDER_IMAGE = `${PLACEHOLDER_DIR}/up-placeholder.svg`;

export interface ImageCandidate {
  /** 完整可用的 URL（相对 base 的路径） */
  src: string;
  /** 是否来自用户自备文件 */
  custom: boolean;
}

/** 把 UP 主编号转成候选头像路径列表（按优先级排列） */
export function avatarCandidates(up: Pick<UpProfile, 'id' | 'image'>): string[] {
  const base = up.image ?? up.id;

  // 直接写路径或网址：不追加扩展名
  if (/^(https?:)?\/\//.test(base) || base.startsWith('/')) return [base];
  // 已经带扩展名
  if (/\.[a-z0-9]+$/i.test(base)) return [`${UPS_DIR}/${base}`];

  return IMAGE_EXTENSIONS.map((ext) => `${UPS_DIR}/${base}.${ext}`);
}

/**
 * 把资源路径变成可直接用于 <img src> 的相对路径。
 *
 * 为什么用「纯相对路径」而不是 Vite 的 import.meta.env.BASE_URL：
 *   - 本站是单页应用，index.html 始终在站点根目录，子目录里没有页面，
 *     所以相对路径（'images/ups/x.webp'）在任何部署方式下都解析正确：
 *     根域名、子路径（/proj/）、甚至 file:// 双击打开都成立。
 *   - 相对路径不依赖构建期变量，因此同一份源码既能被 Vite 打包，
 *     也能被 esbuild 打成单文件离线版（IIFE 里没有 import.meta）。
 *
 * 兼容说明：keepBase 参数保留下来，便于以后需要绝对前缀时使用。
 */
export function withBase(path: string, keepBase = false): string {
  if (/^(https?:)?\/\//.test(path)) return path;
  if (path.startsWith('data:')) return path;
  const trimmed = path.replace(/^\/+/, '');
  return keepBase ? `/${trimmed}` : trimmed;
}

/** UP 主主页链接 */
export function spaceUrl(up: Pick<UpProfile, 'uid'>): string {
  return `https://space.bilibili.com/${up.uid}`;
}

/**
 * 生成文字占位头像（内联 SVG Data URL）。
 * 这样即使一张图片都没有，整站视觉也是完整的，不会出现破图。
 */
export function textAvatarDataUrl(name: string, seed = 0): string {
  const palettes = [
    ['#F3E3D3', '#B4553A'],
    ['#E7EDE4', '#4F6B52'],
    ['#F0E6F2', '#6B4A72'],
    ['#E4E9F2', '#3F5480'],
    ['#F5EBD8', '#8A6A2F'],
    ['#EFE4E0', '#8C5348'],
  ];
  const palette = palettes[Math.abs(seed) % palettes.length];
  const [bg, fg] = palette;
  const letter = (name.trim()[0] ?? '?').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="${escapeXml(
    name,
  )} 的占位头像">
  <rect width="160" height="160" rx="28" fill="${bg}"/>
  <circle cx="80" cy="80" r="52" fill="none" stroke="${fg}" stroke-opacity="0.18" stroke-width="2"/>
  <text x="80" y="80" fill="${fg}" font-family="ui-sans-serif, system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="64" font-weight="600" text-anchor="middle" dominant-baseline="central">${escapeXml(
    letter,
  )}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 给 <img> 绑定"逐个尝试候选路径，全失败则用占位图"的行为。
 * 返回清理函数。
 */
export function attachAvatarFallback(
  img: HTMLImageElement,
  up: Pick<UpProfile, 'id' | 'image' | 'name'>,
  seed = 0,
): () => void {
  const candidates = avatarCandidates(up).map((p) => withBase(p));
  let cursor = 0;
  let cancelled = false;

  const fallback = () => {
    if (cancelled) return;
    img.src = textAvatarDataUrl(up.name, seed);
    img.dataset.fallback = 'true';
  };

  const tryNext = () => {
    if (cancelled) return;
    if (cursor >= candidates.length) {
      fallback();
      return;
    }
    img.src = candidates[cursor++];
  };

  const onError = () => {
    if (cancelled) return;
    if (cursor >= candidates.length) fallback();
    else tryNext();
  };

  img.addEventListener('error', onError);
  tryNext();

  return () => {
    cancelled = true;
    img.removeEventListener('error', onError);
  };
}
