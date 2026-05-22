// ============================================================
// 象棋 - AI 引擎（Minimax + Alpha-Beta 剪枝）
// ============================================================
import { RED, BLACK, KING, ROOK, CANNON, HORSE, BISHOP, ADVISOR, PAWN,
  COLS, ROWS, PIECE_VALUES } from './constants.js'
import { cloneBoard, getAllMoves } from './pieces.js'

// ─── 棋子位置价值表（从红方视角，红方在下方 rows 5-9） ──

// 兵/卒（过河前价值低，过河后价值高，中路兵价值略高）
const PAWN_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [9, 10, 11, 13, 15, 13, 11, 10,  9],
  [7,  8,  9, 11, 13, 11,  9,  8,  7],
  [3,  5,  7,  9, 11,  9,  7,  5,  3],
  [1,  3,  5,  7,  9,  7,  5,  3,  1],
]

// 馬/傌（中心位置价值高，边角低）
const HORSE_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [2,  4,  6,  8,  8,  8,  6,  4,  2],
  [4,  6, 10, 12, 12, 12, 10,  6,  4],
  [6,  8, 12, 14, 14, 14, 12,  8,  6],
  [8, 10, 14, 16, 16, 16, 14, 10,  8],
]

// 車/俥
const ROOK_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [6, 10, 14, 16, 18, 16, 14, 10,  6],
  [6, 10, 14, 16, 18, 16, 14, 10,  6],
  [6, 10, 14, 16, 18, 16, 14, 10,  6],
  [6, 10, 14, 16, 18, 16, 14, 10,  6],
]

// 砲/炮（炮架子价值高，宜有炮架）
const CANNON_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [4,  6,  8, 10, 12, 10,  8,  6,  4],
  [6,  8, 10, 12, 14, 12, 10,  8,  6],
  [4,  6,  8, 10, 12, 10,  8,  6,  4],
  [2,  4,  6,  8, 10,  8,  6,  4,  2],
]

// 仕/士（主要在九宫格内活动）
const ADVISOR_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  2,  0,  2,  0,  0,  0],
  [0,  0,  0,  0,  4,  0,  0,  0,  0],
  [0,  0,  0,  2,  0,  2,  0,  0,  0],
]

// 相/象（主要在己方半场活动）
const BISHOP_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  4,  0,  0,  0,  4,  0,  0],
  [0,  0,  0,  0,  0,  0,  0,  0,  0],
  [0,  0,  4,  0,  0,  0,  4,  0,  0],
  [0,  0,  0,  0,  6,  0,  0,  0,  0],
]

// 收集所有位置表
const POS_TABLES = {
  [PAWN]: PAWN_TABLE,
  [HORSE]: HORSE_TABLE,
  [ROOK]: ROOK_TABLE,
  [CANNON]: CANNON_TABLE,
  [ADVISOR]: ADVISOR_TABLE,
  [BISHOP]: BISHOP_TABLE,
}

// ─── 评价函数 ─────────────────────────────────────────

/**
 * 棋盘评价函数（从红方视角）
 * 正数 = 红方优势，负数 = 黑方优势
 */
function evaluate(board) {
  let score = 0
  const kingPos = { red: null, black: null }

  // 找将位置
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (p && p.type === KING) {
        kingPos[p.color] = { row: r, col: c }
      }
    }
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (!p) continue

      let val = PIECE_VALUES[p.type] || 0

      // 加位置价值（如果有对应表）
      if (POS_TABLES[p.type]) {
        const table = POS_TABLES[p.type]
        if (p.color === RED) {
          val += table[r][c] * 5
        } else {
          // 黑方对称翻转
          val += table[ROWS - 1 - r][COLS - 1 - c] * 5
        }
      }

      // 兵/卒过河加成分
      if (p.type === PAWN) {
        const crossed = p.color === RED ? r <= 4 : r >= 5
        if (crossed) val += 30
      }

      if (p.color === RED) {
        score += val
      } else {
        score -= val
      }
    }
  }

  return score
}

// ─── 走法排序（提升剪枝效率） ────────────────────────

const MVV_LVA = {
  [KING]: 100, [ROOK]: 50, [CANNON]: 40, [HORSE]: 35,
  [BISHOP]: 20, [ADVISOR]: 20, [PAWN]: 10,
}

function scoreMove(board, move) {
  let score = 0
  const captured = board[move.toRow][move.toCol]
  if (captured) {
    // 吃子价值 = 被吃子价值 × 10 - 己方子价值（MVV-LVA）
    score += (MVV_LVA[captured.type] || 0) * 10 - (MVV_LVA[board[move.fromRow][move.fromCol].type] || 0)
  }
  return score
}

// ─── Alpha-Beta 搜索 ──────────────────────────────────

let searchStates = 0
const MAX_DEPTH = 3

/**
 * Alpha-Beta 剪枝
 * @returns {{ score: number, move: object|null }}
 */
function alphaBeta(board, depth, alpha, beta, isMaximizing, color) {
  searchStates++

  // 终止条件
  if (depth === 0) {
    return { score: evaluate(board), move: null }
  }

  const enemyColor = color === RED ? BLACK : RED
  const moves = getAllMoves(board, color)

  // 无子可走（将杀或困毙）- 中国象棋规则下均为输棋
  if (moves.length === 0) {
    if (isMaximizing) {
      // 红方无子可走，红方输
      return { score: -99999 + (MAX_DEPTH - depth), move: null }
    } else {
      // 黑方无子可走，黑方输
      return { score: 99999 - (MAX_DEPTH - depth), move: null }
    }
  }

  // 走法排序
  moves.sort((a, b) => scoreMove(board, b) - scoreMove(board, a))

  let bestMove = moves[0]

  if (isMaximizing) {
    let maxEval = -Infinity
    for (const move of moves) {
      const captured = board[move.toRow][move.toCol]
      
      // 执行走棋
      board[move.toRow][move.toCol] = board[move.fromRow][move.fromCol]
      board[move.fromRow][move.fromCol] = null

      const result = alphaBeta(board, depth - 1, alpha, beta, false, enemyColor)

      // 恢复棋盘
      board[move.fromRow][move.fromCol] = board[move.toRow][move.toCol]
      board[move.toRow][move.toCol] = captured

      if (result.score > maxEval) {
        maxEval = result.score
        bestMove = move
      }
      alpha = Math.max(alpha, result.score)
      if (beta <= alpha) break // β 剪枝
    }
    return { score: maxEval, move: bestMove }
  } else {
    let minEval = Infinity
    for (const move of moves) {
      const captured = board[move.toRow][move.toCol]

      // 执行走棋
      board[move.toRow][move.toCol] = board[move.fromRow][move.fromCol]
      board[move.fromRow][move.fromCol] = null

      const result = alphaBeta(board, depth - 1, alpha, beta, true, enemyColor)

      // 恢复棋盘
      board[move.fromRow][move.fromCol] = board[move.toRow][move.toCol]
      board[move.toRow][move.toCol] = captured

      if (result.score < minEval) {
        minEval = result.score
        bestMove = move
      }
      beta = Math.min(beta, result.score)
      if (beta <= alpha) break // α 剪枝
    }
    return { score: minEval, move: bestMove }
  }
}

// ─── 公共接口 ─────────────────────────────────────────

/**
 * 查找最佳走法
 * @param {Array} board - 当前棋盘
 * @param {string} color - 当前走棋方
 * @param {number} difficulty - 难度 (1-3)
 * @returns {{ fromRow: number, fromCol: number, toRow: number, toCol: number }|null}
 */
export function findBestMove(board, color, difficulty = 2) {
  const depths = { 1: 2, 2: 3, 3: 4 }
  const depth = depths[difficulty] || 3

  searchStates = 0
  const boardCopy = cloneBoard(board)
  const isMaximizing = color === RED

  const result = alphaBeta(boardCopy, depth, -Infinity, Infinity, isMaximizing, color)
  
  console.log(`[AI] 搜索深度: ${depth}, 评估状态数: ${searchStates}, 评分: ${result.score}`)

  if (result.move && result.move.fromRow !== undefined) {
    return {
      fromRow: result.move.fromRow,
      fromCol: result.move.fromCol,
      toRow: result.move.toRow,
      toCol: result.move.toCol,
      score: result.score,
    }
  }
  return null
}
