# 用令牌一次性推送（最简单）

本文档解决一种具体情况：**在当前终端里 Git Credential Manager 弹不出授权窗口，
导致 `git push` 卡住或报 `could not read Username`。**
用 Personal Access Token（个人访问令牌）可以一次推完。

---

## 第 1 步：生成令牌（约 40 秒）

1. 打开 👉 https://github.com/settings/tokens/new
   （或手动进入：GitHub 右上角头像 → **Settings** → 左侧最下 **Developer settings**
   → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**）
2. **Note** 随便填，例如 `push-once`
3. **Expiration** 建议选 **7 days**（用完就过期，最安全）
4. **勾选权限**：勾上最上面的 **`repo`**（完整仓库读写，够用）
5. 拉到底点 **Generate token**
6. 页面上会出现一串以 `ghp_` 开头的令牌 —— **点复制按钮**（只显示这一次，刷新就没了）

> 细粒度令牌（Fine-grained）也可以，但需要该仓库的 **Contents: Read and write** 权限。

---

## 第 2 步：把令牌复制到剪贴板

第 1 步最后点的那下"复制"就已经在剪贴板里了。
**不要**把它粘到聊天窗口或任何文档里。

---

## 第 3 步：运行推送脚本

在 PowerShell 里执行：

```powershell
cd E:\PythonLearning\network
$env:GIT_SSL_BACKEND='openssl'
node scripts/push-with-token.mjs --from-clipboard --clear-clipboard
```

脚本会：

1. 从**剪贴板**读取令牌（所以令牌不会出现在命令行、历史记录或对话里）
2. 校验格式（`ghp_` 或 `github_pat_` 开头），不像令牌就直接中止
3. 清空剪贴板
4. 推送 `main` 分支到 `https://github.com/sterumi9ko-sketch/B-UP-`
5. 输出里的令牌会被自动脱敏成 `***`

看到 `✅ 推送成功。` 就好了。

---

## 第 4 步：用完立刻撤销令牌（推荐）

推送成功后，回到 https://github.com/settings/tokens
找到刚才那个 `push-once`，点 **Delete**。

以后再次推送时，如果你已经在浏览器里登录过，用普通命令即可：

```powershell
git push
```

如果还是要求登录，就再走一次本文档的流程（生成新令牌）。

---

## 常见报错

| 报错 | 原因 | 解决 |
|---|---|---|
| `这看起来不像 GitHub 令牌` | 剪贴板里不是令牌（或复制失败） | 回到第 1 步重新复制 |
| `403 Permission denied` | 令牌没勾 `repo` 权限 | 重新生成，勾上 `repo` |
| `404 Repository not found` | 令牌对应的账号不是 `sterumi9ko-sketch` | 用仓库所有者的账号生成令牌 |
| `schannel: failed to receive handshake` | Windows schannel TLS 偶发失败 | 命令前加 `$env:GIT_SSL_BACKEND='openssl'`（本文档已包含） |
| `non-fast-forward` / `stale info` | 远端已有别的提交 | 先 `git pull --rebase origin main` 再推 |
| 仍然卡住不返回 | 剪贴板为空导致脚本在等 | 确认剪贴板有内容；或改用 `$env:GH_TOKEN='ghp_xxx'` 方式 |

---

## 为什么不用浏览器登录了

你机器上的 Git Credential Manager 需要弹出图形授权窗口，
但当前这个终端环境是非交互的（脚本运行在后台），窗口弹不出来，
于是 `git push` 会一直等在那里（实测挂起超过 5 分钟）。

**在你自己的 PowerShell 窗口里直接运行 `git push` 是可以弹出浏览器登录的**，
那条路更省事、也不用生成令牌。本文档只是为"非交互环境"准备的备选方案。
