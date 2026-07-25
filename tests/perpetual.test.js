import { describe, it, expect } from 'vitest'
import { RED, BLACK, ROWS, COLS } from '../js/constants.js'
import { createInitialBoard, cloneBoard } from '../js/pieces.js'
import { RepetitionDetector } from '../js/perpetual.js'

/**
 * 局面 = 棋盘 + 走棋方
 */
function positionHash(board, turn) {
  let s = turn === RED ? 'w' : 'b'
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c]
      if (piece) {
        s += `|${r},${c},${piece.type},${piece.color}`
      } else {
        s += '|_'
      }
    }
  }
  return s
}

describe('Position repetition detection', () => {
  it('should detect same position repeated', () => {
    const board = createInitialBoard()
    expect(positionHash(board, RED)).toBe(positionHash(board, RED))
  })

  it('different turns produce different hashes', () => {
    const board = createInitialBoard()
    expect(positionHash(board, RED)).not.toBe(positionHash(board, BLACK))
  })

  it('position changes after a move', () => {
    const b1 = createInitialBoard()
    const b2 = cloneBoard(b1)
    b2[7][4] = b2[7][1]
    b2[7][1] = null
    expect(positionHash(b1, RED)).not.toBe(positionHash(b2, BLACK))
  })

  it('should detect threefold repetition', () => {
    const positions = [
      positionHash(createInitialBoard(), RED),
      positionHash(createInitialBoard(), BLACK),
      positionHash(createInitialBoard(), RED),
      positionHash(createInitialBoard(), BLACK),
      positionHash(createInitialBoard(), RED),
    ]
    const counts = {}
    for (const h of positions) {
      counts[h] = (counts[h] || 0) + 1
    }
    expect(Object.values(counts).some((c) => c >= 3)).toBe(true)
  })
})

describe('RepetitionDetector 长将', () => {
  it('短序列不判长将', () => {
    const det = new RepetitionDetector()
    const board = createInitialBoard()
    det.record(board, RED, true)
    det.record(board, BLACK, false)
    expect(det.isPerpetualCheck()).toBeNull()
  })

  it('红方连续三回合将军则判红方长将', () => {
    const det = new RepetitionDetector()
    const board = createInitialBoard()
    // 偶数步为红方着后局面，wasCheck=true 表示红方刚将军
    for (let i = 0; i < 6; i++) {
      det.record(board, i % 2 === 0 ? BLACK : RED, i % 2 === 0)
    }
    expect(det.isPerpetualCheck()).toBe(RED)
  })
})
