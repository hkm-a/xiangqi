# 中國象棋 · Xiangqi

<p align="center"><strong>小而美</strong> — 一盘棋，一个 AI，一块暗色棋盘。</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript" alt="JS">
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri" alt="Tauri">
  <img src="https://img.shields.io/badge/tests-vitest-6E9F18" alt="tests">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT">
</p>

本地可玩的中国象棋。棋盘是主角；侧栏只留必要信息。无账号、无广告、无外链字体。  
桌面版支持 **GitHub Actions 自动构建** 与 **启动后检查更新**（见 [docs/RELEASE.md](docs/RELEASE.md)）。

## 产品边界

**做深**

- 规则正确、着法合法
- 三档 AI（初 / 进 / 师）
- 点击与拖拽走棋
- 中文记谱 + 棋盘提示箭头
- 离线中文语音
- **PWA 安装** + **Tauri 桌面端**（可选）

**不做**

- 联网对战、排行榜、账号
- 局面分条、多主题皮肤、残局自动续盘
- 开局库 / UCI 外挂
- Electron 之类重壳

新功能默认 **拒绝**，除非：提升对弈本身、不增认知负担、可本地测试。

## 本地运行（浏览器）

```bash
npm install
npm run tts:generate   # 首次或缺失语音时
npm run dev            # http://localhost:3000
npm test
npm run build
npm run preview        # 验证 PWA / 离线
```

### 安装为桌面应用（PWA，零额外依赖）

1. `npm run build && npm run preview`
2. 用 Chrome / Edge 打开预览地址
3. 地址栏「安装」→ 独立窗口，可离线

生产环境会注册 Service Worker，静态资源与语音片段可缓存离线。

## 桌面端（Tauri，约 3 MB 可执行文件）

需本机已装 **Rust**（[rustup](https://rustup.rs)）与 Windows 上 **WebView2**（Win10/11 通常自带）。

```bash
npm install
npm run desktop:dev       # 开发：Vite + 原生窗口
npm run desktop:build     # 发布：生成安装包
npm run desktop:shortcut  # 在「桌面」创建快捷方式（指向已构建的 exe）
```

产物位置：

| 文件 | 说明 |
|------|------|
| `src-tauri/target/release/xiangqi.exe` | 便携运行（约 3 MB） |
| `src-tauri/target/release/bundle/nsis/*-setup.exe` | NSIS 安装包（约 1.3 MB） |

**快捷方式**

- 安装版：NSIS 会写入开始菜单文件夹「中國象棋」
- 桌面快捷方式：任意时刻执行 `npm run desktop:shortcut`（指向已构建的 `xiangqi.exe`）

**GitHub 自动构建 / 自动更新**

| 流程 | 触发 | 产物 |
|------|------|------|
| CI | push / PR | lint · 测试 · 网页 build |
| Release | 推送 tag `v*` | Windows 安装包 + `latest.json` 更新清单 |

```bash
# 发版示例（版本号需与 package.json / tauri.conf 一致）
git tag v1.3.1 && git push origin v1.3.1
```

桌面端启动后会检查  
`https://github.com/hkm-a/xiangqi/releases/latest/download/latest.json`，  
有新版本时侧栏提示，用户确认后下载安装并重启。

首次启用需在仓库 Secrets 配置签名私钥，详见 **[docs/RELEASE.md](docs/RELEASE.md)**。

窗口位置、尺寸、最大化状态会自动记住（`tauri-plugin-window-state`）。

> 不打包 MSI（WiX 对中文产品名偶发失败）；NSIS 足够小而美。  
> 桌面壳内不注册 Service Worker（PWA 仅浏览器用）。

## 界面

| 区域 | 内容 |
|------|------|
| 棋盘 | 走子 · 提示箭头 · 将军闪烁 |
| 状态 | 一行文案（走棋 / 将军 / 终局） |
| 设置 | 执红/黑 · 初/进/师 |
| 提示 | 按需：点「示」或 H 才分析（不自动） |
| 操作 | 新局 · 悔棋 · 翻转 · 音效 |
| 记录 | 被吃子 · 着法列表（复制 / 双击 / C） |

快捷键：`N` 新局 · `U`/`Z` 悔棋 · `F` 翻转 · `H` 提示 · `M` 音效 · `C` 复制着法 · `Esc` 取消选子

## 结构

```
js/            规则 · 记谱 · 对局 · AI · 渲染 · 语音
css/           暗色主题（单文件）
public/        图标 · PWA manifest · SW · tts
src-tauri/     Tauri 2 桌面壳（可选）
scripts/       TTS 生成
tests/         Vitest
index.html     唯一页面
```

## AI

迭代加深 + Alpha-Beta + Zobrist + MVV-LVA + 静默搜索。  
深度：初学 2 / 进阶 4 / 大师 6。Worker 内搜索。

## 后续可优化清单（备忘，默认不做）

按「小而美」排序，需要时再动刀：

| 优先级 | 点 | 说明 |
|--------|----|------|
| 已做 | 提示改为按需 | 默认不算提示，仅点「示」/H |
| 已做 | 着法导出 | 复制 / 双击 / C |
| 已做 | 音效极简预载 | 仅预热将军/不能走 |
| 已做 | 按需 rAF | 无动画时停帧省电 |
| 已做 | 窗口状态记忆 | Tauri 记住位置/尺寸/最大化 |
| 已做 | 减少动态效果 | 遵循 prefers-reduced-motion |
| 不做 | Electron | 体积与内存与宗旨相悖 |
| 不做 | 联网对战 | 产品边界外 |

## 许可

MIT
