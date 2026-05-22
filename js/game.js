// ============================================================
// 象棋 - 游戏状态管理
// ============================================================
import { RED, BLACK, KING, PIECE_CHARS } from './constants.js'
import {
  getValidMoves, isInCheck, isCheckmate, isStalemate,
  cloneBoard, createInitialBoard,
} from './pieces.js'

/**
 * 游戏状态类
 */
export class Game {
  constructor() {
    this.reset()
  }

  /** 重置游戏 */
  reset() {
    /** @type {Array<Array<object|null>>} */
    this.board = createInitialBoard()
    /** @type {string} 当前走棋方 */
    this.turn = RED
    /** @type {Array<object>} 走棋历史 */
    this.history = []
    /** @type {object|null} 当前选中的棋子位置 */
    this.selected = null
    /** @type {string|null} 游戏状态: null / 'check' / 'checkmate' / 'stalemate' */
    this.status = null
    /** @type {Array<object>} 被吃的红方棋子列表 */
    this.capturedRed = []
    /** @type {Array<object>} 被吃的黑方棋子列表 */
    this.capturedBlack = []
    /** @type {number} 走棋步数 */
    this.moveCount = 0
    /** @type {boolean} 是否是 AI 模式 */
    this.aiMode = false
    this.aiColor = BLACK
    this.aiThinking = false
    this.aiDifficulty = 2
  }

  /** 获取当前选中棋子的合法走法 */
  getSelectedMoves() {
    if (!this.selected) return []
    return getValidMoves(this.board, this.selected.row, this.selected.col, true)
  }

  /** 尝试走棋，返回是否成功 */
  tryMove(fromRow, fromCol, toRow, toCol) {
    const piece = this.board[fromRow][fromCol]
    if (!piece) return false
    if (piece.color !== this.turn) return false

    const moves = getValidMoves(this.board, fromRow, fromCol, true)
    const valid = moves.some(m => m.row === toRow && m.col === toCol)
    if (!valid) return false

    // 执行走棋
    this.makeMove(fromRow, fromCol, toRow, toCol)
    return true
  }

  /** 内部：执行走棋并更新状态 */
  makeMove(fromRow, fromCol, toRow, toCol) {
    const piece = this.board[fromRow][fromCol]
    const captured = this.board[toRow][toCol]
    const enemyColor = piece.color === RED ? BLACK : RED

    // 记录走法（用于悔棋和动画）
    this.history.push({
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      piece: { ...piece },
      captured: captured ? { ...captured } : null,
    })

    // 移动棋子
    this.board[toRow][toCol] = piece
    this.board[fromRow][fromCol] = null

    // 记录被吃棋子
    if (captured) {
      if (captured.color === RED) {
        this.capturedRed.push(captured)
      } else {
        this.capturedBlack.push(captured)
      }
    }

    this.moveCount++
    this.selected = null

    // 更新状态
    this.turn = enemyColor

    if (isCheckmate(this.board, enemyColor)) {
      this.status = 'checkmate'
    } else if (isStalemate(this.board, enemyColor)) {
      this.status = 'stalemate'
    } else if (isInCheck(this.board, enemyColor)) {
      this.status = 'check'
    } else {
      this.status = null
    }
  }

  /** 悔棋 */
  undo() {
    if (this.history.length === 0) return false
    // AI 模式下一次悔两步（AI 的 + 玩家的）
    if (this.aiMode && this.history.length >= 2 && !this.aiThinking) {
      this._undoOne()
      this._undoOne()
    } else {
      this._undoOne()
    }
    this.selected = null
    return true
  }

  /** 内部：悔一步 */
  _undoOne() {
    const last = this.history.pop()
    if (!last) return

    // 恢复棋子位置
    this.board[last.from.row][last.from.col] = last.piece
    this.board[last.to.row][last.to.col] = last.captured

    // 从被吃列表中移除
    if (last.captured) {
      const list = last.captured.color === RED ? this.capturedRed : this.capturedBlack
      // 移除最后一个匹配的
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].type === last.captured.type) {
          list.splice(i, 1)
          break
        }
      }
    }

    this.moveCount--
    this.turn = last.piece.color
    this.status = null

    // 重新检查将军状态
    const enemyColor = last.piece.color === RED ? BLACK : RED
    if (isInCheck(this.board, enemyColor)) {
      this.status = 'check'
    }
  }

  /** AI 走一步 */
  aiMove(fromRow, fromCol, toRow, toCol) {
    this.makeMove(fromRow, fromCol, toRow, toCol)
  }

  /** 获取移动描述文本（用于界面显示） */
  getMoveText(move) {
    const piece = move.piece
    const char = PIECE_CHARS[piece.color][piece.type]
    const colNames = ['1','2','3','4','5','6','7','8','9']
    const from = colNames[move.from.col] + (10 - move.from.row)
    const to = colNames[move.to.col] + (10 - move.to.row)
    const capture = move.captured ? '×' : '→'
    return `${char}${from}${capture}${to}`
  }
}
