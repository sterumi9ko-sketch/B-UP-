import type { UpProfile } from '@core/types';

/**
 * UP 主风格档案（第 3 组：整活杂谈、社团成员与学术向）
 * ---------------------------------------------------------------------------
 * 核实方式与评分标准同 group1.ts，详见 docs/SCORING.md。
 *
 * 其中「H萌团队」是社团/团队账号而非个人创作者，因此 matchable 设为 false：
 * 它会出现在图鉴里作为背景资料，但不参与"你是哪位 UP 主"的匹配，
 * 避免把一个团队账号当成某个人的风格结果。
 */
export const UPS_GROUP_3: UpProfile[] = [
  {
    id: 'up_013',
    uid: 677139412,
    name: '咕噜一口小三胖',
    category: '动画杂谈与评论',
    tags: ['国创杂谈', '童年动画', '观后感想', '轻松口播'],
    summary: '陪你把童年动画和国产动画重新看一遍的人，聊的是回忆也是最直接的观感。',
    intro:
      '咕噜一口小三胖 的内容以国产动画与童年动画的观后杂谈为主，常从"小时候看"的记忆出发和当下重看的感受做对照。表达轻松口语化，情绪与共鸣是主要内容，考据与数据不是重点。',
    contentFocus: '国产/童年动画观后杂谈',
    observedStyle: [
      '选题集中在国产动画与童年记忆中的作品',
      '以个人观感与回忆串联内容',
      '口播风格轻松，常与观众互相接话',
    ],
    scores: {
      humor: 76,
      research: 52,
      empathy: 80,
      opinion: 70,
      narrative: 64,
      community: 78,
      experiment: 54,
      aesthetic: 50,
    },
    scoreRationale:
      '情绪共鸣：内容主线是回忆与观感带来的情绪体验（A）。社群互动：口播中频繁承接观众话题（A）。幽默整活：调侃语气稳定（A）。深度考据：以观感为主（C）。审美表达：很少讨论作画演出（C）。',
    sources: [
      { label: 'B站空间主页', url: 'https://space.bilibili.com/677139412' },
      { label: 'B站公开用户搜索接口', url: 'https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=咕噜一口小三胖' },
    ],
    verification: 'verified',
    fansSnapshot: 402958,
    verifiedAt: '2025-01',
    matchable: true,
  },
  {
    id: 'up_014',
    uid: 216025,
    name: '尕丶天堂',
    category: '动画杂谈与评论',
    tags: ['元老创作者', '动画杂谈', '老牌口播', '社团核心'],
    summary: '动画区最早的一批创作者之一，聊天式杂谈的底子，节奏还是老派的稳。',
    intro:
      '尕丶天堂 是动画区较早的创作者，也是「H萌」社团的联合创始人之一，长期做动画杂谈类内容。内容以口播杂谈为主，围绕动画话题展开讨论，风格偏老派的聊天式表达。',
    contentFocus: '动画杂谈与口播评论',
    observedStyle: [
      '以口播杂谈为主要形式',
      '话题围绕动画作品与动画圈现象',
      '表达自然口语化，节奏偏稳',
    ],
    scores: {
      humor: 70,
      research: 62,
      empathy: 64,
      opinion: 74,
      narrative: 60,
      community: 80,
      experiment: 56,
      aesthetic: 52,
    },
    scoreRationale:
      '社群互动：长期经营观众关系，互动是内容的一部分（A）。观点表达：杂谈中给出明确看法（A）。幽默整活：聊天中常有笑点（B）。审美表达：较少专门讨论视听层面（C）。',
    sources: [
      { label: 'B站空间主页', url: 'https://space.bilibili.com/216025' },
      { label: '萌娘百科 H萌 条目（社团成员）', url: 'https://mzh.moegirl.org.cn/H%E8%90%8C' },
    ],
    verification: 'verified',
    fansSnapshot: 1646994,
    verifiedAt: '2025-01',
    matchable: true,
  },
  {
    id: 'up_015',
    uid: 1816219,
    name: '噩梦D',
    category: '剧情与世界观考据',
    tags: ['世界观解析', '设定考据', '长视频', '资料整理'],
    summary: '愿意为了讲清一个设定做长篇梳理的人，资料和结构都很扎实。',
    intro:
      '噩梦D 是动画区较早的解析类创作者，被公开资料列为「H萌」知名 UP 主之一。内容以动画世界观、设定与剧情的解析整理为主，篇幅偏长，重视资料与结构。',
    contentFocus: '动画世界观与设定解析',
    observedStyle: [
      '以长篇解析为主要形态',
      '内容围绕设定、世界观与剧情逻辑展开',
      '表达偏理性，结构意识强',
    ],
    scores: {
      humor: 44,
      research: 92,
      empathy: 50,
      opinion: 74,
      narrative: 82,
      community: 62,
      experiment: 60,
      aesthetic: 66,
    },
    scoreRationale:
      '深度考据：解析类内容的立身之本（S）。叙事创作：长篇内容需要结构设计（A）。观点表达：解析中给出判断（A）。幽默整活：整体偏严肃（C）。说明：该账号近期投稿列表未成功抓取，评分主要基于公开的既有作品类型描述。',
    sources: [
      { label: 'B站空间主页', url: 'https://space.bilibili.com/1816219' },
      { label: '萌娘百科 H萌 条目（社团成员）', url: 'https://mzh.moegirl.org.cn/H%E8%90%8C' },
    ],
    verification: 'partial',
    fansSnapshot: 1017010,
    verifiedAt: '2025-01',
    matchable: true,
  },
  {
    id: 'up_016',
    uid: 97471052,
    name: '动画学术趴',
    category: '动漫文化科普',
    tags: ['学术向', '产业观察', '动画研究', '机构号'],
    summary: '把动画当成研究对象的人，谈的是产业、创作方法与学术视角。',
    intro:
      '动画学术趴 是以动画研究与产业观察为主的机构账号，内容涉及动画创作方法、产业现象与学术讨论，表达克制、信息密度高，是动画区偏研究取向的内容生产者。',
    contentFocus: '动画研究与产业观察 / 创作方法讨论',
    observedStyle: [
      '选题偏研究性与产业视角',
      '表达克制，重视论述与资料来源',
      '很少使用娱乐化的标题手法',
    ],
    scores: {
      humor: 22,
      research: 93,
      empathy: 40,
      opinion: 78,
      narrative: 66,
      community: 48,
      experiment: 82,
      aesthetic: 78,
    },
    scoreRationale:
      '深度考据：研究与产业观察是核心（S）。实验创新：选题常涉及非主流与前沿话题（A）。审美表达：讨论创作方法与表现手法（A）。幽默整活：学术化表达，几乎无笑点（D）。社群互动：互动相对克制（C）。',
    sources: [
      { label: 'B站空间主页', url: 'https://space.bilibili.com/97471052' },
      { label: 'B站公开投稿列表接口（最近 20 条标题）', url: 'https://api.bilibili.com/x/space/wbi/arc/search?mid=97471052' },
    ],
    verification: 'verified',
    fansSnapshot: 774409,
    verifiedAt: '2025-01',
    matchable: true,
  },
  {
    id: 'up_017',
    uid: 18030567,
    name: 'H萌团队',
    category: '二次元综合文化',
    tags: ['社团账号', 'ACG节目', '拜年纪', '综合企划'],
    summary: '一个社团的账号，做的是每年春节的二次元节目和 ACG 杂谈企划，不代表某个人。',
    intro:
      '「H萌团队」是「H萌」社团成员参与运营的团队账号，主要产出 ACG 杂谈节目与每年春节的「H萌拜年纪」系列企划，涵盖动画盘点、翻唱、宅舞等环节。由于它是团队账号而非个人创作者，本站不把它作为个人匹配结果，仅在图鉴中作为背景资料展示。',
    contentFocus: 'ACG 综合节目 / H萌拜年纪等年度企划',
    observedStyle: [
      '以年度企划与多人合作节目为主要产出',
      '内容形态综合，涵盖盘点、翻唱、整活等多个环节',
      '账号由社团成员共同运营',
    ],
    scores: {
      humor: 72,
      research: 52,
      empathy: 68,
      opinion: 56,
      narrative: 74,
      community: 88,
      experiment: 70,
      aesthetic: 72,
    },
    scoreRationale:
      '社群互动：企划本质是社团与观众的年度互动（S）。叙事创作：年度节目需要整体编排（A）。幽默整活：节目包含大量整活环节（B）。深度考据：以娱乐节目为主（C）。',
    sources: [
      { label: 'B站空间主页', url: 'https://space.bilibili.com/18030567' },
      { label: 'B站公开投稿列表接口（最近 20 条标题）', url: 'https://api.bilibili.com/x/space/wbi/arc/search?mid=18030567' },
      { label: '萌娘百科 H萌 条目', url: 'https://mzh.moegirl.org.cn/H%E8%90%8C' },
      { label: '百度百科 H萌团队 条目（公开资料）', url: 'https://baike.baidu.com/item/H%E8%90%8C%E5%9B%A2%E9%98%9F' },
    ],
    verification: 'verified',
    fansSnapshot: 564754,
    verifiedAt: '2025-01',
    matchable: false,
  },
];
