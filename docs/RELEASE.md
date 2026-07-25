# 发版与自动更新

仓库：`hkm-a/xiangqi`

## 一次配置（仓库 Secrets）

在 GitHub → **Settings → Secrets and variables → Actions** 添加：

| Secret | 内容 |
|--------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | 本地 `.tauri/xiangqi.key` 的**全文**（私钥，勿泄露） |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 若生成密钥时设了密码则填写；无密码可留空或不建 |

公钥已写入 `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`，与 `.tauri/xiangqi.key.pub` 一致。

本地查看私钥（仅本机）：

```bash
# Windows PowerShell
Get-Content .tauri\xiangqi.key -Raw
```

**丢失私钥将无法再为旧客户端签发更新**，请备份到密码管理器。

## 日常发版流程

1. 同步版本号（三处保持一致）：
   - `package.json` → `version`
   - `src-tauri/tauri.conf.json` → `version`
   - `src-tauri/Cargo.toml` → `version`
2. 提交并推送：
   ```bash
   git add -A
   git commit -m "release: v1.3.1"
   git tag v1.3.1
   git push origin master
   git push origin v1.3.1
   ```
3. GitHub Actions **Release** 工作流会：
   - 在 `windows-latest` 构建 NSIS 安装包
   - 生成 updater 签名产物
   - 创建/更新 GitHub Release，并附上 `latest.json`
4. 已安装的旧版桌面端启动约 3 秒后检查  
   `https://github.com/hkm-a/xiangqi/releases/latest/download/latest.json`  
   发现新版本则侧栏提示「新版本 vX.Y.Z」，用户点 **更新** 后下载安装并重启。

也可在 Actions 页 **Release → Run workflow** 手动触发。

## 本地构建（可选）

```bash
# 需设置签名环境变量才有完整 updater 产物
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content .tauri\xiangqi.key -Raw
npm run desktop:build
```

## CI

- **CI**：`push` / `PR` → lint + test + 网页 `build`（无桌面）
- **Release**：`tag v*` → Windows 桌面 + GitHub Release + 更新清单

## 故障排查

| 现象 | 可能原因 |
|------|----------|
| 客户端从不提示更新 | 未发 Release / 无私钥签名 / 版本号未升高 |
| 更新失败 | Secret 私钥与 conf 公钥不匹配 |
| CI 发布失败 | `contents: write` 权限、tag 格式非 `v*` |
