# 中國象棋 · Xiangqi

<p align="center"><strong>小而美</strong> — 一盘棋，一个 AI，一块暗色棋盘。</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript" alt="JS">
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/tests-110-6E9F18" alt="tests">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT">
</p>

本地可玩的中国象棋：棋盘 + 三档 AI + 提示 + 音效。无账号、无联网、无广告。

## 产品边界

**要做的（做深做精）**

- 规则正确、着法合法
- AI 可玩（初学 / 进阶 / 大师）
- 界面安静、暗色、少控件
- 刷新可续局

**不做的（刻意砍掉）**

- 联网对战、排行榜、账号
- 开局库 / 引擎外挂 / UCI
- 皮肤商城、观战、直播
- 重型框架与多余页面

新功能默认 **拒绝**，除非同时满足：提升对弈本身、不增加认知负担、可用本地测试验证。

## 能力清单

| | |
|---|---|
| 对弈 | 人机 · 执红/执黑 · 悔棋 · 翻转视角 |
| AI | 迭代加深 · α-β · 置换表 · 静默搜索 |
| 辅助 | 走法提示 · 局面分 · 被吃子 · 着法记录 |
| 体验 | 暗色 UI · 合成音效 · 自动存档 · 响应式 |

## 本地运行

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 110 项
npm run build
```

## 结构

```
js/          规则 · 对局 · AI · 渲染 · 音效
css/         暗色主题（单文件）
tests/       Vitest
index.html   唯一页面
```

## AI（简述）

迭代加深 + Alpha-Beta + Zobrist 置换表 + MVV-LVA 排序 + 静默搜索。  
深度：初学 2 / 进阶 4 / 大师 6。Worker 内搜索，不卡 UI。

## 许可

MIT
