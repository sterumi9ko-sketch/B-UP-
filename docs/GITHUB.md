# 连接 GitHub 并推送（Windows 逐步教程）

本文档假设：项目已经初始化好本地仓库并完成了提交，
但还没连接 GitHub。全程大约 3 分钟，只需要登录一次。

> 你的机器上已确认具备的条件：
> - Git 已安装：`E:\git\Git\cmd\git.exe`（版本 2.53）
> - **Git Credential Manager 已随 Git 一起安装**
>   （`E:\git\Git\mingw64\bin\git-credential-manager.exe`）
>   —— 有它才能用"浏览器登录"这种最省事的方式
> - 还没有配置提交身份、还没有凭据记录、没有 SSH key

---

## 第 1 步：让 Git 使用凭据管理器（只需一次）

凭据管理器是"浏览器登录"的前提，当前你的 Git 还没启用它：

```powershell
git config --global credential.helper manager
```

确认设置成功：

```powershell
git config --global credential.helper
# 应该输出：manager
```

---

## 第 2 步：配置提交身份（只会写进提交，不影响登录）

```powershell
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

`user.email` 建议用你 GitHub 账号里的邮箱，这样提交会正确归到你名下。
如果不想暴露真实邮箱，GitHub 提供了隐私邮箱（在
GitHub → Settings → Emails 页面能看到），形如：

```
12345678+你的用户名@users.noreply.github.com
```

配置后确认：

```powershell
git config --global user.name
git config --global user.email
```

---

## 第 3 步：在 GitHub 网页上创建一个空仓库

1. 打开 <https://github.com/new>
2. **Repository name** 填一个名字，例如 `anime-up-match`
3. **不要**勾选 "Add a README file"、".gitignore"、"license"
   （勾了会导致首次推送冲突，因为本地已经有提交了）
4. 点 **Create repository**

创建完你会看到一个空仓库页面，里面有仓库地址，形如：

```
https://github.com/你的用户名/anime-up-match.git
```

---

## 第 4 步：推送（这一步会弹浏览器登录）

在项目根目录执行（把地址换成你自己的）：

```powershell
cd E:\PythonLearning\network
node scripts/push-to-github.mjs https://github.com/你的用户名/anime-up-match.git
```

或者用简写：

```powershell
node scripts/push-to-github.mjs 你的用户名/anime-up-match
```

脚本会自动检查身份、设置 `origin`、然后推送。

### 登录时会看到什么

推送时 Git Credential Manager 会**弹出一个窗口**：

1. 选择 **Sign in with your browser**（用浏览器登录）
2. 浏览器自动打开 GitHub 的授权页面
3. 点 **Authorize** / **继续** 完成授权
4. 回到终端，推送自动继续

授权成功后凭据会存进 Windows 凭据管理器，**以后推送、拉取都不再需要登录**。

> 如果窗口没弹出来，而是终端里直接提示要输入 `Username` / `Password`：
> 说明凭据管理器没生效，请回到第 1 步确认，或者检查是不是用了别的 Git 安装。

---

## 第 5 步：确认推送成功

```powershell
git remote -v          # 应该显示 origin 指向你的仓库
git log --oneline -1   # 应该显示你刚才的提交
git status             # 应该显示 working tree clean
```

然后刷新 GitHub 仓库页面，文件应该都在了。

---

## 之后怎么用

```powershell
# 改了代码后，提交并推送
git add .
git commit -m "更新 UP 主资料"
git push
```

推送成功后，如果已经配好 Cloudflare Pages 连接了这个仓库，
**Cloudflare 会自动重新构建并部署**，不需要其它操作。

---

## 常见问题

### Q1：提示 `remote origin already exists`

说明之前加过 remote。脚本会自动改成新地址；手动改则是：

```powershell
git remote set-url origin https://github.com/你的用户名/仓库名.git
```

### Q2：提示 `failed to push some refs` / `rejected`

通常是 GitHub 上的仓库不是空的（创建时勾了 README）。
两种解决办法，**推荐第一种**：

```powershell
# 办法一：把远程的初始提交拉下来合并（会弹一次编辑器写合并信息，存盘关闭即可）
git pull --rebase origin main
git push -u origin main
```

```powershell
# 办法二：确认远程内容不要，强制覆盖（谨慎，会删掉远程已有提交）
git push -u origin main --force
```

### Q3：提示 `Author identity unknown` / `Please tell me who you are`

第 2 步没做。补上 `user.name` 和 `user.email` 即可。

### Q4：提示 `Support for password authentication was removed`

GitHub **已禁止用账号密码推送**。这正是要用凭据管理器（浏览器登录）或
Personal Access Token 的原因。回到第 1 步启用凭据管理器即可。

### Q5：想换成 SSH 方式

```powershell
# 1. 生成密钥（一路回车即可）
ssh-keygen -t ed25519 -C "你的邮箱"

# 2. 复制公钥内容
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | Set-Clipboard

# 3. 粘贴到 GitHub → Settings → SSH and GPG keys → New SSH key

# 4. 测试
ssh -T git@github.com

# 5. 把 remote 换成 SSH 地址
git remote set-url origin git@github.com:你的用户名/仓库名.git
```

### Q6：想取消保存的凭据

Windows 上在「凭据管理器 → Windows 凭据」里找到 `git:https://github.com` 删除即可；
或者命令行执行 `git credential-manager erase`。

---

## 下一步

推送到 GitHub 之后，就可以去 Cloudflare Pages 连接这个仓库了，
构建配置见 [DEPLOY.md](DEPLOY.md)（Build command = `npm run build`，
Build output directory = `dist`，环境变量 `NODE_VERSION = 20`）。
