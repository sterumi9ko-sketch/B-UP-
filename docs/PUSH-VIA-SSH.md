# 用部署密钥推送（无需浏览器登录）

本文档解决一种具体情况：**在当前终端里 `git push` 弹不出浏览器授权窗口，
或提示 `could not read Username` / GCM 一直挂起。**
用 **SSH 部署密钥（Deploy key）** 可以彻底绕开这个交互，之后一直能非交互推送。

> 本项目已经按本文档配置好了，仓库也已经在 2026-10-14 成功上传。
> 这里保留流程说明，方便你换机器或换仓库时复用。

---

## 原理

```
本地私钥（留在电脑上，不提交）
        │  SSH 认证
        ▼
GitHub 仓库的 Deploy key（只存公钥）
```

- 公钥可以随便公开，私钥永远不出本机
- Deploy key 可以限定为**只能访问这一个仓库**，比账号级令牌更安全
- 加完一次之后，`git push` 不再需要任何登录

---

## 本项目当前的状态

| 项目 | 值 |
|---|---|
| 仓库 | `https://github.com/sterumi9ko-sketch/B-UP-` |
| SSH 远程地址 | `git@github.com:sterumi9ko-sketch/B-UP-.git` |
| 私钥 | `.ssh-push/id_ed25519`（已加入 `.gitignore`，未被提交） |
| 公钥 | `.ssh-push/id_ed25519.pub` |
| known_hosts | `.ssh-push/known_hosts` |

---

## 换机器/换仓库时的完整流程

### 第 1 步：生成专用密钥

```powershell
cd E:\PythonLearning\network
New-Item -ItemType Directory -Force -Path .ssh-push | Out-Null
ssh-keygen -t ed25519 -f .ssh-push/id_ed25519 -N '""' -C "deploy-key"
```

### 第 2 步：确保私钥不会被提交

`.gitignore` 里应当有 `.ssh-push/`（本项目已有）。再双保险写进本地排除：

```powershell
Add-Content -Path .git\info\exclude -Value '.ssh-push/' -Encoding UTF8
git check-ignore -v .ssh-push/id_ed25519   # 应输出匹配到 .gitignore 的那一行
```

### 第 3 步：把公钥加到 GitHub

```powershell
Get-Content .ssh-push/id_ed25519.pub
```

复制输出的那一整行，然后：

1. 打开仓库的 **Settings → Deploy keys**
   （地址形如 `https://github.com/你的用户名/仓库名/settings/keys`）
2. 点 **Add deploy key**
3. **Title** 随便填，例如 `push-from-my-pc`
4. **Key** 粘贴刚才那一行
5. ⚠️ **务必勾选 `Allow write access`**（不勾只能读，推送会报
   `The key you are authenticating with has been marked as read only`）
6. 点 **Add key**

### 第 4 步：切换远程地址并推送

```powershell
git remote set-url origin git@github.com:你的用户名/仓库名.git
node scripts/push-via-deploy-key.mjs
```

脚本会依次：测试 SSH 连通性 → 推送 → `fetch` 回本地比对，确认远端与本地 HEAD 一致。

---

## 日常使用

```powershell
# 改了代码之后
git add .
git commit -m "更新 UP 主资料"
node scripts/push-via-deploy-key.mjs
```

或者给 origin 永久配上这份密钥，之后可以直接 `git push`：

```powershell
git config core.sshCommand "ssh -i .ssh-push/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=.ssh-push/known_hosts"
git push
```

---

## 常见问题

| 报错 | 原因与解决 |
|---|---|
| `Permission denied (publickey)` | 公钥还没加到仓库 Deploy keys，或加错了仓库 |
| `The key ... has been marked as read only` | 加 key 时没勾 `Allow write access` → 回到 Settings → Deploy keys 编辑并勾上 |
| `Host key verification failed` | 命令没带上 `UserKnownHostsFile` → 用脚本跑，或按上面 `core.sshCommand` 配置一次 |
| `non-fast-forward` / `rejected` | 本地改写过历史（例如 `git commit --amend`）→ 用 `node scripts/push-via-deploy-key.mjs --force` |
| 想确认远端到底收到了什么 | `git fetch origin main && git ls-tree -r --name-only FETCH_HEAD` |

---

## 安全建议

1. **推送完成后按需清理**：不再需要时可以删掉密钥与 GitHub 上的 Deploy key
   （仓库 Settings → Deploy keys → Delete）。
2. **私钥不要放到云盘/共享目录**；本项目的私钥就在项目目录内，注意别整体打包外发。
   （`git archive`、`Compress-Archive` 打包整个目录时会把 `.ssh-push` 一起装进去。）
3. **给密钥加口令**更安全，但每次推送都要输口令；
   如果只是个人电脑上的一次性推送，无口令 + 用完即删是更实际的选择。
4. Deploy key **只授权单个仓库**，比账号级 Personal Access Token（可访问所有仓库）风险小得多。
