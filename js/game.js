// ============================================================
// 象棋 - 游戏状态管理
// ============================================================
import { RED, BLACK, KING, PIECE_CHARS, ROWS, COLS } from './constants.js'
import {
  getValidMoves, isInCheck, isCheckmate, isStalemate,
  cloneBoard, createInitialBoard,
} from './pieces.js'
import { RepetitionDetector, zobrist } from './perpetual.js'
import { boardToFEN, fenToBoard, fenToTurn, isValidFEN, START_FEN } from './fen.js'

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

    // 记录是否将军
    const wasCheck = isInCheck(this.board, enemyColor)

    // 记录走法（用于悔棋和动画）
    this.history.push({
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      piece: { ...piece },
      captured: captured ? { ...captured } : null,
      wasCheck,
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

    // 检测循环局面
    if (this.status !== 'checkmate' && this.status !== 'stalemate') {
      if (this.repetition) {
        // 记录当前局面
        const currentHash = zobrist.hash(this.board, this.turn)
        const count = this.repetition.getCount(this.board, this.turn)

        if (count >= 3) {
          this.status = 'draw'
          this.subStatus = 'threefold'
        }

        // 长将检测
        const perpetual = this.repetition.isPerpetualCheck()
        if (perpetual) {
          this.status = 'checkmate' // 长将判负
          this.subStatus = 'perpetual_check'
        }
      }
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
    // 先删除 repetition 记录
    const toRemove = this.history[this.history.length - 1]
    if (toRemove && this.repetition) {
      // 模拟悔棋前的局面
      const prevTurn = toRemove.piece.color
      this.repetition.unrecord(this.board, this.turn)
    }

    const last = this.history.pop()
    if (!last) return

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

  // ─── 棋盘翻转 ──────────────────────────────────────

  /** 翻转棋盘 (180°) */
  flipBoard() {
    this.flipped = !this.flipped
  }

  /** 获取翻转后的棋盘坐标 */
  getFlippedPos(row, col) {
    if (!this.flipped) return { row, col }
    return { row: ROWS - 1 - row, col: COLS - 1 - col }
  }

  // ─── FEN 导入/导出 ─────────────────────────────────

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

  /** 获取当前 FEN (备用名) */
  getFEN() { return this.toFEN() }

  /** 加载初始局面 */
  loadStartPosition() {
    return this.fromFEN(START_FEN)
  }

  /** 获取胜利方 */
  getWinner() {
    if (this.status === 'checkmate') {
      return this.turn === RED ? BLACK : RED
    }
    return null
  }
}
