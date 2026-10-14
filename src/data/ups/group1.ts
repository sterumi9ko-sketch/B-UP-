import type { UpProfile } from '@core/types';

/**
 * UP 主风格档案（第 1 组：粉丝量较高的动画区创作者）
 * ---------------------------------------------------------------------------
 * 资料核实方式（详见 docs/SCORING.md）：
 *   - 昵称、UID、认证信息、粉丝数快照：B 站公开用户搜索 / 空间公开接口
 *   - 创作方向与表达特征：公开投稿的标题、简介、标签与系列节目名称
 *   - 8 个维度分数：按 docs/SCORING.md 的分档标准，由公开内容推导
 *
 * 注意：分数描述的是"公开作品呈现出来的创作方式"，不是对 UP 主本人性格的判断。
 * 修改分数时请对照 docs/SCORING.md 的分档表，并在 scoreRationale 里说明依据。
 */
export const UPS_GROUP_1: UpProfile[] = [
  {
    id: 'up_001',
    uid: 63231,
    name: '泛式',
    category: '推荐与资讯',
    tags: ['新番导视', '吐槽整活', '节奏轻快', '二次元玩梗'],
    summary: '把新番导视做成综艺感节目的人，笑点和信息量一起塞满，看完还想再看一遍。',
    intro:
      '泛式的作品以新番导视、完结盘点与二次元互动类节目为主，节奏快、信息密度高，善于用夸张的比喻和自嘲式的幽默把一整季的新番讲完。他经常与同区创作者联动做猜番、知识竞赛一类的节目，把"看番"这件事变成一群人一起玩的游戏。',
    contentFocus: '新番导视 / 完结吐槽 / 二次元知识竞赛与整活节目',
    observedStyle: [
      '新番导视系列按时令稳定更新，逐部点评并给出个人推荐倾向',
      '标题大量使用夸张修辞与网感句式制造笑点',
      '与同区 UP 主联动频繁，节目形态偏综艺',
    ],
    scores: {
      humor: 96,
      research: 54,
      empathy: 70,
      opinion: 88,
      narrative: 84,
      community: 92,
      experiment: 68,
      aesthetic: 60,
    },
    scoreRationale:
      '幽默整活：标题与节奏几乎全部围绕笑点设计，属于标志性特征（S）。观点表达：导视与盘点都给出明确的推荐判断与理由（S）。社群互动：联动节目与观众互动密集（S）。深度考据：会介绍制作背景，但主体是观感与推荐，未形成系统性考据（C）。审美表达：偶尔提到作画与演出，不是重点（B）。',
    sources: [
      { label: 'B站空间主页', url: 'https://space.bilibili.com/63231' },
      { label: 'B站公开用户搜索接口', url: 'https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=泛式' },
    ],
    verification: 'verified',
    fansSnapshot: 6735670,
    verifiedAt: '2025-01',
    matchable: true,
  },
  {
    id: 'up_002',
    uid: 730732,
    name: '瓶子君152',
    category: '动画杂谈与评论',
    tags: ['逐集评分', '吐槽犀利', '追番札记', '整活'],
    summary: '把每一集都当评论区来聊的人，评分、吐槽、知识科普三件事同时干，情绪也很足。',
    intro:
      '瓶子君152 以逐集/逐季的评分吐槽为主力内容，一边追番一边给出评分与判断，语气直接、敢于下结论。他也做动漫知识竞赛、人物设定科普一类的节目，整体风格是"朋友之间聊番"的密集输出，情绪表达相当充沛。',
    contentFocus: '动画逐集评分与吐槽 / 动漫知识科普 / 二次元整活',
    observedStyle: [
      '标题普遍带评分数字，形成稳定的评价体例',
      '同一部作品会做开播、中期、完结等多轮跟进',
      '常与同区创作者联动做知识竞赛类节目',
    ],
    scores: {
      humor: 93,
      research: 66,
      empathy: 82,
      opinion: 94,
      narrative: 78,
      community: 88,
      experiment: 60,
      aesthetic: 58,
    },
    scoreRationale:
      '观点表达：几乎所有内容都围绕"给分与判断"展开（S）。幽默整活：吐槽密集，笑点是主要看点之一（S）。情绪共鸣：追番过程中的情绪反应经常直接出现在内容里（A）。深度考据：会讲设定与知识，但以聊番节奏为主（B）。实验创新：选题集中在当期热度作品（C）。',
    sources: [
      { label: 'B站空间主页', url: 'https://space.bilibili.com/730732' },
      { label: 'B站公开用户搜索接口', url: 'https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=瓶子君152' },
    ],
    verification: 'verified',
    fansSnapshot: 4334043,
    verifiedAt: '2025-01',
    matchable: true,
  },
  {
    id: 'up_003',
    uid: 14110780,
    name: '凉风Kaze',
    category: '动画杂谈与评论',
    tags: ['早期吐槽', '搞笑玩梗', '综艺感', '转型访谈'],
    summary: '曾经把动画吐槽做成综艺的人，现在更多在镜头前和人聊天，但节奏感一直在。',
    intro:
      '凉风Kaze 早期以动画吐槽与搞笑玩梗内容积累了大量观众，擅长用夸张的表演和剪辑制造笑点。近期主力内容转向人物访谈与生存现状一类的节目，动画相关投稿的占比明显下降，因此在本站的维度评分中幽默与叙事分较高、考据分偏低。',
    contentFocus: '早期动画吐槽与搞笑内容 / 现以人物访谈类节目为主',
    observedStyle: [
      '早期投稿以动画吐槽与玩梗为主，剪辑节奏偏综艺',
      '近期投稿以访谈类内容为主，动画占比下降',
      '表达方式偏表演型，重视镜头呈现',
    ],
    scores: {
      humor: 92,
      research: 38,
      empathy: 72,
      opinion: 62,
      narrative: 88,
      community: 86,
      experiment: 62,
      aesthetic: 54,
    },
    scoreRationale:
      '幽默整活：早期吐槽内容笑点密集（S）。叙事创作：剪辑与节目结构设计意识很强（S）。深度考据：几乎不做资料考证（D）。观点表达：以娱乐呈现为主，评价并非内容核心（B）。说明：因近期动画相关投稿占比下降，该档案的综合代表性弱于前两位。',
    sources: [
      { label: 'B站空间主页', url: 'https://space.bilibili.com/14110780' },
      { label: 'B站公开用户搜索接口', url: 'https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=凉风Kaze' },
    ],
    verification: 'partial',
    fansSnapshot: 6922641,
    verifiedAt: '2025-01',
    matchable: true,
  },
  {
    id: 'up_004',
    uid: 14068111,
    name: '黝黑蜗壳天眼老师',
    category: '剧情与世界观考据',
    tags: ['长篇情报', '主线梳理', '圣地巡礼', '二次元探店'],
    summary: '把长篇连载的主线情报整理成一张网的人，顺手还能带你去看作品里的真实取景地。',
    intro:
      '黝黑蜗壳天眼老师 主要做长篇动画/漫画的主线情报整理与剧情梳理，覆盖长期连载作品的最新进展与人物关系。他同时做二次元圣地巡礼类内容，把作品场景与现实地点对应起来，形成"资料 + 现场"的组合。',
    contentFocus: '长篇连载作品的主线情报与剧情梳理 / 二次元圣地巡礼',
    observedStyle: [
      '标题多为"主线情报""一口气看完"式的资料整理',
      '按集数/话数系统性推进长篇作品的时间线',
      '拍摄真实取景地的巡礼内容，与作品内容互相印证',
    ],
    scores: {
      humor: 74,
      research: 90,
      empathy: 62,
      opinion: 66,
      narrative: 76,
      community: 72,
      experiment: 52,
      aesthetic: 56,
    },
    scoreRationale:
      '深度考据：内容主体就是情报整理与时间线梳理（S）。幽默整活：标题与叙述带有稳定的调侃语气（A）。叙事创作：长篇内容有明确的推进结构（A）。实验创新：选题集中在已知热门长篇作品（C）。审美表达：较少讨论作画与演出（C）。',
    sources: [
      { label: 'B站空间主页', url: 'https://space.bilibili.com/14068111' },
      { label: 'B站公开用户搜索接口', url: 'https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=黝黑蜗壳天眼老师' },
    ],
    verification: 'verified',
    fansSnapshot: 1372744,
    verifiedAt: '2025-01',
    matchable: true,
  },
  {
    id: 'up_005',
    uid: 7946432,
    name: '利维坦mY',
    category: '剧情与世界观考据',
    tags: ['逐帧解析', '设定考证', '国创观察', '高信息密度'],
    summary: '一帧一帧把作品拆开看的人，考据强度很高，画面与演出的细节也逃不过去。',
    intro:
      '利维坦mY 以逐帧/逐集解析为主要形态，对国创动画与部分海外作品的设定、伏笔与制作细节做密集拆解，单期信息量很大。他也涉及游戏与动画 PV 的解析，选题跨越动画与游戏两个相邻领域。',
    contentFocus: '动画逐帧/逐集解析 / 设定与伏笔考据 / 游戏与动画 PV 解析',
    observedStyle: [
      '标题常以"逐帧解析""信息量爆炸"为标志',
      '单期内容按镜头与台词逐段拆解，引用大量细节',
      '选题横跨动画与游戏领域',
    ],
    scores: {
      humor: 52,
      research: 94,
      empathy: 44,
      opinion: 70,
      narrative: 80,
      community: 66,
      experiment: 56,
      aesthetic: 80,
    },
    scoreRationale:
      '深度考据：内容形态本身就是逐帧拆解（S）。审美表达：大量讨论作画、演出与镜头设计（A）。叙事创作：解析类内容有清晰的结构编排（A）。情绪共鸣：基本不做情绪表达，以分析为主（C）。幽默整活：语气偏理性（C）。说明：选题除动画外也覆盖游戏与 PV，但动画解析仍是其主力内容。',
    sources: [
      { label: 'B站空间主页', url: 'https://space.bilibili.com/7946432' },
      { label: 'B站公开投稿列表接口（最近 25 条标题）', url: 'https://api.bilibili.com/x/space/wbi/arc/search?mid=7946432' },
    ],
    verification: 'verified',
    fansSnapshot: 1942250,
    verifiedAt: '2025-01',
    matchable: true,
  },
  {
    id: 'up_006',
    uid: 5293668,
    name: '齐天大肾余潇洒',
    category: '动画杂谈与评论',
    tags: ['国创点评', '栏目化', '观点稳定', '老牌创作者'],
    summary: '长期做国创动画点评的老牌创作者，栏目做得很稳，观点一直是重点。',
    intro:
      '齐天大肾余潇洒 以国创（国产动画）点评栏目为主要内容，形成了固定的栏目形态与评价角度，长期围绕国产动画作品展开讨论。其投稿更新节奏在近年明显放缓，但栏目化的评价体系仍然清晰。',
    contentFocus: '国产动画点评与栏目化杂谈',
    observedStyle: [
      '以固定栏目形式点评国创作品',
      '内容偏评价与判断，观点是主要内容',
      '近年更新频率下降',
    ],
    scores: {
      humor: 60,
      research: 76,
      empathy: 58,
      opinion: 86,
      narrative: 62,
      community: 58,
      experiment: 50,
      aesthetic: 58,
    },
    scoreRationale:
      '观点表达：栏目核心就是评价与判断（S）。深度考据：点评建立在作品信息梳理之上（A）。幽默整活：有稳定的调侃语气但不是核心（B）。实验创新：选题集中在国创作品，形式固定（C）。说明：因近年更新较少，代表性下降，标记为 partial。',
    sources: [
      { label: 'B站空间主页', url: 'https://space.bilibili.com/5293668' },
      { label: 'B站公开用户搜索接口', url: 'https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=齐天大肾余潇洒' },
    ],
    verification: 'partial',
    fansSnapshot: 1083039,
    verifiedAt: '2025-01',
    matchable: true,
  },
];
