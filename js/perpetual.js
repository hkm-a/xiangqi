// ============================================================
// 象棋 - 循环局面检测 (长将/长捉)
// ============================================================
import { ROWS, COLS, RED, BLACK } from './constants.js'
import { findKing, isInCheck } from './pieces.js'

/**
 * Zobrist hash 工具 — 用于高效检测重复局面
 */
class ZobristHasher {
  constructor() {
    // 初始化随机数表: 类型(7) × 颜色(2) × 位置(90)
    this.table = {}
    this._init()
  }

  _init() {
    // 用固定种子确保可重复性
    const rand = (seed) => {
      let s = seed
      return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff
        return s
      }
    }
    const rng = rand(42)

    const types = ['king', 'advisor', 'bishop', 'horse', 'rook', 'cannon', 'pawn']
    const colors = [RED, BLACK]
    for (const type of types) {
      this.table[type] = {}
      for (const color of colors) {
        this.table[type][color] = []
        for (let i = 0; i < ROWS * COLS; i++) {
          this.table[type][color][i] = rng()
        }
      }
    }

    // 走棋方随机数
    this.sideRandom = { [RED]: rng(), [BLACK]: rng() }
  }

  /**
   * 计算棋盘 hash (XOR-based Zobrist)
   */
  hash(board, turn) {
    let h = this.sideRandom[turn] || 0
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = board[r][c]
        if (p && this.table[p.type] && this.table[p.type][p.color]) {
          h ^= this.table[p.type][p.color][r * COLS + c]
        }
      }
    }
    return h
  }
}

/** 全局 Zobrist 实例 */
export const zobrist = new ZobristHasher()

/**
 * 循环局面检测器
 */
export class RepetitionDetector {
  constructor() {
    /** @type {Map<number, number>} hash → 出现次数 */
    this.history = new Map()
    /** @type {Array<{hash: number, wasCheck: boolean}>} 最近走法记录 */
    this.moveLog = []
  }

  /** 记录一个新局面 */
  record(board, turn, wasCheck) {
    const h = zobrist.hash(board, turn)
    this.history.set(h, (this.history.get(h) || 0) + 1)
    this.moveLog.push({ hash: h, wasCheck })
  }

  /** 撤销上一个局面 */
  unrecord(board, turn) {
    const h = zobrist.hash(board, turn)
    const count = this.history.get(h)
    if (count && count > 0) {
      if (count === 1) {
        this.history.delete(h)
      } else {
        this.history.set(h, count - 1)
      }
    }
    this.moveLog.pop()
  }

  /** 局面出现次数 */
  getCount(board, turn) {
    const h = zobrist.hash(board, turn)
    return this.history.get(h) || 0
  }

  /**
   * 检测长将（同一方连续 3 次以上将军）
   * 亚洲棋规: 长将判负
   */
  isPerpetualCheck() {
    if (this.moveLog.length < 6) return null // 需要至少 3 个回合

    // 取最近 6 步 (3 个回合)
    const recent = this.moveLog.slice(-6)

    // 交替检查: 红方连续 3 次将军? 黑方连续 3 次将军?
    const redChecks = recent.filter((_, i) => i % 2 === 0 && recent[i].wasCheck)
    const blackChecks = recent.filter((_, i) => i % 2 === 1 && recent[i].wasCheck)

    if (redChecks.length >= 3) {
      return RED // 红方长将
    }
    if (blackChecks.length >= 3) {
      return BLACK // 黑方长将
    }
    return null
  }

  /**
   * 检测三次重复局面
   * 亚洲棋规: 双方不变作和
   */
  isThreefoldRepetition(board, turn) {
    return this.getCount(board, turn) >= 3
  }

  /** 重置 */
  reset() {
    this.history.clear()
    this.moveLog = []
  }
}
