import { siteConfig } from '@config';
import { DIMENSIONS } from '@core/dimensions';
import { avatarCandidates, textAvatarDataUrl, withBase } from '@core/assets';
import type { TestOutcome, UpProfile } from '@core/types';

/**
 * 分享卡片生成
 * ---------------------------------------------------------------------------
 * 用 Canvas 手绘一张 1080 × 1440（3:4，适合手机分享）的结果图。
 * 不引入 html2canvas 之类的库：站点只需要一张固定版式的卡片，
 * 手绘更可控，也不会因为跨域样式问题生成失败。
 *
 * 头像来源：
 *   - 如果 public/images/ups/ 下有图片，就直接画进去
 *   - 没有图片时，画一个与站内一致的文字占位头像
 *   （两者都能成功导出，图片缺失不会让分享功能失效）
 */

export interface ShareCardInput {
  outcome: TestOutcome;
}

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1440;

/** 生成分享图，返回 PNG data URL */
export async function renderShareCard(input: ShareCardInput): Promise<string> {
  const { outcome } = input;
  const best = outcome.best.up;

  const canvas = document.createElement('canvas');
  canvas.width = SHARE_CARD_WIDTH;
  canvas.height = SHARE_CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 Canvas，无法生成分享图');

  const W = SHARE_CARD_WIDTH;
  const H = SHARE_CARD_HEIGHT;
  const PAD = 72;

  /* ---------------- 背景：暖米白 + 柔和光斑 ---------------- */
  ctx.fillStyle = '#FAF7F2';
  ctx.fillRect(0, 0, W, H);

  const glow1 = ctx.createRadialGradient(W * 0.1, 0, 0, W * 0.1, 0, W * 0.9);
  glow1.addColorStop(0, 'rgba(192, 95, 60, 0.14)');
  glow1.addColorStop(1, 'rgba(192, 95, 60, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H * 0.6);

  const glow2 = ctx.createRadialGradient(W * 0.95, H * 0.1, 0, W * 0.95, H * 0.1, W * 0.7);
  glow2.addColorStop(0, 'rgba(79, 122, 95, 0.12)');
  glow2.addColorStop(1, 'rgba(79, 122, 95, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H * 0.6);

  /* ---------------- 顶部：站点名 + 副标题 ---------------- */
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#C05F3C';
  roundRect(ctx, PAD, PAD, 76, 76, 20);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 34px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('萌', PAD + 38, PAD + 40);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#2F2A25';
  ctx.font = 'bold 38px ' + FONT;
  ctx.fillText('测测你是 B 站动画区的哪位 UP 主', PAD + 100, PAD + 44);
  ctx.fillStyle = '#8A7F72';
  ctx.font = '26px ' + FONT;
  ctx.fillText('创作风格匹配 · 8 个维度 · 40 道题', PAD + 100, PAD + 82);

  /* ---------------- 最佳匹配 ---------------- */
  const avatarSize = 300;
  const avatarX = PAD;
  const avatarY = PAD + 150;

  // 白色卡片
  ctx.fillStyle = '#FFFDFA';
  ctx.strokeStyle = '#E6DDCF';
  ctx.lineWidth = 2;
  roundRect(ctx, PAD - 24, avatarY - 24, W - (PAD - 24) * 2, 500, 32);
  ctx.fill();
  ctx.stroke();

  await drawAvatar(ctx, best, avatarX, avatarY, avatarSize);

  // 名字与一句话总结
  const textX = avatarX + avatarSize + 48;
  const textMaxWidth = W - textX - PAD;

  ctx.fillStyle = '#8A7F72';
  ctx.font = '26px ' + FONT;
  ctx.fillText('你的最佳匹配 UP 主', textX, avatarY + 34);

  ctx.fillStyle = '#2F2A25';
  ctx.font = 'bold 64px ' + FONT;
  drawFittedText(ctx, best.name, textX, avatarY + 118, textMaxWidth, 64, 40);

  // 相似指数
  ctx.fillStyle = '#C05F3C';
  ctx.font = 'bold 84px ' + FONT;
  const scoreText = outcome.best.similarity.toFixed(1);
  ctx.fillText(scoreText, textX, avatarY + 230);
  const scoreWidth = ctx.measureText(scoreText).width;
  ctx.fillStyle = '#8A7F72';
  ctx.font = '26px ' + FONT;
  ctx.fillText('风格相似指数 / 100', textX + scoreWidth + 20, avatarY + 226);

  // 一句话总结（自动折行）
  ctx.fillStyle = '#5C5349';
  ctx.font = '27px ' + FONT;
  drawWrappedText(ctx, best.summary, textX, avatarY + 292, textMaxWidth, 40, 3);

  /* ---------------- 风格标签 ---------------- */
  let tagY = avatarY + 520;
  ctx.fillStyle = '#8A7F72';
  ctx.font = '26px ' + FONT;
  ctx.fillText('你的主要风格标签', PAD, tagY);
  tagY += 34;

  let tagX = PAD;
  ctx.font = 'bold 28px ' + FONT;
  for (const tag of outcome.styleTags) {
    const padding = 26;
    const width = ctx.measureText(tag).width + padding * 2;
    if (tagX + width > W - PAD) {
      tagX = PAD;
      tagY += 66;
    }
    ctx.fillStyle = '#F3DED4';
    roundRect(ctx, tagX, tagY, width, 54, 27);
    ctx.fill();
    ctx.fillStyle = '#A94E2E';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, tagX + padding, tagY + 29);
    ctx.textBaseline = 'alphabetic';
    tagX += width + 16;
  }
  tagY += 100;

  /* ---------------- 前三个匹配 ---------------- */
  ctx.fillStyle = '#8A7F72';
  ctx.font = '26px ' + FONT;
  ctx.fillText('风格最接近的 UP 主', PAD, tagY);

  const rowY = tagY + 30;
  const rowHeight = 108;
  outcome.top3.forEach((match, index) => {
    const y = rowY + index * (rowHeight + 16);
    ctx.fillStyle = '#FFFDFA';
    ctx.strokeStyle = '#E6DDCF';
    roundRect(ctx, PAD, y, W - PAD * 2, rowHeight, 24);
    ctx.fill();
    ctx.stroke();

    // 排名
    ctx.fillStyle = index === 0 ? '#C05F3C' : '#B3ACA1';
    ctx.font = 'bold 40px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${index + 1}`, PAD + 34, y + rowHeight / 2);

    // 头像
    const small = 72;
    drawAvatarSync(ctx, match.up, PAD + 78, y + (rowHeight - small) / 2, small, true);

    // 昵称
    ctx.fillStyle = '#2F2A25';
    ctx.font = 'bold 32px ' + FONT;
    ctx.fillText(fit(ctx, match.up.name, W - PAD * 2 - 420), PAD + 170, y + rowHeight / 2);

    // 相似指数
    ctx.textAlign = 'right';
    ctx.fillStyle = '#C05F3C';
    ctx.font = 'bold 34px ' + FONT;
    ctx.fillText(`${match.similarity.toFixed(1)}`, W - PAD - 28, y + rowHeight / 2);
    ctx.fillStyle = '#8A7F72';
    ctx.font = '22px ' + FONT;
    ctx.fillText('相似指数', W - PAD - 28, y + rowHeight / 2 + 30);
    ctx.textAlign = 'left';
  });

  /* ---------------- 维度迷你条形图 ---------------- */
  const chartY = rowY + 3 * (rowHeight + 16) + 40;
  if (chartY + 260 < H - 150) {
    ctx.fillStyle = '#8A7F72';
    ctx.font = '26px ' + FONT;
    ctx.fillText('你的维度画像', PAD, chartY);

    const barAreaX = PAD + 150;
    const barAreaWidth = W - PAD * 2 - 150 - 70;
    DIMENSIONS.forEach((dimension, index) => {
      const y = chartY + 30 + index * 30;
      ctx.fillStyle = '#5C5349';
      ctx.font = '23px ' + FONT;
      ctx.fillText(dimension.name, PAD, y + 16);

      ctx.fillStyle = '#F0E9DE';
      roundRect(ctx, barAreaX, y, barAreaWidth, 18, 9);
      ctx.fill();

      const value = Math.max(0, Math.min(100, outcome.normalized[dimension.id] ?? 0));
      ctx.fillStyle = '#C05F3C';
      roundRect(ctx, barAreaX, y, (barAreaWidth * value) / 100, 18, 9);
      ctx.fill();

      ctx.fillStyle = '#8A7F72';
      ctx.font = '21px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(value)), W - PAD, y + 16);
      ctx.textAlign = 'left';
    });
  }

  /* ---------------- 底部免责声明 ---------------- */
  const footerY = H - 150;
  ctx.strokeStyle = '#E6DDCF';
  ctx.beginPath();
  ctx.moveTo(PAD, footerY - 34);
  ctx.lineTo(W - PAD, footerY - 34);
  ctx.stroke();

  ctx.fillStyle = '#8A7F72';
  ctx.font = '21px ' + FONT;
  drawWrappedText(
    ctx,
    '娱乐性质的创作风格匹配，不代表 UP 主真实人格或本人认可 · 本站非哔哩哔哩官方产品',
    PAD,
    footerY,
    W - PAD * 2,
    30,
    2,
  );

  const site = siteConfig.siteUrl || window.location.origin + window.location.pathname;
  ctx.fillStyle = '#B3ACA1';
  ctx.font = '20px ' + FONT;
  ctx.fillText(site, PAD, H - 44);

  return canvas.toDataURL('image/png');
}

/** 生成一份适合直接粘贴到 B 站/微信/QQ 的分享文案 */
export function buildShareCaption(outcome: TestOutcome): string {
  const best = outcome.best.up;
  const rest = outcome.top3.slice(1).map((m, i) => `${i + 2}. ${m.up.name}（${m.similarity.toFixed(1)}）`);

  return [
    `我在《${siteConfig.name}》里测出了自己的动画区创作风格。`,
    '',
    `最佳匹配：${best.name}　风格相似指数 ${outcome.best.similarity.toFixed(1)}`,
    `风格标签：${outcome.styleTags.join(' · ')}`,
    rest.length ? `另外还匹配到：${rest.join('、')}` : '',
    '',
    `一句话总结：${best.summary}`,
    '',
    `#动画区UP主匹配 #B站动画区 #${best.name}`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/* -------------------------------------------------------------------------- */
/* Canvas 绘制辅助                                                             */
/* -------------------------------------------------------------------------- */

const FONT = `ui-sans-serif, system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** 让文字适应宽度：太长就缩小字号，再太长就截断加省略号 */
function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxSize: number,
  minSize: number,
): void {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = `bold ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.fillText(fit(ctx, text, maxWidth), x, y);
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(result + '…').width > maxWidth) result = result.slice(0, -1);
  return result + '…';
}

/** 简单折行绘制，最多 maxLines 行 */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void {
  const chars = Array.from(text);
  let line = '';
  let lineCount = 0;

  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      if (lineCount === maxLines - 1) {
        ctx.fillText(fit(ctx, line + chars.slice(i).join(''), maxWidth), x, y + lineCount * lineHeight);
        return;
      }
      ctx.fillText(line, x, y + lineCount * lineHeight);
      lineCount++;
      line = chars[i];
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y + lineCount * lineHeight);
}

/** 同步绘制头像（使用已缓存的图片，没有就用文字占位） */
function drawAvatarSync(
  ctx: CanvasRenderingContext2D,
  up: Pick<UpProfile, 'id' | 'image' | 'name' | 'uid'>,
  x: number,
  y: number,
  size: number,
  circular = false,
): void {
  const key = String(up.uid);
  const cached = loadedImages.get(key);
  ctx.save();
  if (circular) {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
  } else {
    roundRect(ctx, x, y, size, size, 28);
    ctx.clip();
  }
  if (cached) {
    ctx.drawImage(cached, x, y, size, size);
  } else {
    drawTextAvatar(ctx, up.name, x, y, size);
  }
  ctx.restore();
}

/** 异步加载头像（逐候选路径尝试），成功与否都要能继续画）
 */
async function drawAvatar(
  ctx: CanvasRenderingContext2D,
  up: Pick<UpProfile, 'id' | 'image' | 'name' | 'uid'>,
  x: number,
  y: number,
  size: number,
): Promise<void> {
  const key = String(up.uid);
  if (!loadedImages.has(key)) {
    const img = await tryLoadAvatar(up);
    if (img) loadedImages.set(key, img);
  }
  ctx.save();
  roundRect(ctx, x, y, size, size, 28);
  ctx.clip();
  const cached = loadedImages.get(key);
  if (cached) ctx.drawImage(cached, x, y, size, size);
  else drawTextAvatar(ctx, up.name, x, y, size);
  ctx.restore();
}

const loadedImages = new Map<string, HTMLImageElement>();

function tryLoadAvatar(up: Pick<UpProfile, 'id' | 'image' | 'name'>): Promise<HTMLImageElement | null> {
  const candidates = avatarCandidates(up).map((p) => withBase(p));
  return new Promise((resolve) => {
    let index = 0;
    const next = () => {
      if (index >= candidates.length) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        index++;
        next();
      };
      img.src = candidates[index++];
    };
    next();
    // 兜底：2 秒内没结果就用文字占位
    setTimeout(() => resolve(null), 2000);
  });
}

/** 画文字占位头像（与页面上的占位方案保持一致的视觉） */
function drawTextAvatar(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number): void {
  ctx.fillStyle = '#F3E3D3';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#B4553A';
  ctx.font = `bold ${size * 0.44}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((name.trim()[0] ?? '?').toUpperCase(), x + size / 2, y + size / 2 + size * 0.02);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** 供其他模块复用的占位图（页面内 <img> 失效时的兜底） */
export function placeholderFor(name: string, seed: number): string {
  return textAvatarDataUrl(name, seed);
}
