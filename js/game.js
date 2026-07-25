// ============================================================
// 象棋 - 游戏状态管理
// ============================================================
import { RED, BLACK } from './constants.js'
import {
  getValidMoves, isInCheck, isCheckmate, isStalemate,
  createInitialBoard,
} from './pieces.js'
import { RepetitionDetector } from './perpetual.js'
import { boardToFEN, fenToBoard, fenToTurn, isValidFEN } from './fen.js'
import { formatDisplayMove, formatChineseMove } from './notation.js'

/**
 * 游戏状态类
 */
export class Game {
  constructor() {
    /** @type {RepetitionDetector} */
    this.repetition = new RepetitionDetector()
    /** @type {boolean} 棋盘是否翻转 (黑方视角) */
    this.flipped = false
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
    /** @type {string|null} 游戏状态: null / 'check' / 'checkmate' / 'stalemate' / 'draw' */
    this.status = null
    /** @type {string|null} 副状态: 'perpetual_check' / 'threefold' */
    this.subStatus = null
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

    if (this.repetition) this.repetition.reset()
  }

  /** 获取当前选中棋子的合法走法 */
  getSelectedMoves() {
    if (!this.selected) return []
    return getValidMoves(this.board, this.selected.row, this.selected.col, true)
  }

  /** 获取指定位置的合法走法 */
  getValidMovesFor(row, col) {
    return getValidMoves(this.board, row, col, true)
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

    // 记录走法（用于悔棋、记谱与动画）
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
    // 记录局面（走后、轮到对方时）并判定循环
    const gaveCheck = isInCheck(this.board, enemyColor)
    if (this.repetition) {
      this.repetition.record(this.board, this.turn, gaveCheck)
    }
    this.updateStatus()
  }

  /** 更新游戏状态 (公开方法，外部可直接调用) */
  updateStatus() {
    const color = this.turn
    this.subStatus = null

    if (isCheckmate(this.board, color)) {
      this.status = 'checkmate'
    } else if (isStalemate(this.board, color)) {
      this.status = 'stalemate'
    } else if (isInCheck(this.board, color)) {
      this.status = 'check'
    } else {
      this.status = null
    }

    // 检测循环局面（依赖 makeMove 中的 record）
    if (this.status !== 'checkmate' && this.status !== 'stalemate' && this.repetition) {
      if (this.repetition.getCount(this.board, this.turn) >= 3) {
        this.status = 'draw'
        this.subStatus = 'threefold'
      }
      const perpetual = this.repetition.isPerpetualCheck()
      if (perpetual) {
        // 长将方判负：当前 turn 是被将方，长将方是对方
        this.status = 'checkmate'
        this.subStatus = 'perpetual_check'
      }
    }
  }

  /**
   * 悔棋一步（仅撤销历史中的一手）
   * 人机「悔双方」由 UI 层连调两次，避免双重撤销
   */
  undo() {
    if (this.history.length === 0) return false
    this._undoOne()
    this.selected = null
    return true
  }

  /** 内部：悔一步 */
  _undoOne() {
    const last = this.history[this.history.length - 1]
    if (!last) return

    // 撤销走后局面的 repetition 记录（当前 board/turn 即走后状态）
    if (this.repetition) {
      this.repetition.unrecord(this.board, this.turn)
    }

    this.history.pop()

    // 恢复棋子位置
    this.board[last.from.row][last.from.col] = last.piece
    this.board[last.to.row][last.to.col] = last.captured

    // 从被吃列表中移除
    if (last.captured) {
      const list = last.captured.color === RED ? this.capturedRed : this.capturedBlack
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
    this.subStatus = null

    // 重新检查将军状态（走子方是否被将，一般否；恢复后轮到走子方）
    if (isInCheck(this.board, this.turn)) {
      this.status = 'check'
    }
  }

  /** AI 走一步 */
  aiMove(fromRow, fromCol, toRow, toCol) {
    this.makeMove(fromRow, fromCol, toRow, toCol)
  }

  /** 界面记谱 */
  getMoveText(move) {
    return formatDisplayMove(move)
  }

  /** 播报用口语与 TTS token */
  getSpokenMove(move) {
    return formatChineseMove(move)
  }

  /** 翻转棋盘 (180°) */
  flipBoard() {
    this.flipped = !this.flipped
  }

  /** 导出当前局面为 FEN */
  toFEN() {
    return boardToFEN(this.board, this.turn)
  }

  /** 从 FEN 导入局面 */
  fromFEN(fen) {
    if (!isValidFEN(fen)) return false
    const board = fenToBoard(fen)
    if (!board) return false
    const turn = fenToTurn(fen)
    if (!turn) return false

    this.board = board
    this.turn = turn
    this.history = []
    this.selected = null
    this.status = null
    this.subStatus = null
    this.capturedRed = []
    this.capturedBlack = []
    this.moveCount = 0
    this.repetition.reset()
    this.updateStatus()
    return true
  }
}
