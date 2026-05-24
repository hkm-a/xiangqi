// ============================================================
// 象棋 - FEN 导入/导出
// ============================================================
// FEN (Forsyth-Edwards Notation) 是中国象棋标准局面表示法
//
// 初始局面:
//   rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1
//
// 格式:
//   第1段: 棋盘 (小写=黑方, 大写=红方, 数字=连续空格数, / 分隔行)
//   第2段: 走棋方 (w=红, b=黑)
//   第3段: 王车易位 (中国象棋不用, 用 -)
//   第4段: 过路兵 (中国象棋不用, 用 -)
//   第5段: 半回合数 (自然限着)
//   第6段: 回合数
// ============================================================

import { COLS, ROWS, RED, BLACK } from './constants.js'
import {
  KING, ADVISOR, BISHOP, HORSE, ROOK, CANNON, PAWN,
} from './constants.js'

// ─── 棋子 ↔ 字母映射 ────────────────────────────────

const PIECE_TO_LETTER = {
  [RED]: {
    [KING]:    'K',
    [ADVISOR]: 'A',
    [BISHOP]:  'B',
    [HORSE]:   'N',  // kNight
    [ROOK]:    'R',
    [CANNON]:  'C',
    [PAWN]:    'P',
  },
  [BLACK]: {
    [KING]:    'k',
    [ADVISOR]: 'a',
    [BISHOP]:  'b',
    [HORSE]:   'n',
    [ROOK]:    'r',
    [CANNON]:  'c',
    [PAWN]:    'p',
  },
}

const LETTER_TO_PIECE = {}
for (const color of [RED, BLACK]) {
  for (const [type, letter] of Object.entries(PIECE_TO_LETTER[color])) {
    LETTER_TO_PIECE[letter] = { type, color }
  }
}

// ─── 标准初始局面 FEN ───────────────────────────────

export const START_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1'

// ─── 棋盘 → FEN ─────────────────────────────────────

/**
 * 将棋盘转为 FEN 字符串
 * @param {Array<Array<object|null>>} board - 10×9 棋盘
 * @param {string} turn - 当前走棋方 (RED/BLACK)
 * @param {number} halfMove - 半回合数 (默认 0)
 * @param {number} fullMove - 回合数 (默认 1)
 * @returns {string} FEN 字符串
 */
export function boardToFEN(board, turn, halfMove = 0, fullMove = 1) {
  const rows = []

  for (let r = 0; r < ROWS; r++) {
    let rowStr = ''
    let emptyCount = 0

    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c]
      if (piece) {
        if (emptyCount > 0) {
          rowStr += emptyCount
          emptyCount = 0
        }
        const letter = (PIECE_TO_LETTER[piece.color] || {})[piece.type]
        rowStr += letter || '?'
      } else {
        emptyCount++
      }
    }
    if (emptyCount > 0) {
      rowStr += emptyCount
    }
    rows.push(rowStr)
  }

  const activeColor = turn === RED ? 'w' : 'b'
  return `${rows.join('/')} ${activeColor} - - ${halfMove} ${fullMove}`
}

// ─── FEN → 棋盘 ─────────────────────────────────────

/**
 * 将 FEN 字符串解析为棋盘
 * @param {string} fen
 * @returns {Array<Array<object|null>>|null} 棋盘数组或 null（无效 FEN）
 */
export function fenToBoard(fen) {
  if (!fen || typeof fen !== 'string') return null

  const parts = fen.trim().split(/\s+/)
  if (parts.length < 2) return null

  const boardStr = parts[0]
  const rows = boardStr.split('/')
  if (rows.length !== ROWS) return null

  const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null))

  for (let r = 0; r < ROWS; r++) {
    let c = 0
    for (const ch of rows[r]) {
      if (c >= COLS) return null

      if (ch >= '1' && ch <= '9') {
        // 数字 = 空格
        c += parseInt(ch, 10)
      } else {
        const mapping = LETTER_TO_PIECE[ch]
        if (!mapping) return null // 无效字符
        board[r][c] = { type: mapping.type, color: mapping.color }
        c++
      }
    }
    if (c !== COLS) return null // 列数不对
  }

  return board
}

/**
 * 从 FEN 中提取走棋方
 * @param {string} fen
 * @returns {string|null} RED 或 BLACK
 */
export function fenToTurn(fen) {
  if (!fen || typeof fen !== 'string') return null
  const parts = fen.trim().split(/\s+/)
  if (parts.length < 2) return null
  const color = parts[1]
  if (color === 'w') return RED
  if (color === 'b') return BLACK
  return null
}

// ─── 验证 ────────────────────────────────────────────

const VALID_PIECE_CHARS = new Set([
  'K', 'A', 'B', 'N', 'R', 'C', 'P',
  'k', 'a', 'b', 'n', 'r', 'c', 'p',
])

/**
 * 验证 FEN 字符串是否合法
 * @param {string} fen
 * @returns {boolean}
 */
export function isValidFEN(fen) {
  if (!fen || typeof fen !== 'string') return false

  const parts = fen.trim().split(/\s+/)
  if (parts.length < 2) return false

  const boardStr = parts[0]
  const rows = boardStr.split('/')
  if (rows.length !== ROWS) return false

  // Check active color
  if (parts[1] !== 'w' && parts[1] !== 'b') return false

  for (const row of rows) {
    if (row.length === 0) return false
    let colCount = 0
    for (const ch of row) {
      if (ch >= '1' && ch <= '9') {
        colCount += parseInt(ch, 10)
      } else if (VALID_PIECE_CHARS.has(ch)) {
        colCount++
      } else {
        return false // 非法字符
      }
    }
    if (colCount !== COLS) return false // 列数错误
  }

  return true
}
