// ============================================================
// 象棋 - AI 引擎（Minimax + Alpha-Beta 剪枝）
//         增强版: 迭代加深 + 置换表 + 坐席搜索
// ============================================================
import { RED, BLACK, KING, ROOK, CANNON, HORSE, BISHOP, ADVISOR, PAWN,
  COLS, ROWS, PIECE_VALUES } from './constants.js'
import { cloneBoard, getAllMoves, isInCheck, isCheckmate } from './pieces.js'

// ─── 棋子位置价值表（红方视角，row 9 = 红方底线）─────

// 兵/卒：过河后价值骤升，深入敌阵价值更高
const PAWN_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [20,22,24,26,28,26,24,22,20],
  [16,18,20,22,26,22,20,18,16],
  [12,14,16,18,22,18,16,14,12],
  [10,12,14,16,20,16,14,12,10],
  [ 8,10,12,14,16,14,12,10, 8],
  [ 6, 8, 9,11,13,11, 9, 8, 6],
  [ 4, 6, 7, 9,11, 9, 7, 6, 4],
  [ 2, 4, 5, 7, 9, 7, 5, 4, 2],
  [ 0, 2, 3, 5, 7, 5, 3, 2, 0],
]

// 马：中心价值高，边缘价值低，逼近九宫价值顶峰
const HORSE_TABLE = [
  [ 0, 2, 4, 4, 4, 4, 4, 2, 0],
  [ 2, 4, 6, 8, 8, 8, 6, 4, 2],
  [ 4, 6, 8,10,12,10, 8, 6, 4],
  [ 4, 6,10,14,16,14,10, 6, 4],
  [ 4, 6,10,14,16,14,10, 6, 4],
  [ 4, 6, 8,12,14,12, 8, 6, 4],
  [ 4, 6, 8,10,12,10, 8, 6, 4],
  [ 4, 6, 8,10,10,10, 8, 6, 4],
  [ 4, 6, 8, 8,10, 8, 8, 6, 4],
  [ 2, 4, 6, 6, 8, 6, 6, 4, 2],
]

// 车：全局最强子力，任何位置都有高价值
const ROOK_TABLE = [
  [8,12,14,16,18,16,14,12, 8],
  [8,12,14,18,20,18,14,12, 8],
  [8,12,14,18,20,18,14,12, 8],
  [8,12,14,16,18,16,14,12, 8],
  [8,10,12,14,16,14,12,10, 8],
  [8,10,12,14,16,14,12,10, 8],
  [8,10,12,14,14,14,12,10, 8],
  [8,10,12,12,14,12,12,10, 8],
  [8, 8,10,10,12,10,10, 8, 8],
  [6, 8, 8,10,12,10, 8, 8, 6],
]

// 炮：有架子时价值高，过河后威胁倍增
const CANNON_TABLE = [
  [ 4, 6, 8,10,12,10, 8, 6, 4],
  [ 4, 6, 8,10,12,10, 8, 6, 4],
  [ 4, 6, 8,10,12,10, 8, 6, 4],
  [ 4, 6, 8,10,12,10, 8, 6, 4],
  [ 4, 6, 8,10,12,10, 8, 6, 4],
  [ 4, 6, 8,10,12,10, 8, 6, 4],
  [ 4, 6, 8,10,12,10, 8, 6, 4],
  [ 4, 6, 8,10,12,10, 8, 6, 4],
  [ 4, 6, 8,10,14,10, 8, 6, 4],
  [ 2, 4, 8,10,14,10, 8, 4, 2],
]

// 士/仕：守护九宫，中央位置最佳
const ADVISOR_TABLE = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 4, 0, 4, 0, 0, 0],
  [0, 0, 0, 0, 6, 0, 0, 0, 0],
  [0, 0, 0, 4, 8, 4, 0, 0, 0],
  [0, 0, 0, 6,10, 6, 0, 0, 0],
]

// 相/象：守住己方阵地，关键防御位置
// 红相可达行 5/7/9（黑象镜像至 0/2/4）
const BISHOP_TABLE = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 6, 0, 0, 0, 6, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 6, 0,10, 0, 6, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 8, 0, 0, 0, 0],
]

// 帅/将：九宫中央最安全
const KING_TABLE = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 2, 0, 0, 0, 0],
  [0, 0, 0, 2, 4, 2, 0, 0, 0],
  [0, 0, 0, 4, 6, 4, 0, 0, 0],
]

const POS_TABLES = {
  [PAWN]: PAWN_TABLE,
  [HORSE]: HORSE_TABLE,
  [ROOK]: ROOK_TABLE,
  [CANNON]: CANNON_TABLE,
  [ADVISOR]: ADVISOR_TABLE,
  [BISHOP]: BISHOP_TABLE,
  [KING]: KING_TABLE,
}

// ─── Zobrist 置换表 ──────────────────────────────────

class TranspositionTable {
  constructor(size = 1 << 20) {
    this.size = size
    this.table = new Map()
    this.hits = 0
    this.misses = 0
  }

  get(key) {
    return this.table.get(key)
  }

  set(key, value) {
    this.table.set(key, value)
    if (this.table.size > this.size * 2) {
      this._clean()
    }
  }

  _clean() {
    const entries = [...this.table.entries()]
    entries.sort((a, b) => (b[1].depth || 0) - (a[1].depth || 0))
    this.table = new Map(entries.slice(0, this.size))
  }

  reset() {
    this.table.clear()
    this.hits = 0
    this.misses = 0
  }

  getStats() {
    return { size: this.table.size, hits: this.hits, misses: this.misses }
  }
}

// Zobrist hashing
class ZobristHash {
  constructor() {
    this.rand = new Map()
    this._init()
  }

  _rand(seed) {
    let s = seed
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      return s
    }
  }

  _init() {
    const rng = this._rand(42)
    const types = [KING, ADVISOR, BISHOP, HORSE, ROOK, CANNON, PAWN]
    const colors = [RED, BLACK]

    for (const type of types) {
      this.rand.set(type, {})
      for (const color of colors) {
        const arr = new Int32Array(ROWS * COLS)
        for (let i = 0; i < ROWS * COLS; i++) {
          arr[i] = rng()
        }
        this.rand.get(type)[color] = arr
      }
    }
    this.side = new Int32Array(2)
    this.side[0] = rng()
    this.side[1] = rng()
  }

  hash(board, turn) {
    let h = this.side[turn === RED ? 0 : 1]
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = board[r][c]
        if (p) {
          const t = this.rand.get(p.type)
          if (t && t[p.color]) {
            h ^= t[p.color][r * COLS + c]
          }
        }
      }
    }
    return h
  }
}

const zobrist = new ZobristHash()
const tt = new TranspositionTable()

// ─── 评价函数 ─────────────────────────────────────────

export function evaluate(board) {
  let score = 0
  let redKing = null
  let blackKing = null
  let redGuards = 0
  let blackGuards = 0

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (!p) continue

      const val = PIECE_VALUES[p.type] || 0
      let posVal = 0

      if (POS_TABLES[p.type]) {
        const table = POS_TABLES[p.type]
        if (p.color === RED) {
          posVal = table[r][c] * 5
        } else {
          posVal = table[ROWS - 1 - r][COLS - 1 - c] * 5
        }
      }

      if (p.type === PAWN) {
        const crossed = p.color === RED ? r <= 4 : r >= 5
        if (crossed) posVal += 30
      }

      if (p.type === KING) {
        if (p.color === RED) redKing = { row: r, col: c }
        else blackKing = { row: r, col: c }
      }

      // 在遍历中统计护卫（仕/相在己方半场的数量）
      if (p.type === ADVISOR || p.type === BISHOP) {
        if (p.color === RED && r >= 5) redGuards++
        else if (p.color === BLACK && r <= 4) blackGuards++
      }

      const total = val + posVal
      if (p.color === RED) score += total
      else score -= total
    }
  }

  // ─── 王的安全性 ──────────────────────────────────
  // 护卫奖励：每个己方仕/相 +20
  score += redGuards * 20
  score -= blackGuards * 20

  if (redKing) {
    // 敌方马车炮靠近红帅的惩罚
    let threat = 0
    const rMin = Math.max(0, redKing.row - 2)
    const rMax = Math.min(ROWS - 1, redKing.row + 2)
    const cMin = Math.max(0, redKing.col - 2)
    const cMax = Math.min(COLS - 1, redKing.col + 2)
    for (let rr = rMin; rr <= rMax; rr++) {
      for (let cc = cMin; cc <= cMax; cc++) {
        const p = board[rr][cc]
        if (p && p.color === BLACK) {
          if (p.type === ROOK) threat += 10
          else if (p.type === CANNON) threat += 6
          else if (p.type === HORSE) threat += 8
        }
      }
    }
    score -= threat
  }

  if (blackKing) {
    let threat = 0
    const rMin = Math.max(0, blackKing.row - 2)
    const rMax = Math.min(ROWS - 1, blackKing.row + 2)
    const cMin = Math.max(0, blackKing.col - 2)
    const cMax = Math.min(COLS - 1, blackKing.col + 2)
    for (let rr = rMin; rr <= rMax; rr++) {
      for (let cc = cMin; cc <= cMax; cc++) {
        const p = board[rr][cc]
        if (p && p.color === RED) {
          if (p.type === ROOK) threat += 10
          else if (p.type === CANNON) threat += 6
          else if (p.type === HORSE) threat += 8
        }
      }
    }
    score += threat
  }

  // Flying general penalty
  if (redKing && blackKing && redKing.col === blackKing.col) {
    const between = countBetween(board, redKing.row, redKing.col, blackKing.row, blackKing.col)
    if (between === 0) {
      score += redKing.row > blackKing.row ? -1000 : 1000
    }
  }

  return score
}

function countBetween(board, r1, c1, r2, c2) {
  let count = 0
  if (r1 === r2) {
    const minC = Math.min(c1, c2)
    const maxC = Math.max(c1, c2)
    for (let c = minC + 1; c < maxC; c++) {
      if (board[r1][c] !== null) count++
    }
  } else if (c1 === c2) {
    const minR = Math.min(r1, r2)
    const maxR = Math.max(r1, r2)
    for (let r = minR + 1; r < maxR; r++) {
      if (board[r][c1] !== null) count++
    }
  }
  return count
}

// ─── 走法排序 ────────────────────────────────────────

const MVV_LVA = {
  [KING]: 100, [ROOK]: 50, [CANNON]: 40, [HORSE]: 35,
  [BISHOP]: 20, [ADVISOR]: 20, [PAWN]: 10,
}

function scoreMove(board, move) {
  let score = 0
  const captured = board[move.toRow][move.toCol]
  if (captured) {
    score += (MVV_LVA[captured.type] || 0) * 10 - (MVV_LVA[board[move.fromRow][move.fromCol].type] || 0)
  }
  const p = board[move.fromRow][move.fromCol]
  if (p && p.type === PAWN) {
    if (p.color === RED && move.toRow <= 4) score += 5
    if (p.color === BLACK && move.toRow >= 5) score += 5
  }
  return score
}

// ─── 坐席搜索 (Quiescence Search) ────────────────────

function quiescenceSearch(board, alpha, beta, isMaximizing, color) {
  const standPat = evaluate(board)

  if (isMaximizing) {
    if (standPat >= beta) return beta
    if (standPat > alpha) alpha = standPat
  } else {
    if (standPat <= alpha) return alpha
    if (standPat < beta) beta = standPat
  }

  const enemyColor = color === RED ? BLACK : RED
  const moves = getAllMoves(board, color).filter(m => board[m.toRow][m.toCol] !== null)

  if (moves.length === 0) return standPat
  moves.sort((a, b) => scoreMove(board, b) - scoreMove(board, a))

  const maxQS = Math.min(moves.length, 8)

  if (isMaximizing) {
    for (let i = 0; i < maxQS; i++) {
      const move = moves[i]
      const captured = board[move.toRow][move.toCol]
      board[move.toRow][move.toCol] = board[move.fromRow][move.fromCol]
      board[move.fromRow][move.fromCol] = null

      const score = quiescenceSearch(board, alpha, beta, false, enemyColor)

      board[move.fromRow][move.fromCol] = board[move.toRow][move.toCol]
      board[move.toRow][move.toCol] = captured

      if (score > alpha) alpha = score
      if (alpha >= beta) break
    }
    return alpha
  } else {
    for (let i = 0; i < maxQS; i++) {
      const move = moves[i]
      const captured = board[move.toRow][move.toCol]
      board[move.toRow][move.toCol] = board[move.fromRow][move.fromCol]
      board[move.fromRow][move.fromCol] = null

      const score = quiescenceSearch(board, alpha, beta, true, enemyColor)

      board[move.fromRow][move.fromCol] = board[move.toRow][move.toCol]
      board[move.toRow][move.toCol] = captured

      if (score < beta) beta = score
      if (beta <= alpha) break
    }
    return beta
  }
}

// ─── Alpha-Beta 搜索 (含置换表) ──────────────────────

let searchStates = 0

function alphaBeta(board, depth, alpha, beta, isMaximizing, color) {
  searchStates++

  // 查置换表
  const key = zobrist.hash(board, color)
  const ttEntry = tt.get(key)
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === 'exact') {
      tt.hits++
      return { score: ttEntry.score, move: ttEntry.move }
    }
    if (ttEntry.flag === 'lower' && ttEntry.score > alpha) alpha = ttEntry.score
    if (ttEntry.flag === 'upper' && ttEntry.score < beta) beta = ttEntry.score
    if (alpha >= beta) {
      tt.hits++
      return { score: ttEntry.score, move: ttEntry.move }
    }
  }

  // 坐席搜索 (到达深度后)
  if (depth === 0) {
    const qsScore = quiescenceSearch(board, alpha - 50, beta + 50, isMaximizing, color)
    return { score: qsScore, move: null }
  }

  const enemyColor = color === RED ? BLACK : RED
  const moves = getAllMoves(board, color)

  if (moves.length === 0) {
    if (isMaximizing) {
      return { score: -99999 + (4 - depth), move: null }
    } else {
      return { score: 99999 - (4 - depth), move: null }
    }
  }

  moves.sort((a, b) => scoreMove(board, b) - scoreMove(board, a))

  let bestMove = moves[0]
  let flag = 'upper'
  let bestScore = isMaximizing ? -Infinity : Infinity

  if (isMaximizing) {
    for (const move of moves) {
      const captured = board[move.toRow][move.toCol]
      board[move.toRow][move.toCol] = board[move.fromRow][move.fromCol]
      board[move.fromRow][move.fromCol] = null

      // 应将延伸：如果这步棋将军，深度不减（等效加深 1 层），最多延伸至 depth=1
      const givesCheck = depth > 1 && isInCheck(board, enemyColor)
      const nextDepth = givesCheck ? depth : depth - 1

      const result = alphaBeta(board, nextDepth, alpha, beta, false, enemyColor)

      board[move.fromRow][move.fromCol] = board[move.toRow][move.toCol]
      board[move.toRow][move.toCol] = captured

      if (result.score > bestScore) {
        bestScore = result.score
        bestMove = move
        flag = 'exact'
      }
      alpha = Math.max(alpha, result.score)
      if (beta <= alpha) {
        flag = 'lower'
        break
      }
    }
  } else {
    for (const move of moves) {
      const captured = board[move.toRow][move.toCol]
      board[move.toRow][move.toCol] = board[move.fromRow][move.fromCol]
      board[move.fromRow][move.fromCol] = null

      const givesCheck = depth > 1 && isInCheck(board, enemyColor)
      const nextDepth = givesCheck ? depth : depth - 1

      const result = alphaBeta(board, nextDepth, alpha, beta, true, enemyColor)

      board[move.fromRow][move.fromCol] = board[move.toRow][move.toCol]
      board[move.toRow][move.toCol] = captured

      if (result.score < bestScore) {
        bestScore = result.score
        bestMove = move
        flag = 'exact'
      }
      beta = Math.min(beta, result.score)
      if (beta <= alpha) {
        flag = 'upper'
        break
      }
    }
  }

  if (Math.abs(bestScore) < 50000) {
    tt.set(key, { score: bestScore, depth, flag, move: bestMove })
  }

  return { score: bestScore, move: bestMove }
}

// ─── 迭代加深 ────────────────────────────────────────

function iterativeDeepening(board, color, maxDepth, onProgress) {
  searchStates = 0
  const boardCopy = cloneBoard(board)
  const isMaximizing = color === RED

  let bestResult = null

  for (let d = 1; d <= maxDepth; d++) {
    const startTime = performance.now()
    const result = alphaBeta(boardCopy, d, -Infinity, Infinity, isMaximizing, color)
    const elapsed = performance.now() - startTime

    if (result.move) {
      bestResult = result
    }

    if (onProgress) {
      onProgress({
        depth: d,
        score: result.score,
        elapsed,
        states: searchStates,
        move: result.move ? {
          fromRow: result.move.fromRow,
          fromCol: result.move.fromCol,
          toRow: result.move.toRow,
          toCol: result.move.toCol,
        } : null,
      })
    }

    if (elapsed > 2000 && d < maxDepth) break
    if (Math.abs(result.score) > 90000) break
  }

  return bestResult
}

// ─── 公共接口 ─────────────────────────────────────────

/**
 * 查找最佳走法 (使用迭代加深)
 * @param {Array} board
 * @param {string} color
 * @param {number} difficulty (1-5)
 * @param {function} [onProgress]
 */


export function findBestMove(board, color, difficulty = 2, onProgress) {
  const depths = { 1: 2, 2: 4, 3: 6 }
  const maxDepth = depths[difficulty] || 3

  const result = iterativeDeepening(board, color, maxDepth, onProgress)

  if (result && result.move && result.move.fromRow !== undefined) {
    return {
      fromRow: result.move.fromRow,
      fromCol: result.move.fromCol,
      toRow: result.move.toRow,
      toCol: result.move.toCol,
      score: result.score,
      depth: maxDepth,
      states: searchStates,
    }
  }
  return null
}

/** 重置置换表 */
export function resetTT() { tt.reset() }

/** 获取搜索统计 */
export function getSearchStats() { return tt.getStats() }

/** 获取棋盘 hash */
export function getBoardHash(board, turn) { return zobrist.hash(board, turn) }
