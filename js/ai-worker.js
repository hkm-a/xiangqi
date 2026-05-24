// ============================================================
// 象棋 - AI Web Worker
// 在独立线程中运行 AI 计算，不阻塞 UI
// ============================================================

// 在 Worker 中动态导入 es-module-shims 或使用 importScripts
// Vite 下通过 new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' }) 加载

import { findBestMove, resetTT } from './ai.js'
import { RED, BLACK } from './constants.js'
import { fenToBoard, boardToFEN } from './fen.js'
import { cloneBoard, createInitialBoard } from './pieces.js'

self.onmessage = (e) => {
  const { type, data } = e.data

  switch (type) {
    case 'findBestMove':
      handleFindBestMove(data)
      break
    case 'reset':
      resetTT()
      self.postMessage({ type: 'resetDone' })
      break
    case 'analyze':
      handleAnalyze(data)
      break
    default:
      self.postMessage({ type: 'error', data: { message: `Unknown command: ${type}` } })
  }
}

function handleFindBestMove(data) {
  const { fen, color, difficulty, moveHistory } = data

  // 从 FEN 重建棋盘
  let board
  if (fen) {
    board = fenToBoard(fen)
  } else if (moveHistory && moveHistory.length > 0) {
    // 从走法历史重建（简化：使用初始棋盘并播放走法）
    board = createInitialBoard()
    for (const m of moveHistory) {
      board[m.toRow][m.toCol] = board[m.fromRow][m.fromCol]
      board[m.fromRow][m.fromCol] = null
    }
  } else {
    board = createInitialBoard()
  }

  if (!board) {
    self.postMessage({ type: 'error', data: { message: 'Invalid FEN' } })
    return
  }

  const startTime = performance.now()

  const result = findBestMove(board, color, difficulty, (progress) => {
    // 向主线程报告进度
    self.postMessage({
      type: 'progress',
      data: { ...progress, elapsed: performance.now() - startTime },
    })
  })

  const elapsed = performance.now() - startTime

  self.postMessage({
    type: 'result',
    data: {
      ...result,
      elapsed,
    },
  })
}

function handleAnalyze(data) {
  const { fen, color, depth } = data
  const board = fen ? fenToBoard(fen) : createInitialBoard()

  if (!board) {
    self.postMessage({ type: 'error', data: { message: 'Invalid FEN for analysis' } })
    return
  }

  const startTime = performance.now()
  const result = findBestMove(board, color || RED, depth || 4, (progress) => {
    self.postMessage({
      type: 'analysisProgress',
      data: { ...progress, elapsed: performance.now() - startTime },
    })
  })
  const elapsed = performance.now() - startTime

  self.postMessage({
    type: 'analysisResult',
    data: { ...result, fen, elapsed },
  })
}
