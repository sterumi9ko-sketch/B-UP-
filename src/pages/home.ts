import { siteConfig } from '@config';
import { DIMENSIONS } from '@core/dimensions';
import { QUESTION_COUNT } from '@data/questions';
import { state } from '@state';
import { create } from '@ui/dom';
import { routeHref } from '@ui/router';
import { createScale } from '@ui/components/scale';
import { toast } from '@ui/dom';
import type { PageRenderer } from '@ui/page-types';

/**
 * 首页（同时是测试入口）
 * ---------------------------------------------------------------------------
 * 顶部导航由布局负责，这里只渲染主内容：
 *   1. 标题区：说明这是什么、有多少题、要花多久
 *   2. 样例区：直接展示 7 级圆点怎么点，开始前就知道怎么答
 *   3. 维度区：8 个风格维度都是什么
 *   4. 流程区：三步说明 + 隐私说明
 */
export const renderHome: PageRenderer = () => {
  const answered = state.answeredCount;
  const hasProgress = answered > 0 && !state.isComplete;
  const matchableCount = state.roster.filter((up) => up.matchable).length;

  const container = create('div', { class: 'container' });

  /* ------------------------------------------------------------------ */
  /* 1. 标题区                                                           */
  /* ------------------------------------------------------------------ */
  const primaryHref = routeHref('test');
  const primaryButton = create('a', {
    class: 'btn btn--large',
    href: primaryHref,
    text: hasProgress ? `继续答题（已完成 ${answered}/${QUESTION_COUNT}）` : '开始测试',
  });

  const actionRow = create('div', { class: 'btn-row' }, [
    primaryButton,
    create('a', {
      class: 'btn btn--secondary',
      href: routeHref('gallery'),
      text: `先看看 ${matchableCount} 位 UP 主`,
    }),
  ]);

  if (hasProgress) {
    const resetButton = create('button', {
      class: 'btn btn--ghost btn--sm',
      type: 'button',
      text: '清空重来',
    });
    resetButton.addEventListener('click', () => {
      state.reset();
      toast('已清空答题记录');
      // 重新渲染首页，让"继续答题"变成"开始测试"
      const parent = container.parentElement;
      if (parent) {
        parent.innerHTML = '';
        const fresh = renderHome({ route: { name: 'home', params: {}, raw: '/' } });
        parent.append(fresh.element);
      }
    });
    actionRow.append(resetButton);
  }

  const heroText = create('div', {}, [
    create('p', { class: 'hero__eyebrow', text: '创作风格匹配 · 娱乐向' }),
    create('h1', { class: 'hero__title', html: '测测你是 B 站动画区的<em>哪位 UP 主</em>？' }),
    create('p', { class: 'hero__lead', text: siteConfig.tagline }),
    create('ul', { class: 'hero__facts' }, [
      fact(String(QUESTION_COUNT), '道题目'),
      fact(`约 ${siteConfig.test.estimatedMinutes} 分钟`, '预计用时'),
      fact(String(DIMENSIONS.length), '个风格维度'),
      fact(String(matchableCount), '位动画区 UP 主'),
    ]),
    create('p', {
      class: 'text-muted',
      text: '所有计算都在你的浏览器里完成；答题记录只保存在本机，不会上传，也不会收集任何个人信息。',
    }),
    actionRow,
  ]);

  /* ------------------------------------------------------------------ */
  /* 2. 样例区：7 级圆点预览                                             */
  /* ------------------------------------------------------------------ */
  const previewScale = createScale({
    value: null,
    onChange: (level) => {
      // 首页样例不进入正式作答，只是让用户熟悉操作，选完给个轻提示
      const option = ['完全认同', '非常认同', '比较认同', '中立', '不太认同', '非常不认同', '完全不认同'][level];
      toast(`正式测试里，这里会记下「${option}」并自动进入下一题`);
    },
  });

  const previewCard = create('aside', { class: 'preview-card', 'aria-label': '作答方式预览' }, [
    create('p', { class: 'preview-card__title', text: '每道题都这样答 · 试试点击' }),
    create('p', { class: 'preview-card__question', text: '比起单纯追番，我更愿意研究一部动画背后的设定和制作细节。' }),
    previewScale.element,
    create('p', {
      class: 'text-muted',
      style: 'font-size: var(--text-xs); margin: 0;',
      text: '左侧三档表示认同（越靠左越认同），中间是中立，右侧三档表示不认同。圆点越大，认同或反对的程度越强。',
    }),
  ]);

  container.append(create('section', { class: 'hero' }, [heroText, previewCard]));

  /* ------------------------------------------------------------------ */
  /* 3. 维度区                                                           */
  /* ------------------------------------------------------------------ */
  const dimensionCards = DIMENSIONS.map((dimension) =>
    create('article', { class: 'card card--flat card--pad-sm' }, [
      create('h3', { class: 'card__title', text: dimension.name }),
      create('p', { class: 'text-soft', style: 'font-size: var(--text-sm); margin-bottom: var(--space-2);', text: dimension.definition }),
      create('p', {
        class: 'card__meta',
        text: `高分：${dimension.highMeans}`,
      }),
    ]),
  );

  container.append(
    create('section', { class: 'section' }, [
      create('h2', { class: 'section__title', text: '测的是这 8 个创作风格维度' }),
      create('p', {
        class: 'section__lead',
        text: '这些维度描述的是"公开作品里能观察到的创作方式"，不涉及任何 UP 主的私人性格。每个维度都有明确的高分与低分行为，因此分数可解释、可复核。',
      }),
      create('div', { class: 'up-grid' }, dimensionCards),
    ]),
  );

  /* ------------------------------------------------------------------ */
  /* 4. 流程区                                                           */
  /* ------------------------------------------------------------------ */
  container.append(
    create('section', { class: 'section' }, [
      create('h2', { class: 'section__title', text: '它是怎么算出来的' }),
      create('p', { class: 'section__lead', text: '没有随机数，也没有"看心情"的结果。三步都是可以自己核对的数学运算。' }),
      create('div', { class: 'up-grid' }, [
        stepCard('01', '按维度累计得分', '每道题对应一个风格维度。7 档选项对应 +3 到 -3 分，反向题会取反，然后按题目权重累加。'),
        stepCard('02', '标准化到 0–100', '用该维度理论上的最低分与最高分做线性映射，所以 50 分永远代表"这个维度上比较中性"。'),
        stepCard('03', '加权欧氏距离匹配', '把 100 位观众的距离公式用在 8 个维度上，算出与你最近的 UP 主，并换算成 0–100 的风格相似指数。'),
      ]),
      create('div', { class: 'notice notice--accent', style: 'margin-top: var(--space-5);' }, [
        create('strong', { text: '请注意：' }),
        create('span', {
          text: ' 结果是"创作风格相似度"，不是心理测量学意义上的人格结论，也不代表 UP 主本人认可或认同这个结果。',
        }),
      ]),
    ]),
  );

  return { element: container };

  function fact(value: string, label: string): HTMLElement {
    return create('li', { class: 'fact' }, [
      create('span', { class: 'fact__value', text: value }),
      create('span', { class: 'fact__label', text: label }),
    ]);
  }

  function stepCard(index: string, title: string, text: string): HTMLElement {
    return create('article', { class: 'card card--flat card--pad-sm' }, [
      create('p', { class: 'card__meta', text: index }),
      create('h3', { class: 'card__title', text: title }),
      create('p', { class: 'text-soft', style: 'font-size: var(--text-sm); margin: 0;', text }),
    ]);
  }
};
