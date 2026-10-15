import { DIMENSIONS } from '@core/dimensions';
import { spaceUrl } from '@core/assets';
import { createAvatar } from '@ui/components/avatar';
import { create, openModal, toast } from '@ui/dom';
import { navigate, routeHref } from '@ui/router';
import { state } from '@state';
import type { UpCategory, UpProfile } from '@core/types';
import type { PageRenderer } from '@ui/page-types';

/**
 * UP 主图鉴
 * ---------------------------------------------------------------------------
 * 目的不是罗列头像，而是让用户在答题前/后了解"测试对象是谁"：
 *   - 卡片：头像、昵称、UID、分类、风格标签、一句话总结
 *   - 详情：基本信息、主要内容、可观察的创作风格、8 维画像、资料来源、B 站主页
 *   - 支持按分类筛选 + 按昵称/标签搜索
 *
 * 直接访问 #/up/<uid> 会打开对应 UP 主的详情（方便从结果页分享单个主页链接）。
 */
export const renderGallery: PageRenderer = ({ route }) => {
  const container = create('div', { class: 'container' });

  const state_ = {
    category: 'all' as UpCategory | 'all',
    keyword: '',
  };

  // 图鉴展示的是「当前生效名单」（基准数据 + 用户在设置页新增/移除的结果）
  const roster = state.roster;
  const categories = Array.from(new Set(roster.map((up) => up.category)));

  const chipRow = create('div', { class: 'chip-row', role: 'group', 'aria-label': '按内容分类筛选' });
  const allChip = create('button', { class: 'chip', type: 'button', text: `全部（${roster.length}）`, 'aria-pressed': 'true' });
  allChip.addEventListener('click', () => {
    state_.category = 'all';
    syncChips();
    renderGrid();
  });
  chipRow.append(allChip);

  const chips = categories.map((category) => {
    const count = roster.filter((up) => up.category === category).length;
    const chip = create('button', { class: 'chip', type: 'button', text: `${category}（${count}）`, 'aria-pressed': 'false' });
    chip.addEventListener('click', () => {
      state_.category = category;
      syncChips();
      renderGrid();
    });
    chipRow.append(chip);
    return { category, chip };
  });

  function syncChips(): void {
    allChip.setAttribute('aria-pressed', state_.category === 'all' ? 'true' : 'false');
    for (const { category, chip } of chips) {
      chip.setAttribute('aria-pressed', state_.category === category ? 'true' : 'false');
    }
  }

  const searchInput = create('input', {
    class: 'search-input',
    type: 'search',
    placeholder: '搜索昵称或风格标签，例如「考据」「泛式」',
    'aria-label': '搜索 UP 主',
  }) as HTMLInputElement;
  searchInput.addEventListener('input', () => {
    state_.keyword = searchInput.value.trim().toLowerCase();
    renderGrid();
  });

  const resultCount = create('p', { class: 'card__meta' });
  const grid = create('div', { class: 'up-grid' });

  container.append(
    create('header', { class: 'reading' }, [
      create('h1', { text: '动画区 UP 主图鉴' }),
      create('p', {
        class: 'text-soft',
        text: '下面是本站参与匹配的 UP 主。资料全部来自公开创作内容（投稿标题、简介、标签与空间公开信息），不含任何私人信息；每个档案都标注了资料来源与核实状态。',
      }),
      create('p', { class: 'gallery__actions' }, [
        create('a', {
          class: 'btn btn--secondary btn--sm',
          href: routeHref('settings'),
          text: '调整 UP 主分数',
        }),
        create('span', {
          class: 'text-muted',
          text: ' 如果觉得某位 UP 主的维度评分不准，可以在这里改（改动保存在你的浏览器里）。',
        }),
      ]),
    ]),
    create('div', { class: 'filters' }, [searchInput, chipRow]),
    resultCount,
    grid,
  );

  function filtered(): UpProfile[] {
    return state.roster.filter((up) => {
      if (state_.category !== 'all' && up.category !== state_.category) return false;
      if (!state_.keyword) return true;
      const haystack = [up.name, up.summary, up.contentFocus, ...up.tags, String(up.uid)].join(' ').toLowerCase();
      return haystack.includes(state_.keyword);
    });
  }

  function renderGrid(): void {
    const list = filtered();
    grid.innerHTML = '';
    resultCount.textContent = `共 ${list.length} 位${state_.category === 'all' ? '' : ` · 分类：${state_.category}`}`;

    if (!list.length) {
      grid.append(
        create('div', { class: 'empty-state', style: 'grid-column: 1 / -1;' }, [
          create('p', { text: '没有找到符合条件的 UP 主，换个关键词试试。' }),
          create('button', {
            class: 'btn btn--secondary btn--sm',
            type: 'button',
            text: '清空筛选',
          }),
        ]),
      );
      const reset = grid.querySelector('button');
      reset?.addEventListener('click', () => {
        searchInput.value = '';
        state_.keyword = '';
        state_.category = 'all';
        syncChips();
        renderGrid();
      });
      return;
    }

    for (const up of list) {
      const card = create('button', { class: 'up-card', type: 'button', 'aria-label': `查看 ${up.name} 的详细资料` }, [
        create('div', { class: 'up-card__head' }, [
          createAvatar(up, { className: 'up-card__avatar', size: 112 }),
          create('div', {}, [
            create('h2', { class: 'up-card__name', text: up.name }),
            create('p', { class: 'up-card__uid', text: `UID ${up.uid} · ${up.category}` }),
          ]),
        ]),
        create('p', { class: 'up-card__summary', text: up.summary }),
        create('ul', { class: 'tag-list' }, up.tags.slice(0, 4).map((tag) => create('li', { class: 'tag', text: tag }))),
        create('p', {
          class: 'card__meta',
          style: 'margin: 0;',
          text: up.verification === 'verified' ? '资料已核实' : up.verification === 'partial' ? '部分资料待补充' : '待核实',
        }),
      ]);
      card.addEventListener('click', () => openDetail(up));
      grid.append(card);
    }
  }

  function openDetail(up: UpProfile): void {
    const panel = create('div', { class: 'detail-panel', role: 'document' });

    const closeButton = create('button', { class: 'btn btn--ghost btn--sm detail-panel__close', type: 'button', text: '关闭 ✕' });

    const head = create('div', { class: 'detail-head' }, [
      createAvatar(up, { className: 'detail-head__avatar', size: 160, eager: true }),
      create('div', {}, [
        create('h2', { class: 'detail-panel__title', style: 'margin-bottom: var(--space-1);', text: up.name }),
        create('p', { class: 'card__meta', style: 'margin: 0;', text: `UID ${up.uid} · ${up.category}` }),
        create('ul', { class: 'tag-list', style: 'margin-top: var(--space-2);' }, up.tags.map((tag) => create('li', { class: 'tag tag--accent', text: tag }))),
      ]),
    ]);

    // 8 维画像（文字 + 条形，屏幕阅读器可读）
    const scoresList = create('ul', { class: 'bars' },
      DIMENSIONS.map((dimension) => {
        const value = Math.round(up.scores[dimension.id] ?? 0);
        const fill = create('div', { class: 'bar-row__fill' });
        fill.style.width = `${value}%`;
        return create('li', { class: 'bar-row' }, [
          create('span', { class: 'bar-row__label', text: dimension.name }),
          create('div', { class: 'bar-row__track', role: 'img', 'aria-label': `${dimension.name} ${value} 分` }, [fill]),
          create('span', { class: 'bar-row__value', text: String(value) }),
        ]);
      }),
    );

    panel.append(
      closeButton,
      head,
      section('创作风格简介', [create('p', { class: 'text-soft', text: up.intro })]),
      section('主要创作内容', [create('p', { class: 'text-soft', text: up.contentFocus })]),
      section('公开可观察到的创作风格', [
        create('ul', {}, up.observedStyle.map((item) => create('li', { text: item }))),
      ]),
      section('风格维度画像', [
        scoresList,
        create('p', { class: 'card__meta', style: 'margin-top: var(--space-3);', text: up.scoreRationale }),
      ]),
      section('资料来源与核实状态', compact([
        create('p', {
          class: 'card__meta',
          text:
            up.verification === 'verified'
              ? `资料已通过公开接口核实${up.verifiedAt ? `（${up.verifiedAt}）` : ''}。`
              : up.verification === 'partial'
                ? '昵称与 UID 已核实，部分字段仍在补充。'
                : '该条目为待核实数据，不会作为正式匹配结果上线。',
        }),
        create('ul', {}, up.sources.map((source) =>
          create('li', {}, compact([
            create('span', { text: `${source.label}：` }),
            create('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer nofollow', text: source.url }),
            source.fetchedAt ? create('span', { class: 'text-muted', text: `（查证于 ${source.fetchedAt}）` }) : null,
          ])),
        )),
        up.fansSnapshot
          ? create('p', { class: 'card__meta', text: `公开粉丝数快照：${up.fansSnapshot.toLocaleString('zh-CN')}（会随时间变化）` })
          : null,
      ])),
      section('B 站主页', [
        create('a', {
          class: 'btn',
          href: spaceUrl(up),
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
          text: `打开 space.bilibili.com/${up.uid} ↗`,
        }),
      ]),
      create('p', { class: 'card__meta', style: 'margin-top: var(--space-4);', text: '以上内容仅描述公开作品呈现出的创作方式，不代表对 UP 主本人性格的判断。' }),
    );

    const close = openModal(panel, { label: `${up.name} 的详细资料` });
    closeButton.addEventListener('click', close);

    // 支持浏览器返回键关闭详情
    const onHashChange = () => {
      if (!window.location.hash.startsWith('#/up/')) close();
    };
    window.addEventListener('hashchange', onHashChange, { once: true });
  }

  renderGrid();

  // 直接访问 #/up/<uid> 时自动打开详情
  const uidParam = route.params.uid;
  if (uidParam) {
    const up = state.roster.find((item) => String(item.uid) === uidParam);
    if (up) {
      window.setTimeout(() => openDetail(up), 60);
    } else {
      toast('没有找到这个 UID 对应的 UP 主');
      navigate('/gallery', { replace: true });
    }
  }

  return { element: container };
};

function section(title: string, children: HTMLElement[]): HTMLElement {
  return create('section', { class: 'detail-section' }, [
    create('h3', { class: 'detail-section__title', text: title }),
    ...children,
  ]);
}

/** 过滤掉条件渲染产生的空值，让类型收窄成 HTMLElement[] */
function compact(children: Array<HTMLElement | null | undefined | false>): HTMLElement[] {
  return children.filter((child): child is HTMLElement => Boolean(child));
}
