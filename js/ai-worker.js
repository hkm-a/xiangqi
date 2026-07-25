// ============================================================
// 象棋 - AI Web Worker（独立线程搜索，不阻塞 UI）
// ============================================================

import { findBestMove } from './ai.js'
import { fenToBoard } from './fen.js'

self.onmessage = (e) => {
  const { type, data, requestId } = e.data
  if (type !== 'findBestMove') {
    self.postMessage({ type: 'error', data: { message: `Unknown command: ${type}` }, requestId })
    return
  }

  const { fen, color, difficulty, purpose } = data
  const board = fen ? fenToBoard(fen) : null
  if (!board) {
    self.postMessage({ type: 'error', data: { message: 'Invalid FEN' }, requestId })
    return
  }

  const startTime = performance.now()
  const reportProgress = purpose !== 'hint'

  const result = findBestMove(board, color, difficulty, (progress) => {
    if (!reportProgress) return
    self.postMessage({
      type: 'progress',
      data: { ...progress, elapsed: performance.now() - startTime },
      requestId,
    })
  })

  self.postMessage({
    type: 'result',
    data: {
      ...result,
      elapsed: performance.now() - startTime,
      purpose: purpose || 'ai',
    },
    requestId,
  })
}
