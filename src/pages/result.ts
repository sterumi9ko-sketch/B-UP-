import { siteConfig } from '@config';
import { DIMENSIONS, DIMENSION_MAP } from '@core/dimensions';
import { confidenceText } from '@core/match';
import { spaceUrl } from '@core/assets';
import { renderRadar, renderScoreBars } from '@ui/charts';
import { createHeroAvatar, createAvatar } from '@ui/components/avatar';
import { copyText, create, downloadDataUrl, toast } from '@ui/dom';
import { navigate, routeHref } from '@ui/router';
import { buildShareCaption, renderShareCard } from '@share/card';
import { state } from '@state';
import type { TestOutcome } from '@core/types';
import type { PageRenderer } from '@ui/page-types';

/**
 * 结果页
 * ---------------------------------------------------------------------------
 * 四个部分：
 *   1. 最佳匹配：头像、昵称、风格相似指数、一句话总结、匹配理由、代表特点、B站主页链接
 *   2. 前三名匹配：卡片列表
 *   3. 个人风格画像：雷达图 + 与第一名的逐维度对比 + 明细表
 *   4. 结果分享：生成分享图、下载、复制文案、重新测试
 *
 * 所有内容都由 evaluateTest() 的真实计算结果驱动，没有任何写死的展示数据。
 */
export const renderResult: PageRenderer = () => {
  const container = create('div', { class: 'container' });

  // 未答完 / 没有结果时，不能展示正式结果
  if (!state.isComplete) {
    const answered = state.answeredCount;
    container.append(
      create('div', { class: 'reading', style: 'margin: 0 auto;' }, [
        create('h1', { text: '还没有生成结果' }),
        create('p', {
          class: 'text-soft',
          text: `结果需要答完全部题目才会计算，避免给出不完整的匹配。你目前完成了 ${answered} / ${state.total} 题。`,
        }),
        create('div', { class: 'btn-row' }, [
          create('a', { class: 'btn', href: routeHref('test'), text: '继续答题' }),
          create('a', { class: 'btn btn--secondary', href: routeHref('home'), text: '回到首页' }),
        ]),
      ]),
    );
    return { element: container };
  }

  const outcome = state.outcome ?? state.recompute();
  if (!outcome) {
    container.append(create('p', { text: '结果计算失败，请返回首页重新测试。' }));
    return { element: container };
  }

  /* ------------------------------------------------------------------ */
  /* 数据提示（有未核实数据时醒目告知）                                   */
  /* ------------------------------------------------------------------ */
  if (outcome.dataNotice) {
    container.append(create('div', { class: 'notice notice--warning', style: 'margin-bottom: var(--space-5);' }, [
      create('strong', { text: '数据说明：' }),
      create('span', { text: outcome.dataNotice }),
    ]));
  }

  /* ------------------------------------------------------------------ */
  /* 第一部分：最佳匹配                                                   */
  /* ------------------------------------------------------------------ */
  const best = outcome.best;
  const bestUp = best.up;

  const scoreValue = create('span', { class: 'score-ring__value', text: '0' });
  const dial = create('div', { class: 'score-ring__dial', role: 'img', 'aria-label': `风格相似指数 ${best.similarity.toFixed(1)} 分（满分 100）` }, [
    scoreValue,
  ]);

  // 分数揭晓动画：数字滚动 + 环形进度
  requestAnimationFrame(() => {
    dial.style.setProperty('--value', String(best.similarity));
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      scoreValue.textContent = (best.similarity * eased).toFixed(1);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const heroInfo = create('div', {}, [
    create('p', { class: 'hero__eyebrow', text: `最佳匹配 · 第 ${best.rank} 名` }),
    create('h1', { class: 'result-hero__name', text: bestUp.name }),
    create('p', { class: 'result-hero__summary', text: bestUp.summary }),
    create('div', { class: 'score-ring' }, [
      dial,
      create('div', {}, [
        create('p', { class: 'score-ring__label', style: 'margin:0;', text: '风格相似指数（满分 100）' }),
        create('p', { class: 'text-muted', style: 'margin:0; font-size: var(--text-sm);', text: confidenceText(outcome.confidenceLevel) }),
      ]),
    ]),
    create('ul', { class: 'tag-list', 'aria-label': '风格标签' }, bestUp.tags.map((tag) => create('li', { class: 'tag tag--accent', text: tag }))),
    create('div', { class: 'result-hero__actions btn-row' }, [
      create('a', {
        class: 'btn',
        href: spaceUrl(bestUp),
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
        text: '去 B 站看 TA 的主页',
      }),
      create('a', { class: 'btn btn--secondary', href: '#share', text: '生成分享图' }),
    ]),
  ]);

  const hero = create('section', { class: 'result-hero reveal', 'aria-labelledby': 'best-name' }, [
    createHeroAvatar(bestUp, `TOP ${best.rank}`),
    heroInfo,
  ]);

  // 匹配理由
  const reasonsSection = create('section', { class: 'card', style: 'margin-top: var(--space-5);' }, [
    create('h2', { class: 'card__title', text: '为什么会匹配到 TA' }),
    create('ul', {}, best.reasons.map((reason) => create('li', { text: reason }))),
    create('h3', { class: 'card__title', style: 'margin-top: var(--space-4); font-size: var(--text-base);', text: 'TA 的代表性创作特点' }),
    create('ul', {}, bestUp.observedStyle.map((item) => create('li', { text: item }))),
    create('p', { class: 'card__meta', style: 'margin-top: var(--space-3);' }, [
      create('span', { text: `内容方向：${bestUp.category} · UID ${bestUp.uid}` }),
    ]),
  ]);

  container.append(hero, reasonsSection);

  /* ------------------------------------------------------------------ */
  /* 第二部分：前三名                                                     */
  /* ------------------------------------------------------------------ */
  const podium = create('div', { class: 'podium' },
    outcome.top3.map((match, index) => {
      const card = create('article', { class: 'podium__card' }, [
        create('div', { class: 'podium__head' }, [
          createAvatar(match.up, { className: 'podium__avatar', size: 96 }),
          create('div', {}, [
            create('p', { class: 'podium__rank', text: `第 ${index + 1} 名 · ${match.up.category}` }),
            create('h3', { class: 'podium__name', text: match.up.name }),
          ]),
        ]),
        create('p', { class: 'podium__score', text: `风格相似指数 ${match.similarity.toFixed(1)}` }),
        create('p', { class: 'podium__reason', text: match.reasons[0] ?? match.up.summary }),
        create('ul', { class: 'tag-list' }, match.up.tags.slice(0, 3).map((tag) => create('li', { class: 'tag', text: tag }))),
        create('a', {
          class: 'btn btn--ghost btn--sm',
          href: spaceUrl(match.up),
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
          text: '打开 B 站主页 ↗',
        }),
      ]);
      return card;
    }),
  );

  container.append(
    create('section', { class: 'section' }, [
      create('h2', { class: 'section__title', text: '风格最接近的三位 UP 主' }),
      create('p', { class: 'section__lead', text: '相似指数由 8 个维度的加权距离换算而来，分数越高表示创作风格越接近，不代表真实人格相同。' }),
      podium,
    ]),
  );

  /* ------------------------------------------------------------------ */
  /* 第三部分：个人风格画像                                               */
  /* ------------------------------------------------------------------ */
  const radar = renderRadar({
    series: [
      {
        name: '你',
        scores: outcome.normalized,
        stroke: cssVar('--color-accent', '#c05f3c'),
        fill: 'rgba(192, 95, 60, 0.22)',
      },
      {
        name: bestUp.name,
        scores: bestUp.scores,
        stroke: cssVar('--color-agree', '#4f7a5f'),
        fill: 'rgba(79, 122, 95, 0.14)',
        dashed: true,
      },
    ],
    size: 400,
  });

  const chartBlock = create('div', { class: 'chart-block' }, [
    create('div', {}, [
      create('div', { class: 'chart-legend' }, [
        legendItem('你的画像', 'chart-legend__swatch--user'),
        legendItem(`最佳匹配：${bestUp.name}`, 'chart-legend__swatch--up'),
      ]),
      radar,
    ]),
    create('div', {}, [
      create('h3', { class: 'card__title', text: '各维度得分' }),
      create('p', { class: 'card__meta', style: 'margin-bottom: var(--space-4);', text: '横条是你的分数（0–100），绿色竖线是最佳匹配 UP 主的分数。' }),
      renderScoreBars(outcome.normalized, { scores: bestUp.scores, name: bestUp.name }),
    ]),
  ]);

  const diffTable = create('table', { class: 'diff-table' }, [
    create('thead', {}, [
      create('tr', {}, [
        create('th', { text: '维度' }),
        create('th', { class: 'num', text: '你' }),
        create('th', { class: 'num', text: bestUp.name }),
        create('th', { class: 'num', text: '差值' }),
        create('th', { text: '说明' }),
      ]),
    ]),
    create('tbody', {}, best.diffs.map((diff) => {
      const dimension = DIMENSION_MAP[diff.dimension];
      const direction = diff.diff > 2 ? '你更强' : diff.diff < -2 ? 'TA 更强' : '基本一致';
      return create('tr', {}, [
        create('td', { text: dimension.name }),
        create('td', { class: 'num', text: String(Math.round(diff.userScore)) }),
        create('td', { class: 'num', text: String(Math.round(diff.upScore)) }),
        create('td', { class: 'num', text: `${diff.diff > 0 ? '+' : ''}${diff.diff.toFixed(1)}` }),
        create('td', { text: direction }),
      ]);
    })),
  ]);

  container.append(
    create('section', { class: 'section' }, [
      create('h2', { class: 'section__title', text: '你的创作风格画像' }),
      create('p', { class: 'section__lead', text: '50 分代表在这个维度上比较中性，越高表示越接近该维度描述的行为方式。每个维度的含义见「关于测试」页面。' }),
      chartBlock,
      create('h3', { class: 'card__title', style: 'margin-top: var(--space-6);', text: '与最佳匹配的逐维度对比' }),
      create('div', { style: 'overflow-x:auto;' }, [diffTable]),
      create('details', { class: 'card card--flat', style: 'margin-top: var(--space-4);' }, [
        create('summary', { text: '8 个维度分别是什么意思？', style: 'cursor:pointer; font-weight:600;' }),
        create('dl', { class: 'definition-list', style: 'margin-top: var(--space-4);' },
          DIMENSIONS.flatMap((dimension) => [
            create('dt', { text: `${dimension.name}：${Math.round(outcome.normalized[dimension.id])} 分` }),
            create('dd', { text: dimension.definition }),
          ]),
        ),
      ]),
    ]),
  );

  /* ------------------------------------------------------------------ */
  /* 第四部分：结果分享                                                   */
  /* ------------------------------------------------------------------ */
  const shareSection = create('section', { class: 'section', id: 'share' }, [
    create('h2', { class: 'section__title', text: '把结果分享出去' }),
    create('p', { class: 'section__lead', text: '分享图会自动包含网站名称、最佳匹配结果、主要风格标签与免责声明，适合直接发到手机社交平台。' }),
  ]);

  const previewHost = create('div', { class: 'share-preview' });
  const shareStatus = create('p', { class: 'card__meta', text: '正在生成分享图…' });
  const downloadButton = create('button', { class: 'btn', type: 'button', text: '下载分享图（PNG）', disabled: 'disabled' });
  const regenerateButton = create('button', { class: 'btn btn--secondary', type: 'button', text: '重新生成' });
  const copyButton = create('button', { class: 'btn btn--secondary', type: 'button', text: '复制分享文案' });

  const caption = create('textarea', {
    class: 'share-caption',
    readonly: 'readonly',
    rows: '8',
    'aria-label': '分享文案',
  }) as HTMLTextAreaElement;
  caption.value = buildShareCaption(outcome);

  let currentDataUrl: string | null = null;

  async function generate(): Promise<void> {
    shareStatus.textContent = '正在生成分享图…';
    downloadButton.setAttribute('disabled', 'disabled');
    try {
      const dataUrl = await renderShareCard({ outcome: outcome as TestOutcome });
      currentDataUrl = dataUrl;
      previewHost.innerHTML = '';
      const img = create('img', { alt: '结果分享图预览', src: dataUrl });
      previewHost.append(img);
      downloadButton.removeAttribute('disabled');
      shareStatus.textContent = '生成成功，可以下载或长按保存。';
    } catch (error) {
      shareStatus.textContent = `生成失败：${(error as Error).message}`;
    }
  }

  downloadButton.addEventListener('click', () => {
    if (!currentDataUrl) return;
    const filename = `动画区UP主匹配_${bestUp.name}_${Math.round(best.similarity)}.png`;
    downloadDataUrl(currentDataUrl, filename);
    toast('分享图已开始下载');
  });

  regenerateButton.addEventListener('click', () => {
    void generate();
  });

  copyButton.addEventListener('click', async () => {
    const ok = await copyText(caption.value);
    toast(ok ? '分享文案已复制' : '复制失败，请手动选中复制');
  });

  const restartButton = create('button', { class: 'btn btn--ghost', type: 'button', text: '重新测试' });
  restartButton.addEventListener('click', () => {
    if (!window.confirm('重新测试会清空当前答案，确定继续吗？')) return;
    state.reset();
    navigate('/test');
  });

  shareSection.append(
    create('div', { class: 'share-grid' }, [
      create('div', {}, [
        previewHost,
        create('div', { class: 'btn-row', style: 'margin-top: var(--space-3);' }, [downloadButton, regenerateButton]),
        shareStatus,
      ]),
      create('div', {}, [
        create('h3', { class: 'card__title', text: '分享文案' }),
        caption,
        create('div', { class: 'btn-row', style: 'margin-top: var(--space-3);' }, [copyButton, restartButton]),
        create('div', { class: 'notice', style: 'margin-top: var(--space-4);' }, [
          create('strong', { text: '免责声明：' }),
          create('span', { text: siteConfig.disclaimer }),
        ]),
      ]),
    ]),
  );

  container.append(shareSection);

  // 结果页出现后再生成分享图，避免与揭晓动画抢资源
  const generateTimer = window.setTimeout(() => void generate(), 500);

  return {
    element: container,
    cleanup: () => window.clearTimeout(generateTimer),
  };
};

function legendItem(label: string, swatchClass: string): HTMLElement {
  return create('span', { class: 'chart-legend__item' }, [
    create('span', { class: `chart-legend__swatch ${swatchClass}`, 'aria-hidden': 'true' }),
    create('span', { text: label }),
  ]);
}

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
