// ============================================================
// AI 引擎 - 评估函数 & 搜索基础测试
// ============================================================
import { describe, it, expect } from 'vitest'
import { evaluate, findBestMove } from '../js/ai.js'
import { createInitialBoard, cloneBoard } from '../js/pieces.js'
import { RED, BLACK, KING, ROOK, ADVISOR, BISHOP } from '../js/constants.js'

describe('AI evaluate()', () => {
  it('初始局面评分为中性附近', () => {
    const board = createInitialBoard()
    const score = evaluate(board)
    // 初始局面应接近均势（红方稍优因为先手）
    expect(Math.abs(score)).toBeLessThan(300)
  })

  it('红方多子时评分更高', () => {
    const board = createInitialBoard()
    // 移除黑方一个車 (0,0)
    board[0][0] = null
    const score = evaluate(board)
    expect(score).toBeGreaterThan(200)
  })

  it('黑方多子时评分更低', () => {
    const board = createInitialBoard()
    // 移除红方一个車 (9,0)
    board[9][0] = null
    const score = evaluate(board)
    expect(score).toBeLessThan(-200)
  })

  it('护卫数量影响评分', () => {
    const board = createInitialBoard()
    const baseScore = evaluate(board)

    // 移除红方仕
    board[9][3] = null
    const withoutAdvisor = evaluate(board)
    // 缺少护卫，红方评分应降低（或黑方相对优势）
    expect(withoutAdvisor).toBeLessThan(baseScore)
  })

  it('空棋盘评分为 0', () => {
    const board = Array.from({ length: 10 }, () => Array(9).fill(null))
    const score = evaluate(board)
    expect(score).toBe(0)
  })
})

describe('AI findBestMove()', () => {
  it('初始局面返回合法走法', () => {
    const board = createInitialBoard()
    const result = findBestMove(board, RED, 1) // difficulty 1 (浅层)
    expect(result).toBeTruthy()
    expect(typeof result.fromRow).toBe('number')
    expect(typeof result.toRow).toBe('number')
    expect(typeof result.score).toBe('number')
  })

  it('优势局面评分较高', () => {
    const board = createInitialBoard()
    // 移除黑方一車，红方大优
    board[0][0] = null
    board[0][8] = null // 再移除一車，红方优势更明显

    const result = findBestMove(board, RED, 1)
    expect(result).toBeTruthy()
    expect(typeof result.score).toBe('number')
    expect(result.score).toBeGreaterThan(300)
    expect(typeof result.fromRow).toBe('number')
    expect(typeof result.toRow).toBe('number')
  })
})
