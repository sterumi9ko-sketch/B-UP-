import type { Dimension, DimensionId } from '@core/types';

/**
 * 8 个创作风格维度
 * ---------------------------------------------------------------------------
 * 设计原则：
 * 1. 每个维度都能从"公开投稿内容"里观察到，不涉及对 UP 主私人性格的推测。
 * 2. 维度之间尽量正交：只描述行为方式，不重复描述内容主题。
 *    例如"考据"看的是深挖设定的行为，"情绪共鸣"看的是对情绪与氛围的敏感度，
 *    两者可以同时高、也可以一高一低，因此是独立维度。
 * 3. 每个维度都有明确的高分行为与低分行为，方便给 UP 主打分时保持标准一致。
 */
export const DIMENSIONS: Dimension[] = [
  {
    id: 'humor',
    name: '幽默整活',
    short: '幽默',
    definition: '把内容做成段子、吐槽或整活的能力与偏好：是否习惯用笑点、梗和夸张的方式表达。',
    highMeans: '内容以笑点驱动，标题和节奏围绕"好玩"设计，常用夸张、反差、玩梗来推进。',
    lowMeans: '表达偏平实或严肃，即使内容有趣也不靠段子与夸张手法来呈现。',
  },
  {
    id: 'research',
    name: '深度考据',
    short: '考据',
    definition: '为了讲清一部作品，愿意查设定、翻资料、比对版本与制作背景的倾向。',
    highMeans: '习惯为作品建立完整信息框架，会引用资料、比对细节、解释创作背景。',
    lowMeans: '更看重观感与结论，不太愿意为一个细节展开长篇资料考证。',
  },
  {
    id: 'empathy',
    name: '情绪共鸣',
    short: '共鸣',
    definition: '对作品情绪、氛围与角色处境的敏感程度，以及表达情感体验的意愿。',
    highMeans: '常围绕"被打动"的瞬间展开，乐于分享自己的情绪体验与代入感受。',
    lowMeans: '更关注结构与信息本身，较少把个人情绪体验作为表达重点。',
  },
  {
    id: 'opinion',
    name: '观点表达',
    short: '观点',
    definition: '面对作品时形成并公开表达独立判断的倾向，包括对争议作品的立场。',
    highMeans: '有明确评价体系，敢下判断并说明理由，愿意为自己的结论负责。',
    lowMeans: '倾向于描述与介绍，避免给出明确的优劣判断。',
  },
  {
    id: 'narrative',
    name: '叙事创作',
    short: '叙事',
    definition: '用讲故事、编排节奏、设计结构的方式组织内容（含剪辑与视频化表达）的倾向。',
    highMeans: '重视起承转合与节奏，会为内容设计结构与高潮，愿意花时间打磨呈现形式。',
    lowMeans: '更偏向直接陈述信息，不太在意叙事结构与形式打磨。',
  },
  {
    id: 'community',
    name: '社群互动',
    short: '互动',
    definition: '把内容当作与观众共同话题来经营的倾向：回应评论、发起讨论、维护同好氛围。',
    highMeans: '常主动与观众互动，乐于推荐、提问、接梗，把观众当作一起聊番的人。',
    lowMeans: '内容更接近单向输出，与观众的即时互动较少。',
  },
  {
    id: 'experiment',
    name: '实验创新',
    short: '实验',
    definition: '在题材、形式与口味上主动尝试新东西、偏离主流套路的倾向。',
    highMeans: '愿意做冷门题材、没见过的形式或有风险的选题，把"新鲜"当作重要标准。',
    lowMeans: '偏好成熟稳定的题材与形式，更重视把常规内容做得扎实。',
  },
  {
    id: 'aesthetic',
    name: '审美表达',
    short: '审美',
    definition: '对画面、演出、配乐、配色等视听层面的敏感度，以及把审美判断讲清楚的倾向。',
    highMeans: '会专门讨论作画、演出、分镜、配乐等层面，对视觉呈现有明确偏好。',
    lowMeans: '更关注剧情与信息，较少单独讨论视听层面的表现。',
  },
];

/** 维度 id → 维度定义 */
export const DIMENSION_MAP: Record<DimensionId, Dimension> = DIMENSIONS.reduce(
  (acc, d) => {
    acc[d.id] = d;
    return acc;
  },
  {} as Record<DimensionId, Dimension>,
);

export const DIMENSION_IDS: DimensionId[] = DIMENSIONS.map((d) => d.id);

/** 维度排序用于稳定输出（雷达图、明细表的顺序） */
export function sortDimensionIds(ids: DimensionId[]): DimensionId[] {
  return [...ids].sort((a, b) => DIMENSION_IDS.indexOf(a) - DIMENSION_IDS.indexOf(b));
}
