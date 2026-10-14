# 部署教程（Cloudflare Pages / GitHub Pages）

本站是**纯静态网站**：没有后端、没有数据库、没有需要常驻运行的服务。
构建产物就是 `dist/` 目录里的一堆文件，上传即可访问。

- 不需要 Cloudflare Workers
- 不需要 D1 / R2 / KV
- 不需要配置重定向规则（本站用哈希路由，任何路径都会落到 `index.html`）
- 免费额度足够个人项目使用

---

## 先选一条路

| 方案 | 优点 | 缺点 | 本文档位置 |
|---|---|---|---|
| **Cloudflare Pages** | 国内访问通常更快；有 CDN | 创建流程较绕（容易误入 Workers） | 第一 ~ 五节 |
| **GitHub Pages** | 仓库已经在了，点两个开关即可；工作流已备好 | 国内访问速度一般 | 第六节 |

两条路的构建配置完全一样（`npm run build` + 输出 `dist`），可以都开，互不影响。

---

## 零、部署前先本地验证一遍

```bash
npm install
npm run typecheck  # 类型检查，应该 0 个错误
npm test           # 单元测试，应该 53 条全部通过
npm run build      # 应该成功产出 dist/
npm run preview    # 打开 http://localhost:4173 确认页面正常
```

### 强烈建议：先模拟一次「云端从零构建」

本地能构建 **≠** 云端能构建。云端没有 `node_modules`、没有缓存，
也没有你未提交的文件。用下面这条命令可以完整模拟 Cloudflare 的构建流程：

```bash
node scripts/simulate-ci-build.mjs
```

它会：

1. 把 **git 跟踪的文件**（严格等于别人 clone 下来的内容）复制到一个干净目录
2. 检查这个目录里没有混入 `node_modules` / `dist` / 私钥
3. 执行 `npm ci`（Cloudflare 用的安装方式）
4. 执行 `npm run build`（Cloudflare 的 Build command）
5. 校验产出的 `dist/index.html` 是否真的引用了打包好的 JS 与 CSS

全部通过会打印：

```
✅ 模拟构建成功：Cloudflare Pages 用 `npm run build` + 输出目录 `dist` 即可部署
```

**这一步在本项目上已经跑通**（112 个跟踪文件 → `npm ci` → 构建 → 产物校验通过，
并用真实浏览器确认了首页、答题页、图鉴页、关于页、结果页全部正常渲染）。

> 注意：在部分受限环境（例如带写入限制的沙箱）里，`npm ci` 可能因为
> 无法写 npm 默认缓存目录而报 `EPERM`。这不是项目问题，
> 换成 `npm ci --cache ./.npm-cache` 即可。云端不存在这个限制。

### 如果想让构建在类型不过时直接失败

把构建命令换成：

```bash
npm run build:strict   # 类型检查 + 打包
```

> 但**Cloudflare 上建议仍用 `npm run build`**：
> 如果以后有人把项目放在含中文的路径下，`tsc` 可能因为 `node:path` 的问题误报
> （见 README 第十三节）。用 `build` 更稳，类型检查在本地做即可。

如果在构建时报 `Could not resolve ...`，请先看 README 第十三节「已知问题」
（通常是因为项目路径含中文导致的 `node:path` 问题，本项目已用路径别名规避）。

### 顺便说一下 `.npmrc`

本项目的 `.npmrc` 刻意**不设置 cache 目录**（只关了 fund/audit）。
原因是：写死缓存路径会让云端 CI 无法使用平台自带缓存，反而更慢甚至失败。
本地如果遇到缓存目录不可写，安装时手动指定即可：

```bash
npm install --cache ./.npm-cache
```

---

## 一、方式 A：连接 Git 仓库（推荐）

以后每次 `git push` 都会自动重新部署。

### 第 1 步：把项目推送到 GitHub / GitLab

> 如果还没有 GitHub 账号或不知道怎么连接，看 **[GITHUB.md](GITHUB.md)**（含浏览器登录的逐步教程）。

```bash
cd 你的项目目录
git init
git add .
git commit -m "feat: 动画区 UP 主风格匹配测试"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

> 本项目已初始化好仓库并完成提交，还附带了一个推送脚本：
> `node scripts/push-to-github.mjs 你的用户名/仓库名`
> （会自动检查提交身份、设置 remote、然后推送）

> `.gitignore` 已经排除了 `node_modules/`、`dist/`、缓存目录与截图，
> 推到仓库的只有源码，体积很小。

### 第 2 步：在 Cloudflare 里创建 Pages 项目 ⚠️ 容易走错

**Cloudflare 现在的创建流程默认落在 Workers 上，两者长得很像，但不是一个东西。**
先记住怎么区分：

| 特征 | Workers（错误） | Pages（正确） |
|---|---|---|
| 页面标题 | "Set up your application" / "Configure your Worker project" | "Set up builds and deployments" |
| 有 **Deploy command** 字段 | ✅ 有（`npx wrangler deploy`） | ❌ 没有 |
| 有 **Build output directory** 字段 | ❌ **没有** | ✅ **必须有** |
| 需要 `wrangler.toml` | 需要 | 不需要 |

> 只要你看到界面上问 "Deploy command"，那就说明走错了，**点 Back 退出去重新选**。

正确路径：

1. 打开 <https://dash.cloudflare.com/>
2. 左侧选 **Workers & Pages**
3. 点右上角 **Create application**
4. **关键**：在出现的选项里切到 **Pages** 标签
   （若只看到 Workers，找 "Looking to deploy a web app or static site?" 或
   "Import a repository" 之类的入口；不同账号界面文案略有差异）

5. 在 Pages 里选 **Connect to Git**
6. 授权 Cloudflare 访问 GitHub → 选择仓库 → **Begin setup**

### 第 3 步：填写构建配置（关键）

| 配置项 | 填写内容 |
|---|---|
| Project name | 例如 `b-up-match`（这会成为 `b-up-match.pages.dev`） |
| Production branch | `main` |
| Framework preset | `Vite` |
| Build command | `npm run build` |
| **Build output directory** | **`dist`** |
| Root directory | 留空（如果项目在仓库子目录里，填那个子目录名） |

**环境变量**（展开 Environment variables (advanced) 添加）：

| 变量名 | 值 | 说明 |
|---|---|---|
| `NODE_VERSION` | `20` | 推荐显式指定，避免构建环境用了过新的 Node 出现意外 |

> 本项目在 Node 18 / 20 / 22 上都验证过，建议 20 或 22。

### 第 4 步：部署

点 **Save and Deploy**，等待 1–3 分钟。
成功后你会拿到一个地址，形如：

```
https://up-match.pages.dev
```

### 第 5 步：之后如何更新

只要推送到 `main` 分支，Cloudflare 会自动重新构建并部署：

```bash
git add .
git commit -m "更新 UP 主资料"
git push
```

---

## 二、方式 B：直接上传构建产物（不需要 Git）

适合「我只想先上线看看效果」。

```bash
npm run build      # 生成 dist/ 目录
```

1. 打开 <https://dash.cloudflare.com/> → **Workers & Pages** → **Create** → **Pages**
2. 选择 **Upload assets**
3. 项目名随意填，然后把**整个 `dist` 文件夹**拖进去
   （注意是拖 `dist` 里面的内容，或者直接拖 `dist` 文件夹本身，界面会提示）
4. 点 **Deploy site**

以后要更新，重复「重新构建 + 上传」即可。

---

## 三、GitHub Pages（仓库已在 GitHub 时最省事）

本项目已经准备好了工作流 **`.github/workflows/deploy-pages.yml`**，
你只需要在网页上点两个开关，之后每次 `git push` 都会自动构建并部署。

### 第 1 步：开启 Pages 并选择 Actions 作为来源

1. 打开仓库的 **Settings** → 左侧 **Pages**
   （地址：`https://github.com/sterumi9ko-sketch/B-UP-/settings/pages`）
2. **Source** 选 **GitHub Actions**
   （不要选 "Deploy from a branch" —— 那个需要把构建产物提交进仓库）
3. 不需要改其它设置

### 第 2 步：触发一次部署

工作流在 `main` 分支有新提交时会自动运行。第一次可以手动触发：

1. 打开仓库的 **Actions** 标签
2. 左侧选 **构建并部署到 GitHub Pages**
3. 点右侧 **Run workflow** → **Run workflow**

### 第 3 步：拿到网址

等 1–2 分钟，部署完成。网址形如：

```
https://sterumi9ko-sketch.github.io/B-UP-/
```

（在 Settings → Pages 页面顶部也会显示 "Your site is live at ..."）

### 关于子路径

GitHub Pages 的项目站点部署在 `https://<用户名>.github.io/<仓库名>/` 这个**子路径**下，
所以资源必须用绝对前缀。工作流里已经处理好了：

```yaml
env:
  GITHUB_PAGES_BASE: /${{ github.event.repository.name }}/
```

`vite.config.ts` 会读取这个变量设置 `base`。构建结果对比：

| 场景 | `index.html` 里的引用 |
|---|---|
| 默认（Cloudflare / 本地 / file://） | `./assets/main-*.js` |
| GitHub Pages 子路径 | `/B-UP-/assets/main-*.js` |

> 本机可以这样验证子路径构建是否正确：
> ```powershell
> $env:GITHUB_PAGES_BASE='/B-UP-/'; npm run build
> ```

### 工作流做了什么

1. 检出代码 → 安装 Node 20（带 npm 缓存）
2. `npm ci` 严格按 `package-lock.json` 安装
3. 跑类型检查与单元测试（**失败不阻塞部署**，避免环境差异导致整站发不出去）
4. `npm run build` 构建
5. 写入 `.nojekyll`（防止 GitHub 用 Jekyll 处理而忽略某些文件）
6. 上传 `dist/` 并部署

---

## 四、部署后建议做的两件事

### 1. 把正式域名填进配置

分享图底部会显示网站地址。找到 `src/config.ts`：

```ts
/** 部署后填写正式域名，用于生成分享链接与分享图上的网址 */
siteUrl: 'https://你的域名',
```

填好后重新构建部署，分享图上的地址就正确了。

### 2. 绑定自定义域名（可选，免费）

1. 进入 Pages 项目的 **Custom domains** 标签
2. 点 **Set up a custom domain**
3. 输入你的域名（例如 `upmatch.example.com`）→ **Continue**
4. 按提示在 DNS 里添加 CNAME 记录（域名已托管在 Cloudflare 时通常一键完成）
5. 等证书签发（一般几分钟），HTTPS 会自动开启

---

## 五、常见问题

### Q1：部署后打开是空白页？

先检查 **Build output directory** 是否填了 `dist`。
如果填成了仓库根目录，浏览器会加载到没有打包的 `index.html`，于是白屏。

### Q2：刷新页面出现 404？

本站用哈希路由（地址形如 `https://域名/#/result`），
`#` 后面的内容不参与服务端请求，所以**不会**出现刷新 404。
如果你改造成了 History 路由，才需要额外配置 fallback。

### Q3：构建失败，提示找不到 `esbuild` 或 `vite`？

- 确认 **Build command** 是 `npm run build`
- 确认仓库里包含 `package.json`
- 不要提交 `node_modules`（`.gitignore` 已排除）；Cloudflare 会自己安装依赖

### Q4：构建时报 `Could not resolve "../xxx"`？

这是本项目在特定 Windows 环境下遇到过的 `node:path` 问题。
本项目已通过路径别名（`aliases.mjs`）规避，正常环境中不会出现。
如果仍然遇到，请确认没有手工把别名改回 `../..` 形式的相对路径。

### Q5：图片（UP 主头像）没有显示？

这是预期行为——仓库里默认没有头像文件，标题会退化成文字占位头像（不会破图）。
要放头像，请按 `docs/ASSETS.md` 把图片放进 `public/images/ups/` 并重新部署。

### Q6：想改成国内访问更快的托管？

构建产物与平台无关，`dist/` 可以直接部署到任何静态托管服务
（例如腾讯云 COS、阿里云 OSS、Netlify、Vercel、自建 Nginx）。
只要保证：
- 站点根目录指向 `dist/`
- 未匹配的路径回退到 `index.html`（哈希路由下其实用不到这条）

---

## 六、部署检查清单

上线前对照一遍：

- [ ] `npm run build` 成功
- [ ] `npm run preview` 里首页、答题页、结果页、图鉴页、关于页都正常
- [ ] 40 题能答完，结果页能算出最佳匹配与前三名
- [ ] 刷新答题页，进度没有丢失
- [ ] 分享图能生成与下载
- [ ] `src/config.ts` 的 `siteUrl` 已填成正式域名
- [ ] 构建输出目录填的是 `dist`
- [ ] 环境变量 `NODE_VERSION` 已设置（推荐 20）
- [ ] 手机浏览器打开检查一遍布局与点击区域

---

## 七、关于数据与隐私（部署后也适用）

- 网站没有后端，用户答案**不会**上传到任何服务器
- 答题进度只存在用户自己的浏览器 `localStorage` 里
- 分享图在用户浏览器本地生成
- 因此不需要处理任何用户数据合规、数据库备份或接口安全问题
