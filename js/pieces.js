// ============================================================
// 象棋 - 棋子走法规则引擎
// ============================================================
import {
  KING, ADVISOR, BISHOP, HORSE, ROOK, CANNON, PAWN,
  RED, BLACK, COLS, ROWS,
  RED_PALACE, BLACK_PALACE,
} from './constants.js'

// ─── 辅助函数 ────────────────────────────────────────

/** 检查坐标是否在棋盘内 */
function inBoard(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS
}

/** 检查坐标是否在九宫格内 */
function inPalace(row, col, color) {
  const p = color === RED ? RED_PALACE : BLACK_PALACE
  return row >= p.rowMin && row <= p.rowMax && col >= p.colMin && col <= p.colMax
}

/** 该位置是否有己方棋子 */
function isFriend(board, row, col, color) {
  const p = board[row][col]
  return p !== null && p.color === color
}

/** 该位置是否有敌方棋子 */
function isEnemy(board, row, col, color) {
  const p = board[row][col]
  return p !== null && p.color !== color
}

/** 获取线路上两个位置之间的空格数（不含端点） */
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

// ─── 各棋子走法生成 ──────────────────────────────────

// 方向向量
const DIRS = {
  ORTH: [[-1, 0], [1, 0], [0, -1], [0, 1]],   // 上下左右
  DIAG: [[-1, -1], [-1, 1], [1, -1], [1, 1]], // 对角线
}

/**
 * 生成某个位置棋子的所有合法走法
 * @param {Array} board - 棋盘 2D 数组
 * @param {number} row
 * @param {number} col
 * @param {boolean} [checkLegality=true] - 是否校验走完后不被将军
 * @param {object|null} [kingPos=null] - 缓存将/帅位置，可选
 * @returns {Array<{row:number, col:number}>}
 */
export function getValidMoves(board, row, col, checkLegality = true, kingPos = null) {
  const piece = board[row][col]
  if (!piece) return []

  const { type, color } = piece
  const rawMoves = getRawMoves(board, row, col, type, color)

  if (!checkLegality) return rawMoves

  // 过滤掉走后自己被将军的走法
  const legal = []
  for (const m of rawMoves) {
    if (!isMoveIllegal(board, row, col, m.row, m.col, color, kingPos)) {
      legal.push(m)
    }
  }
  return legal
}

/** 生成不考虑将军的原生走法 */
function getRawMoves(board, row, col, type, color) {
  switch (type) {
    case KING:    return kingMoves(board, row, col, color)
    case ADVISOR: return advisorMoves(board, row, col, color)
    case BISHOP:  return bishopMoves(board, row, col, color)
    case HORSE:   return horseMoves(board, row, col, color)
    case ROOK:    return rookMoves(board, row, col, color)
    case CANNON:  return cannonMoves(board, row, col, color)
    case PAWN:    return pawnMoves(board, row, col, color)
    default: return []
  }
}

/** 将/帅：九宫格内一步直走 */
function kingMoves(board, row, col, color) {
  const moves = []
  for (const [dr, dc] of DIRS.ORTH) {
    const nr = row + dr
    const nc = col + dc
    if (inPalace(nr, nc, color) && !isFriend(board, nr, nc, color)) {
      moves.push({ row: nr, col: nc })
    }
  }
  return moves
}

/** 士/仕：九宫格内一步斜走 */
function advisorMoves(board, row, col, color) {
  const moves = []
  for (const [dr, dc] of DIRS.DIAG) {
    const nr = row + dr
    const nc = col + dc
    if (inPalace(nr, nc, color) && !isFriend(board, nr, nc, color)) {
      moves.push({ row: nr, col: nc })
    }
  }
  return moves
}

/** 相/象：走"田"字，不能过河，有塞象眼 */
function bishopMoves(board, row, col, color) {
  const moves = []
  const directions = [[-2, -2], [-2, 2], [2, -2], [2, 2]]
  const blocks = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
  for (let i = 0; i < 4; i++) {
    const nr = row + directions[i][0]
    const nc = col + directions[i][1]
    const br = row + blocks[i][0]
    const bc = col + blocks[i][1]
    if (!inBoard(nr, nc)) continue
    // 相不能过河
    if (color === RED && nr < 5) continue
    if (color === BLACK && nr > 4) continue
    if (board[br][bc] !== null) continue // 塞象眼
    if (!isFriend(board, nr, nc, color)) {
      moves.push({ row: nr, col: nc })
    }
  }
  return moves
}

/** 馬/傌：走"日"字，有蹩马腿 */
function horseMoves(board, row, col, color) {
  const moves = []
  // 8 个可能的 L 形走法，以及对应的蹩脚位置
  const jumps = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ]
  const legs = [
    [-1, 0], [-1, 0], [0, -1], [0, 1],
    [0, -1], [0, 1], [1, 0], [1, 0],
  ]
  for (let i = 0; i < 8; i++) {
    const nr = row + jumps[i][0]
    const nc = col + jumps[i][1]
    const lr = row + legs[i][0]
    const lc = col + legs[i][1]
    if (!inBoard(nr, nc)) continue
    if (board[lr][lc] !== null) continue // 蹩马腿
    if (!isFriend(board, nr, nc, color)) {
      moves.push({ row: nr, col: nc })
    }
  }
  return moves
}

/** 車/俥：直线走，不限步数 */
function rookMoves(board, row, col, color) {
  const moves = []
  for (const [dr, dc] of DIRS.ORTH) {
    let nr = row + dr
    let nc = col + dc
    while (inBoard(nr, nc)) {
      if (isFriend(board, nr, nc, color)) break
      moves.push({ row: nr, col: nc })
      if (isEnemy(board, nr, nc, color)) break
      nr += dr
      nc += dc
    }
  }
  return moves
}

/** 砲/炮：直线走同车，吃子需隔一子 */
function cannonMoves(board, row, col, color) {
  const moves = []
  for (const [dr, dc] of DIRS.ORTH) {
    let nr = row + dr
    let nc = col + dc
    let jumped = false
    while (inBoard(nr, nc)) {
      if (!jumped) {
        if (board[nr][nc] === null) {
          moves.push({ row: nr, col: nc })
        } else {
          jumped = true // 找到炮架
        }
      } else {
        if (board[nr][nc] !== null) {
          if (isEnemy(board, nr, nc, color)) {
            moves.push({ row: nr, col: nc })
          }
          break
        }
      }
      nr += dr
      nc += dc
    }
  }
  return moves
}

/** 卒/兵：过河前只能前进，过河后可前进/左/右 */
function pawnMoves(board, row, col, color) {
  const moves = []
  const forward = color === RED ? -1 : 1
  const crossed = color === RED ? row <= 4 : row >= 5

  // 前进
  const nr = row + forward
  if (inBoard(nr, col) && !isFriend(board, nr, col, color)) {
    moves.push({ row: nr, col })
  }

  // 过河后可左右
  if (crossed) {
    for (const dc of [-1, 1]) {
      const nc = col + dc
      if (inBoard(row, nc) && !isFriend(board, row, nc, color)) {
        moves.push({ row, col: nc })
      }
    }
  }
  return moves
}

// ─── 将军与将杀检测 ──────────────────────────────────

/** 找到某方将/帅的位置 */
export function findKing(board, color) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (p && p.type === KING && p.color === color) {
        return { row: r, col: c }
      }
    }
  }
  return null
}

/** 判断某方是否被将军 */
export function isInCheck(board, color) {
  const king = findKing(board, color)
  if (!king) return true // 将被吃了也算将军（将杀）
  const enemyColor = color === RED ? BLACK : RED

  // 遍历所有敌方棋子看能否吃到将
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (p && p.color === enemyColor) {
        const moves = getRawMoves(board, r, c, p.type, p.color)
        for (const m of moves) {
          if (m.row === king.row && m.col === king.col) return true
        }
      }
    }
  }

  // 检查"对面笑"规则
  const enemyKing = findKing(board, enemyColor)
  if (enemyKing && enemyKing.col === king.col &&
      countBetween(board, king.row, king.col, enemyKing.row, enemyKing.col) === 0) {
    return true
  }

  return false
}

/** 判断某方是否被将杀 */
export function isCheckmate(board, color) {
  // 先看是否被将军，如果不是将军就不算将杀
  if (!isInCheck(board, color)) return false

  // 看是否有任何走法可以解除将军
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (p && p.color === color) {
        const moves = getValidMoves(board, r, c, true)
        if (moves.length > 0) return false
      }
    }
  }
  return true
}

/** 判断某方是否无子可走（困毙） */
export function isStalemate(board, color) {
  if (isInCheck(board, color)) return false // 将军状态下不判断困毙
  
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (p && p.color === color) {
        const moves = getValidMoves(board, r, c, true)
        if (moves.length > 0) return false
      }
    }
  }
  return true
}

/**
 * 检查走这步棋后是否会导致己方被将军（或飞将）
 * @param {Array} board - 原始棋盘
 * @param {number} fromRow
 * @param {number} fromCol
 * @param {number} toRow
 * @param {number} toCol
 * @param {string} color - 走棋方
 * @param {object|null} kingPos - 当前己方将位置（可选，用于性能）
 * @returns {boolean} true=非法（走后被将）
 */
function isMoveIllegal(board, fromRow, fromCol, toRow, toCol, color, kingPos = null) {
  // 快速模拟走棋
  const captured = board[toRow][toCol]
  const movingPiece = board[fromRow][fromCol]
  
  // 执行走棋
  board[toRow][toCol] = movingPiece
  board[fromRow][fromCol] = null

  // 如果走的是将，更新将的位置
  let thisKingPos = kingPos
  if (movingPiece.type === KING) {
    thisKingPos = { row: toRow, col: toCol }
  }

  // 检查走后是否被将军
  const inCheck = isInCheck(board, color)

  // 恢复棋盘
  board[fromRow][fromCol] = movingPiece
  board[toRow][toCol] = captured

  return inCheck
}

/** 深拷贝棋盘 */
export function cloneBoard(board) {
  return board.map(row => row.map(cell => cell ? { ...cell } : null))
}

/** 创建初始棋盘 */
export function createInitialBoard() {
  const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null))

  const p = (type, color) => ({ type, color })

  // 黑方（上方）
  board[0][0] = p(ROOK, BLACK);   board[0][1] = p(HORSE, BLACK)
  board[0][2] = p(BISHOP, BLACK); board[0][3] = p(ADVISOR, BLACK)
  board[0][4] = p(KING, BLACK);   board[0][5] = p(ADVISOR, BLACK)
  board[0][6] = p(BISHOP, BLACK); board[0][7] = p(HORSE, BLACK)
  board[0][8] = p(ROOK, BLACK)
  board[2][1] = p(CANNON, BLACK); board[2][7] = p(CANNON, BLACK)
  board[3][0] = p(PAWN, BLACK);   board[3][2] = p(PAWN, BLACK)
  board[3][4] = p(PAWN, BLACK);   board[3][6] = p(PAWN, BLACK)
  board[3][8] = p(PAWN, BLACK)

  // 红方（下方）
  board[9][0] = p(ROOK, RED);   board[9][1] = p(HORSE, RED)
  board[9][2] = p(BISHOP, RED); board[9][3] = p(ADVISOR, RED)
  board[9][4] = p(KING, RED);   board[9][5] = p(ADVISOR, RED)
  board[9][6] = p(BISHOP, RED); board[9][7] = p(HORSE, RED)
  board[9][8] = p(ROOK, RED)
  board[7][1] = p(CANNON, RED); board[7][7] = p(CANNON, RED)
  board[6][0] = p(PAWN, RED);   board[6][2] = p(PAWN, RED)
  board[6][4] = p(PAWN, RED);   board[6][6] = p(PAWN, RED)
  board[6][8] = p(PAWN, RED)

  return board
}

/** 获取某方所有合法走法（用于 AI） */
export function getAllMoves(board, color) {
  const moves = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (p && p.color === color) {
        const pieceMoves = getValidMoves(board, r, c, true)
        for (const m of pieceMoves) {
          moves.push({ fromRow: r, fromCol: c, toRow: m.row, toCol: m.col })
        }
      }
    }
  }
  return moves
}
