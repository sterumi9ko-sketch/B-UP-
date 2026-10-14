import { siteConfig } from '@config';
import { DIMENSIONS } from '@core/dimensions';
import { QUESTIONS } from '@data/questions';
import { UPS } from '@data/ups';
import { create } from '@ui/dom';
import type { PageRenderer } from '@ui/page-types';

/**
 * 关于测试
 * ---------------------------------------------------------------------------
 * 这个页面的职责是把"边界"讲清楚：
 *   - 这是娱乐向的创作风格匹配，不是心理测量学量表
 *   - 题目怎么设计的、维度是什么意思、相似指数怎么算的
 *   - 资料来源与核实方式
 *   - 明确声明：结果不代表 UP 主真实人格，也不是 B 站官方产品
 *   - 预留反馈渠道与更新日志的位置
 */
export const renderAbout: PageRenderer = () => {
  const container = create('div', { class: 'container reading', style: 'margin: 0 auto;' });
  const matchable = UPS.filter((up) => up.matchable);
  const reverseCount = QUESTIONS.filter((q) => q.reverse).length;

  container.append(
    create('header', {}, [
      create('h1', { text: '关于这个测试' }),
      create('p', { class: 'text-soft', text: '先把话说在前面：这是一个娱乐性质的创作风格匹配测试，不是人格诊断工具。' }),
    ]),
  );

  container.append(
    aboutSection('一、这是什么', [
      create('p', {
        text: `《${siteConfig.name}》用 ${QUESTIONS.length} 道题，把你对"怎么看动画、怎么表达、怎么和同好相处"的倾向，量化成 ${DIMENSIONS.length} 个创作风格维度，再和 ${matchable.length} 位动画区 UP 主的公开创作特征做比较，找出风格最接近的几位。`,
      }),
      create('div', { class: 'notice notice--accent' }, [
        create('strong', { text: '重要说明：' }),
        create('span', {
          text: ' 我们比较的是"公开作品呈现出来的创作方式"，不是 UP 主真实的心理人格。测试结果不代表任何 UP 主本人的性格、诊断或认可，也不构成对任何人的评价。',
        }),
      ]),
      create('p', {
        class: 'text-muted',
        text: '本站不是哔哩哔哩官方产品，与哔哩哔哩及任何 UP 主没有隶属、合作或授权关系。',
      }),
    ]),
  );

  container.append(
    aboutSection('二、题目是怎么设计的', [
      create('p', {
        text: `题目不是照搬 MBTI，而是围绕动画区创作者的公开行为设计的。${QUESTIONS.length} 道题平均分布在 ${DIMENSIONS.length} 个维度上（每个维度 ${QUESTIONS.length / DIMENSIONS.length} 题），其中 ${reverseCount} 道是反向题。`,
      }),
      create('ul', {}, [
        create('li', { text: '题干不出现具体作品名，不需要看过某部动画才能作答。' }),
        create('li', { text: '反向题不是正向题的简单否定，而是从另一个行为侧面描述同一维度，避免"两题其实是一题"。' }),
        create('li', { text: '每题只测一个主维度，不重复计分；所有题目等权，因此每个维度的满分结构完全一致。' }),
        create('li', { text: '题干不暗示"哪种更好"，每条描述都对应一种真实存在的观看或创作习惯。' }),
      ]),
    ]),
  );

  container.append(
    aboutSection('三、8 个维度分别是什么', [
      create('p', { class: 'text-muted', text: '每个维度都有明确的高分行为与低分行为，且都能从公开投稿内容里观察到。' }),
      create('dl', { class: 'definition-list' },
        DIMENSIONS.flatMap((dimension) => [
          create('dt', { text: dimension.name }),
          create('dd', { text: dimension.definition }),
          create('dd', { class: 'text-muted', text: `高分：${dimension.highMeans}` }),
          create('dd', { class: 'text-muted', text: `低分：${dimension.lowMeans}` }),
        ]),
      ),
    ]),
  );

  container.append(
    aboutSection('四、相似指数是怎么算的', [
      create('ol', {}, [
        create('li', { text: `计分：7 档选项分别记 +3、+2、+1、0、-1、-2、-3 分，反向题取反，再按题目权重累加到对应维度。` }),
        create('li', { text: '标准化：用该维度理论上可达的最低分与最高分做线性映射。所以 50 分永远代表"这个维度上比较中性"，100 分代表"这个维度最强"。' }),
        create('li', { text: '维度权重：某维度的权重等于你在该维度上已作答题目的权重之和，题目更多的维度对匹配结果影响更大。' }),
        create('li', { text: `距离：计算加权欧氏距离 distance = √( Σ 权重 × (你的分数 − UP主分数)² )。` }),
        create('li', { text: `换算：风格相似指数 = (1 − distance / ${siteConfig.match.maxDistance}) × 100，并夹在 ${siteConfig.match.minSimilarity}–100 之间。` }),
        create('li', { text: '排序：按相似指数从高到低；分数相同时依次比较距离与 UID，保证同样的答案永远得到同样的排名。' }),
      ]),
      create('div', { class: 'notice' }, [
        create('strong', { text: '为什么叫"风格相似指数"而不是"匹配准确率"：' }),
        create('span', {
          text: ' 这个数字衡量的是"你的画像和某位 UP 主的画像有多接近"，是一个相对刻度。它没有经过心理测量学验证，不表示概率，也不表示准确率。',
        }),
      ]),
    ]),
  );

  container.append(
    aboutSection('五、UP 主资料从哪里来', [
      create('ul', {}, [
        create('li', { text: '昵称、UID、签名、认证信息、粉丝数：来自 B 站公开的用户搜索与空间公开接口。' }),
        create('li', { text: '创作方向与表达特征：来自公开投稿的标题、简介、标签与分区，以及公开的系列节目名称。' }),
        create('li', { text: '每个档案在结果页与图鉴里都标注了资料来源链接与核实时间，可以逐个复核。' }),
        create('li', { text: '维度评分依据统一标准给出，标准见项目内 docs/SCORING.md：每个维度都按 S/A/B/C/D 分档，并说明为什么高、为什么低。' }),
        create('li', { text: '本站不下载、不转载 UP 主的头像、封面或视频内容。头像位置默认使用站内文字占位图，由使用者自行准备获得授权的图片。' }),
      ]),
      create('h3', { style: 'margin-top: var(--space-5); font-size: var(--text-base);', text: '核实状态的含义' }),
      create('ul', {}, [
        create('li', { text: '资料已核实：昵称、UID 与公开投稿内容都经过接口核对。' }),
        create('li', { text: '部分待补充：昵称与 UID 已核实，个别字段仍在补全。' }),
        create('li', { text: '待核实：占位数据。只要名单里存在待核实且参与匹配的条目，结果页顶部会显示醒目提示。' }),
      ]),
    ]),
  );

  container.append(
    aboutSection('六、你的数据', [
      create('ul', {}, [
        create('li', { text: '答题记录、答题进度和最近一次结果只保存在你自己浏览器的 localStorage 里。' }),
        create('li', { text: '本站没有后端服务器，不会上传、不会收集、也不会分析你的答案。' }),
        create('li', { text: '清空浏览器数据或点击"重新测试"即可删除全部本地记录。' }),
        create('li', { text: '分享图是在你的浏览器里用 Canvas 生成的，只有你主动保存或发送时才会离开本机。' }),
      ]),
    ]),
  );

  container.append(
    aboutSection('七、反馈与更新', [
      create('p', {
        class: 'text-soft',
        text: siteConfig.contact.feedbackUrl
          ? '如果发现资料错误、评分不合理或者有想补充的 UP 主，欢迎通过下面的渠道反馈。'
          : '反馈渠道与联系方式待补充：请在 src/config.ts 的 contact.feedbackUrl 里填入你的反馈链接（例如问卷、邮箱或 GitHub Issues 地址）。',
      }),
      siteConfig.contact.feedbackUrl
        ? create('a', { class: 'btn', href: siteConfig.contact.feedbackUrl, target: '_blank', rel: 'noopener noreferrer', text: '前往反馈渠道 ↗' })
        : create('div', { class: 'notice' }, [
            create('strong', { text: '待办：' }),
            create('span', { text: ' 联系方式 / 反馈渠道 / 更新日志位置已预留，编辑 src/config.ts 即可显示。' }),
          ]),
      create('h3', { style: 'margin-top: var(--space-5); font-size: var(--text-base);', text: '更新日志' }),
      create('ul', {}, siteConfig.contact.changelog.map((entry) => create('li', { text: `${entry.date}：${entry.text}` }))),
    ]),
  );

  container.append(
    aboutSection('八、完整免责声明', [
      create('p', { class: 'text-soft', text: siteConfig.disclaimer }),
      create('p', {
        class: 'text-muted',
        text: '如果你是把结果当作娱乐分享，欢迎随意分享；如果要把结果当作对某位创作者的评价依据，请不要这样做。',
      }),
    ]),
  );

  return { element: container };
};

function aboutSection(title: string, children: HTMLElement[]): HTMLElement {
  return create('section', { class: 'about-section' }, [create('h2', { class: 'section__title', text: title }), ...children]);
}
