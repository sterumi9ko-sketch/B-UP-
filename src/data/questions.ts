import type { Question } from '@core/types';

/**
 * 正式测试题目（40 题）
 * ---------------------------------------------------------------------------
 * 设计原则：
 * 1. 8 个维度各 5 题，等权（每题权重 1.0），因此每个维度的满分都是 15 分，
 *    标准化时上下界完全对称——用户全选"完全认同"或"完全不认同"时，
 *    各维度会稳定落在 0 或 100，不会因为题目结构而倾斜。
 * 2. 40 题中有 14 道反向题（约 35%），用于降低"一路点认同"造成的机械作答偏差。
 * 3. 反向题不是正向题的简单否定，而是从另一个行为侧面描述同一维度，
 *    避免出现"这两题其实是同一题"的重复感。
 * 4. 题干不出现具体作品名，任何人都不需要看过某部动画才能作答。
 * 5. 不写成"更好的选择"：每条描述都对应一种真实的创作/观看习惯。
 *
 * 修改题目时请注意：
 * - id 必须唯一，且不要随意改动已发布题目的 id（会让老用户的答题记录失效）。
 * - dimension 必须是 src/core/dimensions.ts 里定义的 8 个维度之一。
 * - 每个维度建议保持 5 题左右，改动后请运行 npm test 检查维度分布。
 */
export const QUESTIONS: Question[] = [
  /* ---------------- 幽默整活 ---------------- */
  {
    id: 'q01',
    text: '聊天时我经常会突然冒出一个奇怪但很好笑的想法，忍不住想讲出来。',
    dimension: 'humor',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q02',
    text: '看到喜欢的动画里出现离谱的场面，我的第一反应是截图做表情包，而不是挑毛病。',
    dimension: 'humor',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q03',
    text: '我更喜欢直接聊作品本身，不太愿意为了效果去玩梗或者吐槽。',
    dimension: 'humor',
    weight: 1,
    reverse: true,
  },
  {
    id: 'q04',
    text: '如果让我讲一件有趣的事，我会忍不住加入夸张的语气和停顿来制造笑点。',
    dimension: 'humor',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q05',
    text: '即使是轻松的话题，我的表达方式也偏平实、严肃。',
    dimension: 'humor',
    weight: 1,
    reverse: true,
  },

  /* ---------------- 深度考据 ---------------- */
  {
    id: 'q06',
    text: '比起单纯追番，我更愿意花时间研究一部动画背后的设定和制作细节。',
    dimension: 'research',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q07',
    text: '看到一个说不通的剧情细节，我会去查原作、访谈或资料，直到弄明白为止。',
    dimension: 'research',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q08',
    text: '只要剧情好看、看着爽，我一般不太会在意设定是否严密。',
    dimension: 'research',
    weight: 1,
    reverse: true,
  },
  {
    id: 'q09',
    text: '聊到喜欢的作品时，我能说出一堆别人没注意到的伏笔或前后呼应。',
    dimension: 'research',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q10',
    text: '整理资料、考据来龙去脉对我来说很枯燥，我更愿意直接聊感受。',
    dimension: 'research',
    weight: 1,
    reverse: true,
  },

  /* ---------------- 情绪共鸣 ---------------- */
  {
    id: 'q11',
    text: '一首合适的配乐或者一个安静的镜头，经常能让我突然被戳中。',
    dimension: 'empathy',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q12',
    text: '看到喜欢的角色遭遇挫折，我会难受很久，甚至会替他想如果换一种选择会怎样。',
    dimension: 'empathy',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q13',
    text: '遇到让人激动的剧情，我会很想立刻找人分享，哪怕没人回应也会发出去。',
    dimension: 'empathy',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q14',
    text: '我评价一部作品时更看重信息量和结构，情绪上的打动对我影响不大。',
    dimension: 'empathy',
    weight: 1,
    reverse: true,
  },
  {
    id: 'q15',
    text: '我很少因为虚构角色的经历产生明显的情绪波动。',
    dimension: 'empathy',
    weight: 1,
    reverse: true,
  },

  /* ---------------- 观点表达 ---------------- */
  {
    id: 'q16',
    text: '对一部有争议的动画，我更愿意独立形成自己的评价，而不是跟着主流说法走。',
    dimension: 'opinion',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q17',
    text: '看完一部作品后，我总能在心里给它排出个高低，并说清理由。',
    dimension: 'opinion',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q18',
    text: '聊到作品时，我更倾向于描述它的内容，而不是给出好坏判断。',
    dimension: 'opinion',
    weight: 1,
    reverse: true,
  },
  {
    id: 'q19',
    text: '如果我的看法和大多数人不一样，我会照样把它讲出来。',
    dimension: 'opinion',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q20',
    text: '公开评价一部作品时，我更愿意模糊一点，免得引起争论。',
    dimension: 'opinion',
    weight: 1,
    reverse: true,
  },

  /* ---------------- 叙事创作 ---------------- */
  {
    id: 'q21',
    text: '我很在意一件事怎么讲出来，会反复调整讲述的顺序和节奏。',
    dimension: 'narrative',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q22',
    text: '如果有机会，我很想学剪辑，把喜欢的动画片段重新剪成一个故事。',
    dimension: 'narrative',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q23',
    text: '我会留意别人视频里的转场、字幕节奏和分镜设计，并想着自己怎么用。',
    dimension: 'narrative',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q24',
    text: '表达想法时，我更喜欢直来直去地把结论说出来，讲故事属于绕远路。',
    dimension: 'narrative',
    weight: 1,
    reverse: true,
  },
  {
    id: 'q25',
    text: '我常常在脑子里构想一个视频的开头和结尾，即使没打算真的做出来。',
    dimension: 'narrative',
    weight: 1,
    reverse: false,
  },

  /* ---------------- 社群互动 ---------------- */
  {
    id: 'q26',
    text: '看完一集新番，我很想找人立刻讨论，哪怕只是在群里刷两句。',
    dimension: 'community',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q27',
    text: '发现一部冷门好番，我第一反应是赶紧推荐给别人。',
    dimension: 'community',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q28',
    text: '我很在意评论区的气氛，看到有意思的评论会忍不住接下去聊。',
    dimension: 'community',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q29',
    text: '我更享受一个人安静地补番，看完也不想和谁讨论。',
    dimension: 'community',
    weight: 1,
    reverse: true,
  },
  {
    id: 'q30',
    text: '我会主动记住经常互动的同好，也愿意在一个圈子里长期待着。',
    dimension: 'community',
    weight: 1,
    reverse: false,
  },

  /* ---------------- 实验创新 ---------------- */
  {
    id: 'q31',
    text: '我对冷门、画风奇怪或者结构很反常的作品特别有兴趣。',
    dimension: 'experiment',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q32',
    text: '如果一种内容和别人做得差不多，我宁愿换个没人试过的方向。',
    dimension: 'experiment',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q33',
    text: '我不太想聊还没被验证过、风评不明的作品。',
    dimension: 'experiment',
    weight: 1,
    reverse: true,
  },
  {
    id: 'q34',
    text: '我愿意为了一个有趣的尝试接受作品不够成熟这件事。',
    dimension: 'experiment',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q35',
    text: '与其纠结作品哪里不好，我更愿意先想它有没有做到什么新的东西。',
    dimension: 'experiment',
    weight: 1,
    reverse: false,
  },

  /* ---------------- 审美表达 ---------------- */
  {
    id: 'q36',
    text: '看动画时，我会特别注意到作画、分镜或色彩上的变化。',
    dimension: 'aesthetic',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q37',
    text: '我愿意专门去了解一部动画的制作团队，以及他们过去的作品风格。',
    dimension: 'aesthetic',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q38',
    text: '如果画面粗糙但故事精彩，我通常会直接忽略画面的问题。',
    dimension: 'aesthetic',
    weight: 1,
    reverse: true,
  },
  {
    id: 'q39',
    text: '在讨论一部动画时，我会主动聊到配乐、演出这一类视听层面的东西。',
    dimension: 'aesthetic',
    weight: 1,
    reverse: false,
  },
  {
    id: 'q40',
    text: '我对"好看"的直觉很明确，能说出自己喜欢哪种画面风格。',
    dimension: 'aesthetic',
    weight: 1,
    reverse: false,
  },
];

/** 题目总数（首页展示"40 道题目"时使用真实数量） */
export const QUESTION_COUNT = QUESTIONS.length;

/** 题号映射：id → 序号（从 1 开始） */
export const QUESTION_INDEX: Record<string, number> = QUESTIONS.reduce(
  (acc, q, i) => {
    acc[q.id] = i + 1;
    return acc;
  },
  {} as Record<string, number>,
);
