# 测测你是B站动画区的哪位UP主？

> ## 🌐 线上地址：<https://b-up.pages.dev>
>
> 手机直接打开即可作答。部署在 Cloudflare Pages，推送 `main` 分支会自动重新部署。

一个**纯静态**的趣味测试网站：回答 40 道题，用 8 个创作风格维度算出你的风格画像，
再和 B 站动画区 UP 主的公开创作特征做比较，推荐风格最接近的 3 位。

- 不需要后端服务器，所有计算都在浏览器里完成
- 答题记录只存在你自己的浏览器（localStorage），不上传任何数据
- 构建产物就是一堆静态文件，可以直接丢到 Cloudflare Pages 或 GitHub Pages
- 觉得某位 UP 主的评分不准？打开 [UP 主数据设置](#九up-主数据设置不改代码就能调分) 页就能改

**作者：** [@sterumi9ko-sketch](https://github.com/sterumi9ko-sketch)
**代码仓库：** <https://github.com/sterumi9ko-sketch/B-UP->

> 免责声明：本站是娱乐性质的**创作风格**匹配，不是心理测量学量表。
> 结果由公开创作内容与你的作答计算得出，**不代表任何 UP 主的真实人格、心理诊断或本人认可**。
> 本站不是哔哩哔哩官方产品。

### 设计与思路参考

| 来源 | 借鉴了什么 |
|---|---|
| [ShinyColors Personality Quiz](https://github.com/Sallyn0225/shiny-mbti)（[线上](https://283ti.genchi.top/)） | 产品形态：8 维人格模型 + 欧氏距离匹配 + 角色图鉴 |
| [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | 视觉设计语言（暖色、克制、留白） |

> 仅参考**思路与设计语言**。本项目是独立实现：原生 TypeScript + 自写 CSS，
> **没有**引入 React / Tailwind / recharts，也未复制其源码或素材。

---

## 目录

1. [它长什么样](#一它长什么样)
2. [30 秒跑起来](#二30-秒跑起来)
3. [网站是怎么运作的](#三网站是怎么运作的)
4. [文件夹都是干什么的](#四文件夹都是干什么的)
5. [三套构建产物（按用途选一套）](#五三套构建产物按用途选一套)
6. [怎么改题目](#六怎么改题目)
7. [怎么改 UP 主名单](#七怎么改-up-主名单)
8. [怎么调整 UP 主的维度评分](#八怎么调整-up-主的维度评分)
9. [UP 主数据设置（不改代码就能调分）](#九up-主数据设置不改代码就能调分)
10. [怎么加 UP 主头像](#十怎么加-up-主头像)
11. [怎么测试](#十一怎么测试)
12. [怎么部署到 Cloudflare Pages](#十二怎么部署到-cloudflare-pages)
13. [分数是怎么算出来的](#十三分数是怎么算出来的)
14. [已知问题与注意事项](#十四已知问题与注意事项)

---

## 一、它长什么样

四个页面，用地址栏的 `#` 切换（哈希路由，静态部署不需要任何服务端配置）：

| 页面 | 地址 | 说明 |
|---|---|---|
| 首页 / 测试入口 | `#/` | 介绍、8 个维度、开始按钮 |
| 答题页 | `#/test` | 一次一题，7 级圆点作答，进度自动保存 |
| 结果页 | `#/result` | 最佳匹配、前三名、雷达图、分享图 |
| UP 主图鉴 | `#/gallery` | 全部 UP 主卡片，可筛选/搜索、点开看详情 |
| 关于测试 | `#/about` | 测试原理、维度定义、免责声明 |

---

## 二、30 秒跑起来

需要 **Node.js 18 以上**（推荐 20 或 22）。

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（会自动打开 http://localhost:5173）
npm run dev

# 3. 打包成静态文件（输出到 dist/）
npm run build

# 4. 本地预览打包结果
npm run preview
```

> 如果你用 pnpm：`pnpm install && pnpm dev`，本项目已配好 `pnpm.allowBuilds`，
> 允许 esbuild / rollup 执行安装脚本（它们必须执行，否则无法构建）。

---

## 三、网站是怎么运作的

```text
用户在 #/test 逐题作答
        │
        │  每选一次圆点
        ▼
   写入 state（内存） ──同时写入──▶ localStorage（刷新不丢进度）
        │
        │  40 题全部答完，点「查看我的 UP 主匹配结果」
        ▼
  evaluateTest()  ← src/core/match.ts（整条流程的入口）
        │
        ├─ 1. 逐题取分：完全认同 +3 … 完全不认同 -3，反向题取反       （src/core/scoring.ts）
        ├─ 2. 按维度加权汇总原始分
        ├─ 3. 用该维度可达的最低/最高分线性映射到 0~100
        ├─ 4. 计算维度权重（题目权重和，再归一化到平均 1）
        ├─ 5. 与 17 位 UP 主的画像算加权欧氏距离
        ├─ 6. 距离 → 风格相似指数 0~100
        ├─ 7. 排序（相似指数 ↓，距离 ↑，UID ↑）取前三
        └─ 8. 生成匹配理由与风格标签
        ▼
   结果页渲染 + Canvas 画分享图（src/share/card.ts）
```

**关键设计**：同样的题目 + 同样的答案 + 同样的 UP 主数据，**永远得到同样的结果**。
没有随机数，也没有写死的展示数据。测试里专门有一条用例验证这一点。

---

## 四、文件夹都是干什么的

```text
网站/
├── index.html                 正式页面入口（只有一个 #app 容器）
├── debug.html                 开发期端到端检查页（自动答完题看结果，不参与导航）
├── package.json               依赖与命令
├── vite.config.ts             构建配置（入口、路径别名、输出目录）
├── vitest.config.ts           测试配置
├── aliases.mjs                路径别名定义（Vite 与 Vitest 共用）
├── tsconfig.json              TypeScript 配置
│
├── src/
│   ├── main.ts                应用入口：路由 → 页面 → 挂载
│   ├── config.ts              ★ 站点可调参数（名称、文案、算法系数、免责声明）
│   ├── state.ts               应用状态（答题进度、结果缓存、localStorage 读写）
│   │
│   ├── core/                  纯逻辑层：不碰 DOM，可单独测试
│   │   ├── types.ts           全部类型定义
│   │   ├── dimensions.ts      8 个风格维度的定义
│   │   ├── scale.ts           7 级量表的选项、分值、文案
│   │   ├── scoring.ts         计分、标准化、距离、相似指数
│   │   ├── match.ts           匹配主流程 evaluateTest()
│   │   ├── storage.ts         localStorage 读写与容错
│   │   └── assets.ts          图片路径映射与文字占位头像
│   │
│   ├── data/                  ★ 数据层：改内容基本只改这里
│   │   ├── questions.ts       40 道正式题目（题目 + 维度 + 权重 + 是否反向）
│   │   ├── ups.ts             UP 主名单统一出口、排序与校验
│   │   └── ups/
│   │       ├── group1.ts      第 1 组档案
│   │       ├── group2.ts      第 2 组档案
│   │       └── group3.ts      第 3 组档案
│   │
│   ├── ui/                    通用 UI 组件与工具
│   │   ├── dom.ts             元素创建、转义、toast、复制、弹层
│   │   ├── router.ts          哈希路由
│   │   ├── layout.ts          顶部导航 + 页脚 + 页面挂载
│   │   ├── charts.ts          Canvas 雷达图 + 横向评分条
│   │   ├── page-types.ts      页面模块接口定义
│   │   └── components/
│   │       ├── scale.ts       7 级圆点作答组件
│   │       └── avatar.ts      头像组件（含缺图降级）
│   │
│   ├── pages/                 四个页面
│   │   ├── home.ts            首页
│   │   ├── test.ts            答题页
│   │   ├── result.ts          结果页
│   │   ├── gallery.ts         UP 主图鉴
│   │   └── about.ts           关于测试
│   │
│   ├── share/card.ts          Canvas 分享图 + 分享文案
│   ├── styles/main.css        设计系统（暖色极简，全部 CSS 变量）
│   └── debug-e2e.ts           开发期端到端检查脚本
│
├── tests/                     单元测试（53 条）
│   ├── scoring.test.ts        计分、反向题、标准化、距离
│   ├── match.test.ts          排序、并列、可复现、极端作答、结果解释
│   ├── ups-data.test.ts       数据完整性 + 相似指数标定回归
│   └── helpers.ts             测试夹具
│
├── public/images/             ★ 图片资源（详见 docs/ASSETS.md）
│   ├── ups/                   UP 主头像放这里
│   ├── backgrounds/           背景图（可选）
│   ├── decorations/           装饰图（可选）
│   └── placeholders/          通用占位图（已提供）
│
├── scripts/                   资料核实与验收工具（开发期用，不影响网站运行）
│   ├── bili-api.mjs           B 站公开 API 客户端（含 WBI 签名）
│   ├── verify-ups.mjs         按昵称核实 UP 主公开资料
│   ├── fetch-by-uid.mjs       按 UID 核实
│   ├── summarize-research.mjs 把核实结果汇总成便于人工复核的摘要
│   ├── calibrate.mjs          用真实数据校准相似指数系数
│   ├── diagnose-scores.mjs    打印各极端作答下的分数分布（排查用）
│   ├── check-layout.mjs   真实浏览器检查：横向溢出与关键元素
│   ├── check-interactions.mjs 真实浏览器交互检查：完整跑一遍答题流程
│   ├── screenshot.mjs         生成桌面与手机端截图
│   ├── out/                   核实记录与报告（原始 JSON，可复核资料来源）
│   └── lib/path-safe.mjs      不含 node:path 的路径工具（见第十二节）
│
└── docs/
    ├── SCORING.md             ★ 8 个维度的打分标准（改分数前必读）
    ├── ASSETS.md              ★ 图片命名、尺寸、版权与对照表
    ├── GITHUB.md              ★ 连接 GitHub 并推送的逐步教程（含浏览器登录）
    └── DEPLOY.md              ★ Cloudflare Pages 部署教程与上线检查清单
```

---

## 五、三套构建产物（按用途选一套）

站点是纯静态的，所以同一份源码可以打出三种形态，命令都在 `package.json` 里：

| 命令 | 输出目录 | 结构 | 适合场景 |
|---|---|---|---|
| `npm run build` | `dist/` | `index.html` + `assets/main-*.js` + `assets/main-*.css` + `debug.html` | **部署到 Cloudflare Pages**（文件名带内容哈希，缓存友好） |
| `npm run build:site` | `site/` | `index.html` + `script.js` + `style.css` + `images/` | 上传到任意静态空间；文件名固定、扁平、便于内联或嵌入 |
| `npm run build:standalone` | `standalone/` | `index.html`（单文件，CSS 与 JS 全部内联） | **双击直接在浏览器打开**，无需服务器，可离线发给别人 |
| `npm run build:all` | 以上三个 | —— | 一次全打 |

### 三者的差别

```text
dist/
  index.html            引用 ./assets/main-*.js 与 ./assets/main-*.css
  debug.html            开发期自检页（自动答完题看结果）
  assets/
    main-*.js
    main-*.css
  images/...

site/                   ← 你要求的扁平命名
  index.html            引用 ./script.js 与 ./style.css
  script.js
  style.css
  images/...

standalone/
  index.html            175 KB 单文件，样式在 <style>、脚本在 <script>，无外部请求
  images/...
```

### 为什么需要 standalone 这一套

`dist/` 和 `site/` 用的是 `<script type="module">`，
而浏览器在 **`file://` 协议下会因 CORS 拒绝加载 ES 模块**，双击 html 会白屏。
`standalone/` 用 esbuild 打成传统 IIFE 脚本并把 CSS 内联，
没有任何模块请求，所以**双击就能跑**（已实测：`file://` 下 35 项交互检查全部通过）。

> 三个目录都在 `.gitignore` 里，属于构建产物，不会提交到仓库。

---

## 六、怎么改题目

所有题目都在 **`src/data/questions.ts`**，改这个文件即可，不需要动其它代码。

一道题长这样：

```ts
{
  id: 'q01',                                  // 唯一 id，不要重复
  text: '聊天时我经常会突然冒出一个奇怪但很好笑的想法，忍不住想讲出来。',
  dimension: 'humor',                         // 属于哪个维度
  weight: 1,                                  // 题目权重（影响该维度的相对重要程度）
  reverse: false,                             // 是否反向计分
}
```

改题目时注意：

1. **`id` 必须唯一**。已经发布过的 `id` 不要改，否则老用户的答题进度会失效（代码会自动丢弃找不到的题，不会报错）。
2. **`dimension` 必须是 8 个维度之一**：`humor` `research` `empathy` `opinion` `narrative` `community` `experiment` `aesthetic`。
3. **每个维度建议保持 5 题左右**，否则维度之间会失衡。改完跑 `npm test`，有一条用例会检查每个维度是否恰好 5 题。
   （如果你想改成 4 题或 6 题，请同步修改 `tests/match.test.ts` 里那条断言。）
4. **反向题不是正向题的简单否定**，而要从另一个行为侧面描述同一维度。建议保持 20%~35% 的反向题比例。
5. **题干不要出现具体作品名**，让任何人都能作答。
6. **不要暗示"哪种更好"**——每条描述都应该对应一种真实存在的习惯。

改完记得跑测试：

```bash
npm test
```

---

## 七、怎么改 UP 主名单

名单在 **`src/data/ups/group1.ts` / `group2.ts` / `group3.ts`**，
这三个文件都通过 `src/data/ups.ts` 汇总输出。

### 加一位 UP 主

1. 打开任意一个 group 文件（或新建 `group4.ts`），**抄一份现有档案**改字段：

```ts
{
  id: 'up_019',                 // 站内编号，必须唯一，建议 up_0XX 递增
  uid: 12345678,                // B 站真实 UID
  name: '示例UP主',
  category: '动画杂谈与评论',      // 必须是七类之一，见下方
  tags: ['标签1', '标签2', '标签3'],  // 至少 3 个
  summary: '一句话风格总结，会出现在结果页和卡片上。',
  intro: '较长的一段创作风格介绍。',
  contentFocus: '主要创作内容说明。',
  observedStyle: ['基于公开投稿能观察到的特征1', '特征2', '特征3'],
  scores: { humor: 80, research: 60, empathy: 70, opinion: 75, narrative: 65, community: 70, experiment: 55, aesthetic: 60 },
  scoreRationale: '每个维度为什么给这个分，按 docs/SCORING.md 的分档说明。',
  sources: [{ label: 'B站空间主页', url: 'https://space.bilibili.com/12345678' }],
  verification: 'verified',      // verified / partial / unverified
  fansSnapshot: 123456,          // 公开粉丝数快照（可选）
  verifiedAt: '2025-01',
  matchable: true,               // false = 只展示、不参与匹配
}
```

2. 新建分组文件时，还要到 `src/data/ups.ts` 里把它加进 `ALL_GROUPS`：

```ts
const ALL_GROUPS: UpProfile[][] = [UPS_GROUP_1, UPS_GROUP_2, UPS_GROUP_3, UPS_GROUP_4];
```

3. 到 `docs/ASSETS.md` 的对照表里补一行，方便以后放头像。

4. 跑 `npm test`，数据完整性用例会检查：
   - `id` / `uid` 是否唯一
   - 是否缺少必要文本、标签是否少于 3 个、是否有资料来源
   - 8 个维度分数是否都在 0~100
   - 画像是否有区分度（最高分与最低分至少相差 20 分）
   - 是否有两位 UP 主画像完全相同

### 七类内容分类（`category` 只能填这些）

`动画杂谈与评论`、`剧情与世界观考据`、`动漫文化科普`、`吐槽与搞笑整活`、
`混剪与MAD/AMV`、`推荐与资讯`、`二次元综合文化`

### 关于 `verification`（很重要的诚实性设定）

| 取值 | 含义 | 界面表现 |
|---|---|---|
| `verified` | 昵称、UID、公开投稿内容都经接口核实 | 图鉴显示「资料已核实」 |
| `partial` | 昵称与 UID 已核实，部分字段待补 | 图鉴显示「部分资料待补充」 |
| `unverified` | 占位数据 | 结果页顶部出现醒目提示 |

> **建议**：不要把 `unverified` 且 `matchable: true` 的条目直接上线。
> 测试里有一条用例会拦住这种情况，避免把占位资料当成正式结果。

### 用工具核实真实资料

`scripts/` 下有现成的核实工具（只读公开接口，不下载、不转载任何图片或视频）：

```bash
# 1. 把要核实的昵称写进一个 UTF-8 文本文件，每行一个
#    （中文参数在部分 Windows 终端会被转码，所以推荐用文件传入）
# scripts/names-c.txt

# 2. 核实：输出 scripts/out/<uid>.json
node scripts/verify-ups.mjs --in scripts/names-c.txt --out _check-c.json --limit 20

# 3. 也可以直接用 UID 核实
node scripts/fetch-by-uid.mjs 63231 730732

# 4. 汇总成便于人工复核的摘要
node scripts/summarize-research.mjs
```

拿到真实的 UID、昵称、签名与最近投稿标题后，再按 `docs/SCORING.md` 的标准打分。
**不要凭印象编造 UID 或作品名。**

---

## 八、怎么调整 UP 主的维度评分

评分标准和分档表在 **`docs/SCORING.md`**，请先读它再改分数。

要点：

- 每个维度按 **S(88-100) / A(74-87) / B(58-73) / C(42-57) / D(0-41)** 分档
- **只依据公开创作内容**（投稿标题、简介、标签、公开系列名），不推测私人性格
- 每个 ≥74 的维度都应能在 `observedStyle` 或 `scoreRationale` 里用公开作品举例
- 8 个维度不要都挤在 70 分以上（测试会检查区分度）

**改完 UP 主画像后，建议重新校准相似指数**，否则分数可能整体偏高或偏低：

```bash
node scripts/calibrate.mjs
```

它会输出距离分布和建议的 `maxDistance`。把结果填回 `src/config.ts` 的 `match.maxDistance`：

```ts
match: {
  maxDistance: 145,   // 校准值，见上方注释
  minSimilarity: 30,  // 分数下限，避免出现负分
},
```

然后跑 `npm test`，标定回归用例会检查"分数没有被压到下限、前三名有区分度"。

---

## 九、UP 主数据设置（不改代码就能增删改）

站点内置了一个可视化设置页：`https://b-up.pages.dev/#/settings`（本地是 `/#/settings`）。
入口也在**页脚**和**图鉴页**上。

### 能做什么

| 功能 | 说明 |
|---|---|
| **改分** 调整任意 UP 主的 8 维分数 | 滑块调整，范围 0–100，旁边标注「基准 96」这样的原值 |
| **新增** 自己加一位 UP 主 | 必填项见下；缺任意一项都无法保存 |
| **移除** 把一位移出名单 | 源码数据不变，随时可以点「↺ 名字」放回 |
| **删除** 自己添加的 UP 主 | 自定义档案可直接删除 |
| 实时预览 | 立即看到该 UP 主在全部中立画像下的排名、分数条与雷达图 |
| 按昵称 / UID / 分类搜索 | 快速定位名单里的某一位 |
| 导出 TypeScript 片段 | 一键复制可直接粘回 `src/data/ups/group*.ts` 的代码 |
| 导出 / 导入 JSON | 备份自己的调整，或导入别人分享的名单 |
| 恢复默认 | 单独恢复某位，或全部恢复成源码基准值 |

### 新增 UP 主必须提供的数据

需求要求「可以添加删减 UP，但是需要提供相关的数据」，所以这里是**硬校验**，
缺任何一项都点不动「添加」，并会逐项提示缺了什么：

| 必填项 | 校验规则 |
|---|---|
| 昵称 | 非空、≤ 30 字、不能与名单里已有昵称重复 |
| B 站 UID | 正整数、不能与名单里已有 UID 重复（会拦住填错的重复 UID） |
| 内容分类 | 必须从 7 个既定分类里选一个 |
| 一句话风格 | 非空、≤ 80 字（结果页与卡片上会显示这句） |
| 8 个维度分数 | **每一项**都必须是 0–100 的整数，缺一项就报「还有 N 个维度没填」 |

可选（不填会用合理默认值）：主要创作内容、资料来源链接。

新增的档案会被标记为 **`verification: 'unverified'`（未核实）**，
分数依据写明是「用户填写」，避免和经过核实的基准数据混淆。

### 改动保存在哪里

存在浏览器的 localStorage，分三个键，**只影响本机预览与结果计算**：

| 键名 | 内容 |
|---|---|
| `anime-up-match:score-overrides` | 改过的分数 |
| `anime-up-match:custom-ups` | 新增的 UP 主 |
| `anime-up-match:hidden-ups` | 被移出名单的 id |

- 不会上传到任何服务器
- 不会改动仓库里的源码文件
- 清空浏览器数据即消失

> **为什么不能在网页上直接改文件？**
> 本站是纯静态站点，浏览器没有写项目文件的权限。
> 这是浏览器的安全模型决定的，不是实现难度问题。
> 所以采用「本地编辑 + 一键导出」的组合：先在页面上试出满意的结果，
> 再导出片段人工粘回源码，重新构建部署即永久生效。

### 让改动永久生效的完整流程

```bash
# 1. 打开设置页调分 / 增删（本地或线上都可以）
npm run dev            # → http://localhost:5173/#/settings

# 2. 点「导出 TypeScript 片段」，复制出来

# 3. 按片段里的注释处理：
#    分数调整 → 替换对应档案的 scores
#    移除     → 把该档案的 matchable 改成 false
#    新增     → 把对象补进 src/data/ups/group3.ts

# 4. 复核（重要：改数据可能影响相似指数分布）
npm test                      # 53 条单元测试，含标定回归
node scripts/calibrate.mjs    # 看距离分布是否需要重新校准 maxDistance

# 5. 构建并部署
npm run build && git add -A && git commit -m "调整 UP 主名单" && git push
```

### 相关文件

| 文件 | 作用 |
|---|---|
| `src/pages/settings.ts` | 设置页界面 |
| `src/core/up-overrides.ts` | 覆盖存储、校验、导入导出 |
| `src/state.ts` | 把覆盖接进匹配流程（`state.roster`） |
| `src/data/ups/group*.ts` | 基准数据（永不被运行时改写） |
| `scripts/check-settings.mjs` | 设置页的自动化检查（29 项） |

---

## 十、怎么加 UP 主头像

**完整说明见 `docs/ASSETS.md`**，这里给最短路径：

1. 文件名 = UP 主编号，例如 `up_001.webp`
2. 放进 `public/images/ups/`
3. 刷新页面即可，**不用改任何代码**

支持 `.webp` `.png` `.jpg` `.jpeg` `.svg` `.avif`，代码会按顺序自动尝试。

想用别的文件名，就在档案里加 `image` 字段：

```ts
{ id: 'up_001', image: 'fanshi-avatar', /* … */ }   // → images/ups/fanshi-avatar.webp
```

**图片缺失时不会出现破图**：会自动降级成「昵称首字 + 暖色底」的文字占位头像，
分享图里也一样。所以**一张图片都没有时网站也是完整可用的**。

> 版权提醒：本站不自动下载或转载任何 UP 主头像。请自行确认素材有使用权；
> 没有授权时保持文字占位即可。

---

## 十一、怎么测试

分三层：**单元测试**（纯逻辑）→ **浏览器检查**（真实渲染）→ **交互检查**（真实点击）。

### 1. 单元测试（53 条，秒级完成）

```bash
npm test            # 跑一遍全部单元测试
npm run test:watch  # 监听模式，改代码自动重跑
```

| 文件 | 覆盖内容 |
|---|---|
| `tests/scoring.test.ts` | 反向计分、7 档分值、标准化到 0~100、极端与中立作答、加权距离、相似指数夹取 |
| `tests/match.test.ts` | 排序规则、并列时的稳定排序、可复现性、前三名、结果解释文案、缺数据报错 |
| `tests/ups-data.test.ts` | 数据完整性（id/uid 唯一、标签、来源、分数范围、画像区分度）+ 相似指数标定回归 |

### 2. 浏览器检查（布局与关键元素）

先启动预览服务，再跑检查：

```bash
npm run build
npm run preview        # 另开一个终端
node scripts/check-layout.mjs --base http://localhost:4173 --width 390
```

它会用真实 Chrome（DevTools 协议）逐页检查：

- 文档是否横向溢出（手机上内容被截断的常见原因）
- 是否有元素超出视口右边界
- 关键元素是否渲染出来（导航 3 个、图鉴卡片、作答圆点 7 个、前三名卡片 3 个、雷达图 canvas、分享图）

把 `--width` 换成 `1440` 可以检查桌面端。

**换托管方式时要带上对应参数**（这三套都实测通过）：

```bash
# dist/（预览服务，含 debug.html 结果页检查）
npm run build && npm run preview
node scripts/check-layout.mjs --base http://localhost:4173 --width 390

# site/（任意静态服务器；没有 debug.html，所以加 --no-debug）
node scripts/check-layout.mjs --base http://127.0.0.1:4180 --width 390 --no-debug

# standalone/（直接 file:// 打开；必须写全 --page index.html）
node scripts/check-layout.mjs --base "file:///E:/PythonLearning/network/standalone" --page index.html --width 390 --no-debug
```

> `--page` 在 `file://` 下是**必须**的：写成目录形式（`.../standalone`）浏览器会显示
> 目录列表而不是页面，检查会全部落空。

### 3. 交互检查（完整跑一遍答题流程）

```bash
# dist/ 或 site/
node scripts/check-interactions.mjs --base http://localhost:4173

# standalone/（file://）
node scripts/check-interactions.mjs --base "file:///E:/PythonLearning/network/standalone" --page index.html
```

共 35 项检查，**用真实点击走完整条链路**：

- 点击圆点是否被记录；选择后是否自动进入下一题
- 关掉"自动进入下一题"后是否停在原题
- 上一题是否保留原来的选择（含选中状态的可见性）
- 方向键能否操作圆点、焦点是否留在圆点上
- 题目速览能否跳转到指定题
- 未答完点提交是否被拦住、并跳到第一道未作答的题目
- 答完 40 题后按钮是否变成「查看我的 UP 主匹配结果」
- `localStorage` 是否保存了 40 条答案、刷新后进度是否恢复
- 提交后结果页是否真的算出来了（最佳匹配、相似指数、前三名、雷达图、分享图、分享文案、8 行对比表、免责声明）
- 前三名是否按相似指数降序
- 整个流程有没有控制台报错

### 4. 设置页检查（64 项）

```bash
node scripts/check-settings.mjs --base http://localhost:4173
```

覆盖：名单渲染、搜索过滤、切换选中、拖动滑块、写入 localStorage、刷新持久化、
**改分后结果页第一名真的变化**（证明覆盖接进了匹配算法）、单独恢复、全部恢复、
**新增 UP 主的完整校验链**（空表单被拦 → 缺项被拦 → 重复 UID 被拦 → 填齐后成功并出现在图鉴）、
**移除与放回**、**删除自定义档案**、无控制台报错。

### 5. 截图（可选）

```bash
node scripts/screenshot.mjs --base http://localhost:4173 --out screenshots

# 线上验收（对已部署的站点做体检）
node scripts/verify-live.mjs https://b-up.pages.dev/
```

会生成桌面端（1440px）与手机端（390px）共 12 张截图，并顺带报告每页的真实视口宽度与是否有横向溢出。

### 6. 文字溢出专项检查（可选）

```bash
node scripts/find-overflow2.mjs --base http://localhost:4173 --widths 320,390,1440
```

逐页遍历所有元素，找出「内容超出容器」「被 line-clamp 截断」的地方。
排查「文字显示到框外」这类问题时用它最直接。

### 7. 端到端检查页（手动看结果）

```bash
# 浏览器打开（只有 dist/ 里有这个页面）：
http://localhost:4173/debug.html?pattern=flat&level=0
```

参数：

- `pattern=flat&level=0..6` —— 所有题都选同一档（0=完全认同，6=完全不认同）
- `pattern=zigzag` —— 7 档循环作答，构造锯齿状画像
- `pattern=mixed` —— 前 20 题强烈认同，后 20 题强烈不认同

页面右下角会显示本次计算的摘要（完成度、最佳匹配、前三名、风格标签、数据提示），
方便一眼确认结果确实是算出来的。

### 6. 模拟云端从零构建（部署前必做）

本地能构建 **≠** 云端能构建。这条命令会严格按"别人 clone 下来"的内容跑一遍
Cloudflare 的流程（`npm ci` + `npm run build`）：

```bash
node scripts/simulate-ci-build.mjs
```

它会复制 git 跟踪的 112 个文件到干净目录 → 检查没有混入 `node_modules`/`dist`/私钥
→ `npm ci` → `npm run build` → 校验产物里 HTML 是否正确引用了打包后的 JS 与 CSS。

通过时输出：

```
✅ 模拟构建成功：Cloudflare Pages 用 `npm run build` + 输出目录 `dist` 即可部署
```

> 在受限沙箱里 `npm ci` 可能因写不了 npm 默认缓存而报 `EPERM`，
> 换成 `npm ci --cache ./.npm-cache` 即可，云端没有这个限制。

---

## 十二、怎么部署到 Cloudflare Pages

> 更详细的图文步骤、常见问题与上线检查清单见 **[docs/DEPLOY.md](docs/DEPLOY.md)**。
> 下面是精简版。

### 方式 A：连 Git 仓库（推荐，以后推送自动更新）

1. 把项目推到 GitHub / GitLab 仓库
2. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 选择仓库，填写构建配置：

| 配置项 | 值 |
|---|---|
| Framework preset | `Vite`（或 None） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 在环境变量里加 `NODE_VERSION = 20`（推荐） |

4. 点 **Save and Deploy**，等一两分钟即可拿到 `https://<项目名>.pages.dev`

### 方式 B：直接上传构建产物（不需要 Git）

```bash
npm run build
```

然后在 Cloudflare Pages 里选 **Upload assets**，把整个 `dist/` 文件夹拖进去。

### 部署后建议做的两件事

1. **填上正式域名**：编辑 `src/config.ts` 的 `siteUrl`，
   它会显示在分享图底部。填完重新构建再部署。

2. **自定义域名**：在 Pages 项目的 **Custom domains** 里添加即可，免费且自动带 HTTPS。

### 不需要配置的东西

- ❌ 不需要 Workers / D1 / R2
- ❌ 不需要服务端重定向规则（用的是哈希路由，任何路径都返回 `index.html` 即可）
- ❌ 不需要环境变量（除了可选的 `NODE_VERSION`）

---

## 十三、分数是怎么算出来的

想自己复核的话，公式都在下面（也能在「关于测试」页面看到同样内容）。

### 1. 单题得分

| 选项 | 完全认同 | 非常认同 | 比较认同 | 中立 | 不太认同 | 非常不认同 | 完全不认同 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 分值 | +3 | +2 | +1 | 0 | −1 | −2 | −3 |

**反向题取反**：对反向题选"完全认同"记 −3 分。

### 2. 维度原始分

```text
原始分[维度] = Σ ( 单题得分 × 该题在该维度上的权重 )
```

### 3. 标准化到 0~100

```text
标准化分 = (原始分 − 该维度可达最低分) / (可达最高分 − 可达最低分) × 100
```

用**真实可达**的上下界而不是固定的 ±满分，
所以即使某个维度反向题较多，`50 分` 依然准确代表"这个维度偏中性"。

### 4. 维度权重

```text
原始权重 = 该维度已作答题目的权重和
最终权重 = 原始权重 / 所有维度原始权重的平均值
```

之所以再除以平均值：避免距离被整体放大（详见 `src/core/match.ts` 的注释）。
8 个维度各 5 题时，最终权重都是 1，即等权。

### 5. 距离与相似指数

```text
distance   = √( Σ 权重 × (你的分数 − UP主分数)² )
相似指数    = (1 − distance / maxDistance) × 100，夹到 [30, 100]
```

`maxDistance = 145` 是**用真实数据校准出来的**（见第七节与 `scripts/calibrate.mjs`）。
它决定了分数的量级：距离约 21 分 → 约 86 分，距离约 56 分 → 约 61 分。

### 6. 排序

1. 相似指数从高到低
2. 相同时距离近的在前
3. 再相同时 UID 小的在前

**第 3 条保证了结果完全可复现**：同样答案永远得到同样排名。

> 注意：这个数字叫「**风格相似指数**」，衡量的是"两个画像有多接近"，
> 是相对刻度，**不是概率、不是准确率，也没有经过心理测量学验证**。

---

## 十四、已知问题与注意事项

### 1. Windows + 中文路径下 `node:path` 会算错（本机实测）

在部分 Windows 环境（本机为 Node v24 + 中文用户名/路径）实测：

```js
path.posix.join('src', '../core/storage')   // 期望 '../core/storage'
// 实际返回 'core/storage'（把 ".." 直接吃掉了）
```

这会连锁影响 TypeScript / Vite / Rollup 的模块解析，报错形如：

```text
Could not resolve "../core/storage" from "src/state.ts"
```

**本项目的应对**：

- 代码里统一使用路径别名（`@core/...`、`@data/...`、`@ui/...` 等），
  定义在 `aliases.mjs`，由 Vite/Vitest 直接映射为绝对路径，不经过 `node:path` 折叠 `..`
- `tsconfig.json` 里用 `paths` 配了同一套别名，因此 `tsc` 也能正确解析
- `scripts/lib/path-safe.mjs` 提供了不含 `node:path` 的路径工具，供脚本使用

如果你的机器上一切正常，这些机制同样正常工作，不会有副作用。

### 2. 类型检查（`npm run typecheck`）

`tsconfig.json` 已配好与 Vite 一致的路径别名，所以类型检查是可用且推荐的：

```bash
npm run typecheck      # 只做类型检查，不产出文件
npm run build:strict   # 类型检查 + 构建（类型不过就不构建）
```

当前状态：**0 个类型错误**。

> 注意：如果你把项目放在**含中文的路径**下（例如 `E:\项目\网站`），
> 由于上面第 1 条提到的 `node:path` 问题，`tsc` 可能会报大量"找不到模块"。
> 这种情况下用 `npm run build`（只走 Vite/esbuild）即可，
> 或者把项目移到纯英文路径下再跑类型检查。

### 3. 数据核实状态

`src/data/ups/` 里每位 UP 主都带 `verification` 字段与 `sources` 来源链接。
如果看到 `partial`，说明该 UP 主的昵称与 UID 已核实，但个别字段仍在补充。
**任何 `unverified` 且参与匹配的条目都会让结果页显示醒目提示**，这是刻意设计。

### 4. 关于 `matchable: false`

「H萌团队」是社团账号而不是个人创作者，所以 `matchable: false`：
它出现在图鉴里作为背景资料，但不会成为"你是哪位 UP 主"的结果。

### 5. 分享图生成

分享图用 Canvas 在浏览器本地绘制（`src/share/card.ts`），不依赖任何第三方库。
如果本地头像图片加载失败，会退化成文字占位头像，**分享功能不会因此失效**。

---

## 当前验收状态

最后一次完整验收的结果（可自行复现）：

| 检查项 | 结果 |
|---|---|
| `npm run typecheck` | ✅ 0 个类型错误（别名已在 `tsconfig.json` 的 `paths` 中配置） |
| `npm test` | ✅ 53 / 53 通过（计分、匹配、数据完整性、标定回归） |
| `npm run build` → `dist/` | ✅ 成功（JS 92.6 kB / gzip 34.2 kB，CSS 27.2 kB / gzip 5.7 kB） |
| `npm run build:site` → `site/` | ✅ 成功，扁平命名：`index.html` + `script.js` + `style.css` |
| `npm run build:standalone` → `standalone/` | ✅ 成功，单文件 175 KB（CSS/JS 全内联） |
| `dist/` 布局检查（桌面 1440px） | ✅ 5 个页面全部通过，无横向溢出 |
| `site/` 布局检查（手机 390px） | ✅ 4 个页面全部通过，无横向溢出 |
| `standalone/` 布局检查（`file://` + 390px） | ✅ 4 个页面全部通过，无横向溢出 |
| `dist/` 交互检查 | ✅ 35 / 35 通过（完整答题流程 + 结果页 + 刷新恢复 + 无控制台报错） |
| `dist/` 设置页检查 | ✅ 29 / 29 通过（含「改分后结果页第一名变化」的端到端验证） |
| `standalone/` 交互检查（`file://`） | ✅ 35 / 35 通过，证实双击即可运行 |
| 文字溢出专项（320 / 390px，5 个页面） | ✅ 无真实溢出 |

> 验收是在项目路径 `E:\PythonLearning\network` 下完成的。
> 换路径或换托管方式后，所有检查需重新跑一遍。

验收过程中发现并修复的真实缺陷：

1. **维度权重未归一化**，导致加权距离被整体放大 √5 ≈ 2.24 倍，
   相似指数被压到下限、前三名大面积并列 → 已把权重归一化到平均值 1。
2. **`maxDistance` 标定错误**（原为理论值 130）→ 用真实数据实测后改为 145，
   并加了回归测试防止被改坏。
3. **7 级圆点的选中状态只在"改动时"设置**，初始渲染没有同步：
   返回上一题时看不到已选项、屏幕阅读器也读不到 → 已在组件初始化时统一走一次同步。
4. **手机上展开的答题页存在横向溢出风险** → 补齐 `min-width: 0`、放宽列间距、
   收紧移动端导航，并在真实浏览器里逐页验证。
5. **图片路径依赖 `import.meta.env.BASE_URL`**，导致 esbuild 打 IIFE 单文件时报错
   → 改为纯相对路径（本站 index.html 始终在站点根目录，相对路径在根域名、
   子路径、`file://` 三种情况下都正确），同时去掉了对构建期变量的依赖。
6. **导航栏 LOGO 方块里的文字溢出到框外**（用户反馈的问题）：
   方块是 `2.25rem` 见方、字号 14px，却放了三个汉字「动画区」，
   实测文字纵向溢出 18px、横向也超出，视觉上就是"文字跑到框外面"。
   → 方块改为 `2rem`、字号 13px、行高 1.15，文字改成两个字「UP主」，
   并加了 `overflow: hidden` 兜底。
7. **首页大标题 `line-height: 1.12` 轻微裁字**：中文行高过小，实测字形纵向溢出 2px
   → 行高改为 1.2。
8. **设置页在 320px 宽度下栅格子元素不收缩**：`min-width: auto` 使分数行的
   内容比容器宽 2px → 给栅格子元素统一加 `min-width: 0`。
9. **`npm ci` 在云端可能因 `.npmrc` 写死缓存目录而变慢/失败**：
   原来把 `cache=.npm-cache` 写进了 `.npmrc`（那是为绕开本机沙箱限制）
   → 从 `.npmrc` 移除，本机安装改为按需加 `--cache ./.npm-cache`。
10. **`tsconfig.json` 缺少 `paths` 别名映射**，导致类型检查完全不可用
   （报几十条"找不到模块"）→ 补齐别名后**一次性暴露出 13 处真实类型错误**并全部修好：
   端到端检查页的答案对象没有类型、图鉴页弹层的子元素数组里混入了字符串、
   答题页有两个未使用的导入。

---

## 附：常用命令速查

```bash
# ---------- 开发 ----------
npm install              # 安装依赖
npm run dev              # 开发服务器 http://localhost:5173
npm run typecheck        # 类型检查（应为 0 错误）
npm run test             # 单元测试（53 条）
npm run test:watch       # 测试监听模式

# ---------- 构建三套产物 ----------
npm run build            # dist/         带哈希文件名，部署用（含 debug.html）
npm run build:site       # site/         扁平命名：index.html + script.js + style.css
npm run build:standalone # standalone/   单文件，双击即可打开
npm run build:all        # 一次全打
npm run build:strict     # 类型检查 + dist 构建
npm run preview          # 预览 dist/ → http://localhost:4173

# ---------- 验收（需要先起服务）----------
npm run check:layout -- --base http://localhost:4173 --width 390
npm run check:interactions -- --base http://localhost:4173
node scripts/check-settings.mjs --base http://localhost:4173      # 设置页（29 项）
node scripts/find-overflow2.mjs --base http://localhost:4173 --widths 320,390,1440
node scripts/screenshot.mjs --base http://localhost:4173 --out screenshots

# 线上站点体检
node scripts/verify-live.mjs https://b-up.pages.dev/

# 独立发布包（无 debug.html，要加 --no-debug）
node scripts/check-layout.mjs --base http://127.0.0.1:4180 --no-debug

# 单文件版（file:// 下必须写全 --page index.html）
node scripts/check-layout.mjs --base "file:///E:/PythonLearning/network/standalone" --page index.html --no-debug
node scripts/check-interactions.mjs --base "file:///E:/PythonLearning/network/standalone" --page index.html

# ---------- 推送 ----------
node scripts/push-via-deploy-key.mjs          # 用项目内部署密钥推送
node scripts/push-via-deploy-key.mjs --force  # 本地 amend 过历史时用
node scripts/set-git-identity.mjs "名字" "邮箱"  # 修改提交身份

# ---------- 资料核实（开发期）----------
node scripts/verify-ups.mjs --in scripts/names-a.txt --out _a.json --limit 20
node scripts/fetch-by-uid.mjs 63231
node scripts/summarize-research.mjs

# ---------- 校准与排查 ----------
node scripts/calibrate.mjs        # 统计距离分布，校准 maxDistance
node scripts/diagnose-scores.mjs  # 打印各种作答下的分数分布
```

---

## 授权与使用

- 代码可自由修改使用。
- UP 主昵称、UID 等事实性信息来自 B 站公开接口与公开资料，仅用于说明资料来源。
- 本站不包含、不转载任何 UP 主的头像、封面或视频内容。
- 请勿把本测试结果作为评价任何创作者的依据。
