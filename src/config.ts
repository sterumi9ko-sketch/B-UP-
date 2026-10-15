/**
 * 站点配置
 * ---------------------------------------------------------------------------
 * 所有"可调参数"集中在这里，改这个文件就能调整网站行为，不需要动核心算法。
 */

export const siteConfig = {
  /** 网站名称（显示在导航栏、分享图、页面标题） */
  name: '测测你是B站动画区的哪位UP主',
  /** 简短名称（移动端导航、分享图角标） */
  shortName: '动画区UP主匹配',
  /** 一句话介绍 */
  tagline: '如果你也是一位动画区UP主，你会属于哪种创作风格？',
  /** 网站描述（用于 meta description 与分享文案） */
  description:
    '回答 40 道关于性格倾向、兴趣偏好与表达习惯的题目，用 8 个创作风格维度，匹配出与你风格最接近的 B 站动画区 UP 主。',

  /** 作者信息与开源地址（关于页展示，也写进页脚） */
  author: {
    /** GitHub 用户名 */
    name: 'sterumi9ko-sketch',
    /** 作者主页 */
    profileUrl: 'https://github.com/sterumi9ko-sketch',
    /** 本项目的仓库地址 */
    repoUrl: 'https://github.com/sterumi9ko-sketch/B-UP-',
    /** 参考项目（8 维人格匹配的思路来源） */
    inspiredBy: {
      label: 'ShinyColors Personality Quiz',
      url: 'https://github.com/Sallyn0225/shiny-mbti',
      site: 'https://283ti.genchi.top/',
    },
    /** 设计语言参考 */
    designReference: {
      label: 'awesome-design-md（Claude 设计系统）',
      url: 'https://github.com/VoltAgent/awesome-design-md',
    },
  },

  /** 测试相关参数 */
  test: {
    /** 每道题的选项分值：完全认同 +3 → 完全不认同 -3 */
    scale: [3, 2, 1, 0, -1, -2, -3] as const,
    /** 是否允许未答完就查看结果（false = 必须答完全部题目） */
    allowPartialSubmit: false,
    /** 预计答题时间（分钟），用于首页展示 */
    estimatedMinutes: 6,
  },

  /**
   * 相似指数换算参数。
   * distanceToSimilarity = (1 - distance / maxDistance) * 100，并夹到 [minSimilarity, 100]。
   *
   * 这两个数值是用真实数据校准出来的，不是拍脑袋定的：
   * 运行 `node scripts/calibrate.mjs` 可以复现下面的统计结果。
   *
   * 实测（17 位 UP 主 × 7 种极端作答 + 200 次随机作答）：
   *   - 用户 → UP 主 的距离分布：p10 ≈ 54，p50 ≈ 75，p90 ≈ 98，最大 ≈ 140
   *   - 每个用户样本「最接近的 UP 主」距离：最小 ≈ 21，中位 ≈ 56，最大 ≈ 94
   *
   * 因此取 maxDistance = 145：
   *   - 距离 21（非常接近）→ 约 86 分
   *   - 距离 56（中位水平）→ 约 61 分
   *   - 距离 94（较不像）  → 约 35 分
   * 分数自然落在 30~90 之间，既有区分度，也不会大量并列在下限。
   *
   * 如果以后大幅增删题目或改写 UP 主画像，请重新运行校准脚本再调整这两个值。
   */
  match: {
    maxDistance: 145,
    minSimilarity: 30,
  },

  /**
   * 置信度阈值。置信度 = 完成度 × 0.6 + 作答明确度 × 0.4。
   * 作答明确度 = 选择了"非常/完全认同或反对"（±2、±3）的题目占比。
   */
  confidence: {
    high: 0.75,
    medium: 0.5,
  },

  /** 免责声明（结果页与分享图都会使用，请勿删除） */
  disclaimer:
    '本测试为娱乐性质的创作风格匹配，结果由公开创作内容与你填写答案计算得出，不代表任何 UP 主的真实人格、心理诊断或本人认可。本站非哔哩哔哩官方产品。',

  /**
   * 正式域名。用于分享图底部的网址与分享文案。
   * 已部署到 Cloudflare Pages，地址如下；换域名时改这里即可。
   */
  siteUrl: 'https://b-up.pages.dev',

  /** 反馈与更新日志（关于页展示） */
  contact: {
    feedbackUrl: '',
    changelog: [
      { date: '2025-01', text: '首个版本：40 道题目、8 个风格维度、UP 主匹配、图鉴与分享图。' },
      { date: '2025-01', text: '部署到 Cloudflare Pages（b-up.pages.dev）。' },
    ],
  },
} as const;
