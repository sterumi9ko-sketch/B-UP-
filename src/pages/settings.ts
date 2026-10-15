import { DIMENSIONS, DIMENSION_IDS } from '@core/dimensions';
import { buildRanking } from '@core/scoring';
import { UPS } from '@data/ups';
import {
  exportAsJson,
  exportAsTypeScript,
  importFromJson,
  isOverridden,
  SCORE_MAX,
  SCORE_MIN,
} from '@core/up-overrides';
import { createAvatar } from '@ui/components/avatar';
import { create, downloadBlob, openModal, toast } from '@ui/dom';
import { renderRadar, renderScoreBars } from '@ui/charts';
import { state } from '@state';
import type { DimensionId, DimensionScores, UpProfile } from '@core/types';
import type { PageRenderer } from '@ui/page-types';

/**
 * UP 主数据设置页
 * ===========================================================================
 * 对应需求：「添加可以修改 UP 主的性格数据的设置」。
 *
 * 为什么是「本地覆盖 + 导出」而不是「在网页上直接改文件」：
 *   本站是纯静态站点，浏览器没有写项目文件的权限。这是浏览器的安全模型
 *   决定的，不是实现难度问题。所以这里的改动保存在 localStorage，
 *   只影响本机预览；想永久生效就用「导出 TypeScript 片段」把值粘回
 *   src/data/ups/group*.ts，然后重新构建部署。
 *
 * 页面结构：
 *   左：UP 主列表（可搜索，标出哪些被改过）
 *   右：8 维分数编辑器（滑块），并实时预览画像与排名变化
 *   顶：导出片段 / 导出 JSON / 导入 JSON / 全部恢复
 */
export const renderSettings: PageRenderer = () => {
  const container = create('div', { class: 'container' });

  let selectedId: string = UPS[0]?.id ?? '';
  let keyword = '';

  const overrideBadge = create('span', { class: 'tag' });
  const listHost = create('div', { class: 'settings-list' });
  const editorHost = create('div', { class: 'settings-editor' });

  /* ------------------------------------------------------------------ */
  /* 搜索                                                                */
  /* ------------------------------------------------------------------ */
  const searchInput = create('input', {
    class: 'search-input',
    type: 'search',
    placeholder: '搜索昵称、UID 或分类',
    'aria-label': '搜索 UP 主',
  }) as HTMLInputElement;
  searchInput.addEventListener('input', () => {
    keyword = searchInput.value.trim().toLowerCase();
    renderList();
  });

  /* ------------------------------------------------------------------ */
  /* 顶部操作                                                            */
  /* ------------------------------------------------------------------ */
  const resetAllButton = create('button', {
    class: 'btn btn--ghost btn--sm',
    type: 'button',
    text: '全部恢复默认',
  });
  resetAllButton.addEventListener('click', () => {
    if (state.overriddenCount === 0) {
      toast('当前没有调整过任何 UP 主');
      return;
    }
    if (!window.confirm(`确定把 ${state.overriddenCount} 位 UP 主的分数恢复成源码基准值吗？`)) return;
    state.resetAllOverrides();
    toast('已全部恢复默认');
    renderAll();
  });

  const exportJsonButton = create('button', {
    class: 'btn btn--secondary btn--sm',
    type: 'button',
    text: '导出 JSON',
  });
  exportJsonButton.addEventListener('click', () => {
    const json = exportAsJson(state.overrides);
    downloadBlob(new Blob([json], { type: 'application/json' }), `up-scores-${today()}.json`);
    toast('已下载 JSON 备份');
  });

  const exportTsButton = create('button', {
    class: 'btn btn--secondary btn--sm',
    type: 'button',
    text: '导出 TypeScript 片段',
  });
  exportTsButton.addEventListener('click', () => {
    const code = exportAsTypeScript(state.overrides);
    const pre = create('pre', { class: 'settings-code' });

    const copyButton = create('button', { class: 'btn btn--sm', type: 'button', text: '复制全部' });
    const closeModal = openModal(
      create('div', { class: 'detail-panel' }, [
        create('h2', { text: '可直接粘回源码的片段' }),
        create('p', {
          class: 'text-muted',
          text: '把下面每个条目的 scores 替换到 src/data/ups/group*.ts 里对应 UP 主的档案，然后重新构建部署。',
        }),
        pre,
        create('div', { class: 'btn-row' }, [copyButton]),
      ]),
      { label: '导出的代码片段' },
    );

    // 代码片段用 textContent 写入，避免 HTML 转义问题
    pre.textContent = code;

    copyButton.addEventListener('click', () => {
      void copyToClipboard(code).then((ok) => toast(ok ? '已复制到剪贴板' : '复制失败，请手动选择复制'));
    });
    copyButton.addEventListener('click', () => {
      // 复制后不自动关闭，便于用户核对
    });

    void closeModal;
  });

  const importInput = create('input', {
    type: 'file',
    accept: '.json,application/json',
    class: 'visually-hidden',
    'aria-label': '导入 JSON',
  }) as HTMLInputElement;
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const result = importFromJson(await file.text());
      if (result.imported === 0) {
        toast('这个文件里没有可用的 UP 主数据');
        return;
      }
      state.replaceOverrides(result.overrides);
      toast(`已导入 ${result.imported} 位 UP 主的分数${result.skipped ? `，跳过 ${result.skipped} 条` : ''}`);
      renderAll();
    } catch (error) {
      toast(`导入失败：${(error as Error).message}`);
    } finally {
      importInput.value = '';
    }
  });

  const importButton = create('button', {
    class: 'btn btn--secondary btn--sm',
    type: 'button',
    text: '导入 JSON',
  });
  importButton.addEventListener('click', () => importInput.click());

  container.append(
    create('header', { class: 'settings-header' }, [
      create('div', { class: 'settings-header__intro' }, [
        create('h1', { text: 'UP 主数据设置' }),
        create('p', {
          class: 'text-soft',
          text: '在这里调整每位 UP 主的 8 个维度分数。改动保存在你自己的浏览器里，只影响本机预览与结果计算；想永久生效就导出片段粘回源码文件。',
        }),
        create('p', { class: 'settings-status' }, [
          overrideBadge,
          create('span', {
            class: 'text-muted',
            text: ` 基准数据来自 src/data/ups/*.ts，共 ${UPS.length} 位；分数范围 ${SCORE_MIN}–${SCORE_MAX}。`,
          }),
        ]),
      ]),
      create('div', { class: 'settings-actions' }, [exportTsButton, exportJsonButton, importButton, resetAllButton, importInput]),
    ]),
  );

  container.append(
    create('div', { class: 'settings-layout' }, [
      create('aside', { class: 'settings-side' }, [create('div', { class: 'settings-side__search' }, [searchInput]), listHost]),
      editorHost,
    ]),
  );

  container.append(
    create('div', { class: 'notice', style: 'margin-top: var(--space-5);' }, [
      create('strong', { text: '评分参考：' }),
      create('span', {
        text: '分数描述的是"公开作品呈现出来的创作方式"，不是 UP 主的真实人格。分档标准见 docs/SCORING.md（S 88-100 / A 74-87 / B 58-73 / C 42-57 / D 0-41）。调整源码数据后建议运行 npm test 与 node scripts/calibrate.mjs 复核。',
      }),
    ]),
  );

  /* ------------------------------------------------------------------ */
  /* 渲染：列表                                                          */
  /* ------------------------------------------------------------------ */
  function filtered(): UpProfile[] {
    if (!keyword) return UPS;
    return UPS.filter((up) => [up.name, String(up.uid), up.category, ...up.tags].join(' ').toLowerCase().includes(keyword));
  }

  function renderList(): void {
    listHost.innerHTML = '';
    const list = filtered();

    if (!list.length) {
      listHost.append(create('p', { class: 'text-muted', text: '没有匹配的 UP 主' }));
      return;
    }

    for (const up of list) {
      const changed = isOverridden(state.overrides, up.id);
      const item = create(
        'button',
        {
          class: `settings-list__item${up.id === selectedId ? ' is-active' : ''}`,
          type: 'button',
          'aria-pressed': up.id === selectedId ? 'true' : 'false',
        },
        [
          createAvatar(up, { className: 'settings-list__avatar', size: 56 }),
          create('span', { class: 'settings-list__meta' }, [
            create('span', { class: 'settings-list__name', text: up.name }),
            create('span', { class: 'settings-list__sub', text: `UID ${up.uid}` }),
          ]),
          changed ? create('span', { class: 'tag tag--accent settings-list__badge', text: '已改' }) : '',
        ],
      );
      item.addEventListener('click', () => {
        selectedId = up.id;
        renderList();
        renderEditor();
      });
      listHost.append(item);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 渲染：编辑器                                                        */
  /* ------------------------------------------------------------------ */
  function renderEditor(): void {
    editorHost.innerHTML = '';
    const up = state.roster.find((item) => item.id === selectedId) ?? UPS[0];
    if (!up) {
      editorHost.append(create('p', { text: '没有可编辑的 UP 主' }));
      return;
    }
    const base = UPS.find((item) => item.id === up.id);
    const changed = isOverridden(state.overrides, up.id);

    /* 头部 */
    const resetButton = create('button', {
      class: 'btn btn--secondary btn--sm',
      type: 'button',
      text: changed ? '恢复这位的默认值' : '已是默认值',
    });
    resetButton.disabled = !changed;
    resetButton.addEventListener('click', () => {
      state.resetUp(up.id);
      toast(`已把 ${up.name} 恢复成基准值`);
      renderAll();
    });

    const head = create('div', { class: 'settings-editor__head' }, [
      createAvatar(up, { className: 'settings-editor__avatar', size: 112, eager: true }),
      create('div', { class: 'settings-editor__info' }, [
        create('h2', { text: up.name }),
        create('p', { class: 'text-muted', text: `UID ${up.uid} · ${up.category}` }),
        create('p', { class: 'text-soft', text: up.summary }),
        changed
          ? create('p', { class: 'settings-editor__changed', text: '这位 UP 主的分数已被本地调整' })
          : create('p', { class: 'text-muted', text: '当前与源码基准值一致' }),
      ]),
    ]);

    /* 8 个维度滑块 */
    const sliders: HTMLElement[] = [];
    for (const dimension of DIMENSIONS) {
      const value = up.scores[dimension.id];
      const baseValue = base?.scores[dimension.id] ?? value;
      const diff = value - baseValue;

      const valueLabel = create('span', { class: 'score-row__value', text: String(value) });

      const input = create('input', {
        class: 'score-row__range',
        type: 'range',
        min: String(SCORE_MIN),
        max: String(SCORE_MAX),
        step: '1',
        value: String(value),
        'aria-label': `${up.name} 的「${dimension.name}」分数`,
      }) as HTMLInputElement;

      let debounce: number | undefined;
      input.addEventListener('input', () => {
        valueLabel.textContent = input.value;
        if (debounce) window.clearTimeout(debounce);
        debounce = window.setTimeout(() => {
          state.setScore(up.id, dimension.id as DimensionId, Number(input.value));
          updatePreview();
          updateBadges();
        }, 100);
      });
      input.addEventListener('change', () => {
        state.setScore(up.id, dimension.id as DimensionId, Number(input.value));
        renderAll();
      });

      sliders.push(
        create('div', { class: 'score-row' }, [
          create('div', { class: 'score-row__label' }, [
            create('span', { class: 'score-row__name', text: dimension.name }),
            create('span', {
              class: 'score-row__base',
              text: diff === 0 ? `基准 ${baseValue}` : `基准 ${baseValue} → ${diff > 0 ? '+' : ''}${diff}`,
            }),
          ]),
          input,
          valueLabel,
        ]),
      );
    }

    editorHost.append(
      create('div', {}, [
        head,
        create('div', { class: 'btn-row', style: 'margin: var(--space-3) 0 var(--space-4);' }, [resetButton]),
        create('div', { class: 'score-rows' }, sliders),
        create('div', { class: 'settings-preview' }, [
          create('h3', { text: '实时预览' }),
          create('p', {
            class: 'text-muted',
            text: '以"全部中立"的观众画像为参照，看这位 UP 主在完整名单里的位置。改动会立即影响结果页（如果已经答完题）。',
          }),
          create('div', { class: 'settings-preview__body' }, []),
        ]),
      ]),
    );

    updatePreview();
  }

  /** 实时预览：中立画像下的排名 + 分数条 + 雷达图 */
  function updatePreview(): void {
    const host = editorHost.querySelector('.settings-preview__body');
    if (!(host instanceof HTMLElement)) return;
    const up = state.roster.find((item) => item.id === selectedId);
    if (!up) return;

    host.innerHTML = '';

    const neutral = {} as DimensionScores;
    for (const id of DIMENSION_IDS) neutral[id] = 50;

    const ranking = buildRanking(neutral, state.roster);
    const selfIndex = ranking.findIndex((row) => row.up.id === up.id);
    const selfRow = selfIndex >= 0 ? ranking[selfIndex] : null;

    host.append(
      create('p', {
        class: 'settings-preview__rank',
        text: selfRow
          ? `当前排名：第 ${selfRow.rank} / ${ranking.length} 位 · 相似指数 ${selfRow.similarity}`
          : '这位 UP 主当前不参与匹配（matchable 为 false）',
      }),
      renderScoreBars(up.scores),
      renderRadar({
        series: [{ name: up.name, scores: up.scores, stroke: '#c05f3c', fill: 'rgba(192, 95, 60, 0.22)' }],
        size: 300,
        animate: false,
      }),
    );
  }

  function updateBadges(): void {
    const count = state.overriddenCount;
    overrideBadge.textContent = count === 0 ? '当前使用源码基准值' : `已调整 ${count} 位`;
    overrideBadge.className = count === 0 ? 'tag' : 'tag tag--accent';
  }

  function renderAll(): void {
    renderList();
    renderEditor();
    updateBadges();
  }

  renderAll();

  return { element: container };
};

/* ====================================================================== */
/* 小工具                                                                  */
/* ====================================================================== */

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 复制文本。优先用 Clipboard API；file:// 或权限受限时退回 textarea + execCommand。
 * （本站可能被本地双击打开，所以必须有退路）
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 落到下面的退路 */
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
