import { DIMENSIONS, DIMENSION_IDS } from '@core/dimensions';
import { buildRanking } from '@core/scoring';
import { UPS } from '@data/ups';
import {
  emptyScores,
  exportAsJson,
  exportAsTypeScript,
  importFromJson,
  isOverridden,
  REQUIRED_FIELDS,
  SCORE_MAX,
  SCORE_MIN,
  UP_CATEGORIES,
  validateCustomUp,
  type CustomUpInput,
} from '@core/up-overrides';
import { createAvatar } from '@ui/components/avatar';
import { create, downloadBlob, openModal, toast } from '@ui/dom';
import { renderRadar, renderScoreBars } from '@ui/charts';
import { state } from '@state';
import type { DimensionId, DimensionScores, UpCategory, UpProfile } from '@core/types';
import type { PageRenderer } from '@ui/page-types';

/**
 * UP 主数据设置页
 * ===========================================================================
 * 对应需求：「添加可以修改 UP 主的性格数据的设置」
 *          「可以添加删减 UP，但是需要提供相关的数据」
 *
 * 三类操作，全部只作用于本机浏览器：
 *   1. 调分  改现有 UP 主的 8 维分数
 *   2. 新增  自己加一位（必填项由 validateCustomUp 硬校验）
 *   3. 移除  把一位移出名单（现有的可随时放回，自己加的即删除）
 *
 * 为什么不做成写文件：
 *   本站是纯静态站点，浏览器没有写项目文件的权限（浏览器安全模型决定）。
 *   所以采用「本地编辑 + 一键导出」：调好后导出片段粘回源码即为永久生效。
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
  const addButton = create('button', { class: 'btn btn--sm', type: 'button', text: '＋ 新增 UP 主' });
  addButton.addEventListener('click', () => openAddDialog());

  const resetAllButton = create('button', {
    class: 'btn btn--ghost btn--sm',
    type: 'button',
    text: '全部恢复默认',
  });
  resetAllButton.addEventListener('click', () => {
    if (state.changeCount === 0) {
      toast('当前没有做过任何调整');
      return;
    }
    const parts = [
      state.overriddenCount ? `分数调整 ${state.overriddenCount} 位` : '',
      state.customCount ? `新增 ${state.customCount} 位` : '',
      state.hiddenCount ? `移除 ${state.hiddenCount} 位` : '',
    ].filter(Boolean);
    if (!window.confirm(`确定要恢复默认吗？将会清除：${parts.join('、')}。`)) return;
    state.resetAll();
    selectedId = state.roster[0]?.id ?? '';
    toast('已全部恢复默认');
    renderAll();
  });

  const exportJsonButton = create('button', {
    class: 'btn btn--secondary btn--sm',
    type: 'button',
    text: '导出 JSON',
  });
  exportJsonButton.addEventListener('click', () => {
    const json = exportAsJson(state.rosterState);
    downloadBlob(new Blob([json], { type: 'application/json' }), `up-roster-${today()}.json`);
    toast('已下载 JSON 备份');
  });

  const exportTsButton = create('button', {
    class: 'btn btn--secondary btn--sm',
    type: 'button',
    text: '导出 TypeScript 片段',
  });
  exportTsButton.addEventListener('click', () => {
    const code = exportAsTypeScript(state.rosterState);
    const pre = create('pre', { class: 'settings-code' });
    const copyButton = create('button', { class: 'btn btn--sm', type: 'button', text: '复制全部' });

    openModal(
      create('div', { class: 'detail-panel' }, [
        create('h2', { text: '可直接粘回源码的片段' }),
        create('p', {
          class: 'text-muted',
          text: '分数调整 → 替换对应档案的 scores；移除 → 把 matchable 改成 false；新增 → 补进 src/data/ups/group3.ts。',
        }),
        pre,
        create('div', { class: 'btn-row' }, [copyButton]),
      ]),
      { label: '导出的代码片段' },
    );

    pre.textContent = code;
    copyButton.addEventListener('click', () => {
      void copyToClipboard(code).then((ok) => toast(ok ? '已复制到剪贴板' : '复制失败，请手动选择复制'));
    });
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
        toast('这个文件里没有可用的数据');
        return;
      }
      state.replaceRoster(result.state);
      toast(`已导入 ${result.imported} 项${result.skipped ? `，跳过 ${result.skipped} 条` : ''}`);
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
          text: '调整各 UP 主的 8 个维度分数，或者新增、移除 UP 主。改动保存在你自己的浏览器里，只影响本机预览与结果计算；想永久生效就导出片段粘回源码文件。',
        }),
        create('p', { class: 'settings-status' }, [
          overrideBadge,
          create('span', {
            class: 'text-muted',
            text: ` 基准数据来自 src/data/ups/*.ts，原名单 ${UPS.length} 位；分数范围 ${SCORE_MIN}–${SCORE_MAX}。`,
          }),
        ]),
      ]),
      create('div', { class: 'settings-actions' }, [
        addButton,
        exportTsButton,
        exportJsonButton,
        importButton,
        resetAllButton,
        importInput,
      ]),
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
      create('strong', { text: '新增 UP 主需要提供：' }),
      create('span', {
        text: `${REQUIRED_FIELDS.map((field) => field.label).join('、')}。缺任意一项都无法保存——分数描述的是"公开作品呈现出来的创作方式"，不是 UP 主的真实人格。分档标准见 docs/SCORING.md。`,
      }),
    ]),
  );

  /* ------------------------------------------------------------------ */
  /* 渲染：名单                                                          */
  /* ------------------------------------------------------------------ */
  function filtered(): UpProfile[] {
    const list = state.roster;
    if (!keyword) return list;
    return list.filter((up) =>
      [up.name, String(up.uid), up.category, ...up.tags].join(' ').toLowerCase().includes(keyword),
    );
  }

  function renderList(): void {
    listHost.innerHTML = '';
    const list = filtered();

    if (!list.length) {
      listHost.append(create('p', { class: 'text-muted', text: '没有匹配的 UP 主' }));
    }

    for (const up of list) {
      const changed = isOverridden(state.overrides, up.id);
      const custom = state.isCustomUp(up.id);
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
          custom
            ? create('span', { class: 'tag settings-list__badge', text: '新增' })
            : changed
              ? create('span', { class: 'tag tag--accent settings-list__badge', text: '已改' })
              : '',
        ],
      );
      item.addEventListener('click', () => {
        selectedId = up.id;
        renderList();
        renderEditor();
      });
      listHost.append(item);
    }

    /* 被移除的名单单独列出，方便放回 */
    if (state.hidden.length) {
      const removed = create('div', { class: 'settings-list__removed' }, [
        create('p', {
          class: 'settings-list__removed-title',
          text: `已移除 ${state.hidden.length} 位（不参与匹配）`,
        }),
      ]);
      for (const id of state.hidden) {
        const up = UPS.find((item) => item.id === id);
        if (!up) continue;
        const restore = create('button', {
          class: 'settings-list__restore',
          type: 'button',
          text: `↺ ${up.name}`,
          title: '点击放回名单',
        });
        restore.addEventListener('click', () => {
          state.unhideUp(id);
          toast(`已把 ${up.name} 放回名单`);
          renderAll();
        });
        removed.append(restore);
      }
      listHost.append(removed);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 渲染：编辑器                                                        */
  /* ------------------------------------------------------------------ */
  function renderEditor(): void {
    editorHost.innerHTML = '';
    const up = state.roster.find((item) => item.id === selectedId) ?? state.roster[0];
    if (!up) {
      editorHost.append(
        create('div', { class: 'settings-empty' }, [
          create('p', { text: '名单是空的。可以点右上角「＋ 新增 UP 主」加一位。' }),
        ]),
      );
      return;
    }
    selectedId = up.id;

    const base = UPS.find((item) => item.id === up.id);
    const custom = state.isCustomUp(up.id);
    const changed = isOverridden(state.overrides, up.id);

    /* 操作按钮 */
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

    const removeButton = create('button', {
      class: 'btn btn--danger btn--sm',
      type: 'button',
      text: custom ? '删除这位 UP 主' : '从名单中移除',
    });
    removeButton.addEventListener('click', () => {
      const message = custom
        ? `确定删除自己添加的「${up.name}」吗？删除后无法恢复（可以先用导出的 JSON 备份）。`
        : `确定把「${up.name}」移出匹配名单吗？源码里的数据不会变，随时可以放回。`;
      if (!window.confirm(message)) return;
      const next = state.roster.find((item) => item.id !== up.id);
      state.hideUp(up.id);
      selectedId = next?.id ?? '';
      toast(custom ? `已删除 ${up.name}` : `已把 ${up.name} 移出名单`);
      renderAll();
    });

    /* 头部 */
    const head = create('div', { class: 'settings-editor__head' }, [
      createAvatar(up, { className: 'settings-editor__avatar', size: 112, eager: true }),
      create('div', { class: 'settings-editor__info' }, [
        create('h2', { text: up.name }),
        create('p', { class: 'text-muted', text: `UID ${up.uid} · ${up.category}` }),
        create('p', { class: 'text-soft', text: up.summary }),
        custom
          ? create('p', { class: 'settings-editor__custom', text: '这是你自己添加的 UP 主（未经过资料核实）' })
          : changed
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
              text: custom
                ? '自定义档案'
                : diff === 0
                  ? `基准 ${baseValue}`
                  : `基准 ${baseValue} → ${diff > 0 ? '+' : ''}${diff}`,
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
        create('div', { class: 'btn-row', style: 'margin: var(--space-3) 0 var(--space-4);' }, [resetButton, removeButton]),
        create('div', { class: 'score-rows' }, sliders),
        create('div', { class: 'settings-preview' }, [
          create('h3', { text: '实时预览' }),
          create('p', {
            class: 'text-muted',
            text: '以"全部中立"的观众画像为参照，看这位 UP 主在当前名单里的位置。改动会立即影响结果页（如果已经答完题）。',
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
    const selfRow = ranking.find((row) => row.up.id === up.id) ?? null;

    host.append(
      create('p', {
        class: 'settings-preview__rank',
        text: selfRow
          ? `当前排名：第 ${selfRow.rank} / ${ranking.length} 位 · 相似指数 ${selfRow.similarity}`
          : '这位 UP 主当前不参与匹配',
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
    const count = state.changeCount;
    const parts = [
      state.overriddenCount ? `改分 ${state.overriddenCount}` : '',
      state.customCount ? `新增 ${state.customCount}` : '',
      state.hiddenCount ? `移除 ${state.hiddenCount}` : '',
    ].filter(Boolean);
    overrideBadge.textContent = count === 0 ? '当前使用源码基准名单' : `已调整：${parts.join(' · ')}`;
    overrideBadge.className = count === 0 ? 'tag' : 'tag tag--accent';
  }

  function renderAll(): void {
    renderList();
    renderEditor();
    updateBadges();
  }

  /* ------------------------------------------------------------------ */
  /* 新增 UP 主对话框                                                    */
  /* ------------------------------------------------------------------ */
  function openAddDialog(): void {
    const draft: Partial<CustomUpInput> = {
      name: '',
      uid: undefined,
      category: undefined,
      summary: '',
      scores: emptyScores(),
      contentFocus: '',
      sourceUrl: '',
    };
    const errors: Record<string, string> = {};

    const body = create('div', { class: 'up-form' });
    const errorHost = create('div', { class: 'up-form__errors' });

    /* 昵称 */
    const nameInput = field(body, '昵称', true, '例如：泛式') as HTMLInputElement;
    nameInput.maxLength = 30;
    nameInput.addEventListener('input', () => {
      draft.name = nameInput.value;
      clearError('name');
    });

    /* UID */
    const uidInput = field(body, 'B 站 UID', true, '纯数字，例如 63231') as HTMLInputElement;
    uidInput.inputMode = 'numeric';
    uidInput.addEventListener('input', () => {
      const digits = uidInput.value.replace(/\D/g, '');
      if (digits !== uidInput.value) uidInput.value = digits;
      draft.uid = digits ? Number(digits) : undefined;
      clearError('uid');
    });

    /* 分类 */
    const categorySelect = create('select', { class: 'input' }) as HTMLSelectElement;
    categorySelect.append(create('option', { value: '', text: '请选择内容分类' }));
    for (const category of UP_CATEGORIES) {
      categorySelect.append(create('option', { value: category, text: category }));
    }
    categorySelect.addEventListener('change', () => {
      draft.category = (categorySelect.value || undefined) as UpCategory | undefined;
      clearError('category');
    });
    body.append(labelled('内容分类', true, categorySelect));

    /* 一句话风格 */
    const summaryInput = field(body, '一句话风格', true, '例如：把新番解读做成综艺节目的人') as HTMLInputElement;
    summaryInput.maxLength = 80;
    summaryInput.addEventListener('input', () => {
      draft.summary = summaryInput.value;
      clearError('summary');
    });

    /* 8 维分数 */
    const scoreGrid = create('div', { class: 'up-form__scores' });
    for (const dimension of DIMENSIONS) {
      const numberInput = create('input', {
        class: 'input input--number',
        type: 'number',
        min: String(SCORE_MIN),
        max: String(SCORE_MAX),
        step: '1',
        value: '50',
        'aria-label': `${dimension.name} 分数`,
      }) as HTMLInputElement;
      numberInput.addEventListener('input', () => {
        const raw = numberInput.value;
        if (raw === '') delete (draft.scores as Record<string, unknown>)[dimension.id];
        else (draft.scores as Record<string, number>)[dimension.id] = Number(raw);
        clearError('scores');
      });
      scoreGrid.append(labelled(dimension.name, true, numberInput));
    }
    body.append(
      create('div', { class: 'up-form__group' }, [
        create('p', { class: 'up-form__legend', text: '8 个维度分数（必填，0–100）' }),
        create('p', { class: 'text-muted', text: '分档参考：S 88-100 / A 74-87 / B 58-73 / C 42-57 / D 0-41。' }),
        scoreGrid,
      ]),
    );

    /* 可选项 */
    const focusInput = field(body, '主要创作内容', false, '可选，例如：新番吐槽、季度盘点') as HTMLInputElement;
    focusInput.addEventListener('input', () => {
      draft.contentFocus = focusInput.value;
    });

    const sourceInput = field(body, '资料来源链接', false, '可选，默认用 B 站空间地址') as HTMLInputElement;
    sourceInput.addEventListener('input', () => {
      draft.sourceUrl = sourceInput.value;
    });

    body.append(
      create('div', { class: 'notice notice--warning' }, [
        create('strong', { text: '请注意：' }),
        create('span', {
          text: '新增的档案会标记为「未核实」，分数由你填写。请只填写你有依据的内容，不要把主观猜测当成事实，也不要填写任何非公开的个人信息。',
        }),
      ]),
      errorHost,
    );

    const submitButton = create('button', { class: 'btn', type: 'button', text: '添加' });
    const cancelButton = create('button', { class: 'btn btn--ghost', type: 'button', text: '取消' });

    const closeModal = openModal(
      create('div', { class: 'detail-panel up-form-panel' }, [
        create('h2', { text: '新增 UP 主' }),
        create('p', {
          class: 'text-muted',
          text: `需要提供：${REQUIRED_FIELDS.map((field) => field.label).join('、')}。`,
        }),
        body,
        create('div', { class: 'btn-row' }, [submitButton, cancelButton]),
      ]),
      { label: '新增 UP 主' },
    );

    cancelButton.addEventListener('click', () => closeModal());

    submitButton.addEventListener('click', () => {
      const result = validateCustomUp(draft, state.roster);
      if (!result.ok) {
        for (const key of Object.keys(errors)) delete errors[key];
        for (const [key, message] of Object.entries(result.errors)) errors[key] = message;
        renderErrors();
        const first = Object.keys(result.errors)[0];
        toast(`还有必填项没填好：${result.errors[first]}`);
        return;
      }

      const profile = state.addCustomUp(draft as CustomUpInput);
      closeModal();
      selectedId = profile.id;
      keyword = '';
      searchInput.value = '';
      toast(`已添加 ${profile.name}，可以在结果页确认排名是否符合预期`);
      renderAll();
    });

    /** 字段修正后清掉对应错误 */
    function clearError(key: string): void {
      if (errors[key]) {
        delete errors[key];
        renderErrors();
      }
    }

    function renderErrors(): void {
      errorHost.innerHTML = '';
      for (const [key, message] of Object.entries(errors)) {
        errorHost.append(create('p', { class: 'up-form__error', text: `${labelOf(key)}：${message}` }));
      }
      if (Object.keys(errors).length) {
        errorHost.append(create('p', { class: 'text-muted', text: '修正上面的问题后再点「添加」。' }));
      }
    }

    function labelOf(key: string): string {
      const found = REQUIRED_FIELDS.find((field) => field.key === key);
      return found?.label ?? key;
    }

    nameInput.focus();
  }

  renderAll();

  return { element: container };
};

/* ====================================================================== */
/* 表单小工具                                                              */
/* ====================================================================== */

/** 一行「标签 + 必填标记 + 控件」 */
function labelled(label: string, required: boolean, control: HTMLElement): HTMLElement {
  return create('label', { class: 'up-form__field' }, [
    create('span', { class: 'up-form__label' }, [
      create('span', { text: label }),
      required ? create('span', { class: 'up-form__required', text: '必填' }) : '',
    ]),
    control,
  ]);
}

/** 创建文本输入框并挂到容器上 */
function field(parent: HTMLElement, label: string, required: boolean, placeholder: string): HTMLInputElement {
  const input = create('input', {
    class: 'input',
    type: 'text',
    placeholder,
    'aria-label': label,
  }) as HTMLInputElement;
  parent.append(labelled(label, required, input));
  return input;
}

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
