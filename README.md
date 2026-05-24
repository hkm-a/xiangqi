# 中國象棋 · Xiangqi

<p align="center">
  极简 · 精美 · 强 AI
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ES Module-F7DF1E?logo=javascript">
  <img src="https://img.shields.io/badge/Vite-6.4-646CFF?logo=vite">
  <img src="https://img.shields.io/badge/Vitest-3.2-6E9F18?logo=vitest">
  <img src="https://img.shields.io/badge/AI-Iterative Deepening-FF6B6B">
</p>

---

一个纯粹的中国象棋 Web 应用。没有多余功能——只有棋盘、强 AI、优雅的暗色界面。

## 特性

- 🎨 **极简暗色 UI** — 左右布局，无滚轮，专注对弈体验
- 🤖 **三档 AI 难度** — 初学 / 进阶 / 大师，基于迭代加深 + Alpha-Beta 剪枝
- 💡 **走法提示** — 实时 AI 推荐最佳走法 + 局面评估
- 🔊 **合成音效** — 走子、吃子、将军、胜负音效（Web Audio API，零外部文件）
- 🔄 **棋盘翻转** — 随时切换视角
- ♻️ **自动存档** — 刷新页面自动恢复对局
- 📱 **响应式** — 桌面 / 平板 / 手机自适应

## 快速开始

```bash
npm install
npm run dev     # 启动开发服务器 (http://localhost:5173)
npm test        # 运行 110+ 测试用例
npm run build   # 构建生产版本 → dist/
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 渲染 | HTML5 Canvas |
| 构建 | Vite 6 |
| 测试 | Vitest (110 测试) |
| AI | 迭代加深 + Alpha-Beta 剪枝 + Zobrist 置换表 + MVV-LVA 走法排序 |
| 音效 | Web Audio API (合成音效) |
| 字体 | Noto Serif SC / DM Sans |

## 项目结构

```
xiangqi/
├── js/
│   ├── main.js          # 主控制器（交互、UI、AI 调度）
│   ├── game.js           # 游戏状态管理
│   ├── pieces.js         # 棋子走法规则引擎 (51 测试)
│   ├── renderer.js       # Canvas 渲染（含动画）
│   ├── ai.js             # AI 引擎（迭代加深 + 置换表）
│   ├── ai-worker.js      # AI Web Worker（不阻塞 UI）
│   ├── sound.js          # Web Audio API 合成音效
│   ├── fen.js            # FEN 导入/导出
│   ├── perpetual.js      # 循环局面检测（Zobrist 哈希）
│   └── constants.js      # 常量定义
├── css/
│   └── style.css         # 暗色主题样式
├── tests/                # 110 个测试用例
├── index.html
├── vite.config.js
└── package.json
```

## AI 引擎

基于经典博弈树搜索，从零实现：

- **迭代加深** — 时间可控，浅层结果可随时使用
- **Alpha-Beta 剪枝** — 大幅减少搜索节点
- **Zobrist 置换表** — 缓存已评估局面，避免重复搜索
- **MVV-LVA 走法排序** — 先搜索最有希望的走法，提高剪枝效率
- **坐席搜索 (Quiescence Search)** — 解决水平线效应
- **位置价值表** — 为每个棋子类型定制的位置评估

难度对应搜索深度：初学 2 层 / 进阶 4 层 / 大师 6 层

## 许可

MIT
