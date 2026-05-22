// ============================================================
// 象棋 - 主控制器（交互、UI 绑定、游戏循环）
// ============================================================
import { RED, BLACK, PIECE_CHARS, CANVAS_W, CANVAS_H } from './constants.js'
import { Game } from './game.js'
import { Renderer } from './renderer.js'
import { findBestMove } from './ai.js'

// ─── DOM 引用 ─────────────────────────────────────────

const canvas = document.getElementById('gameCanvas')
const turnDot = document.getElementById('turnDot')
const turnLabel = document.getElementById('turnLabel')
const statusMsg = document.getElementById('statusMsg')
const moveHistory = document.getElementById('moveHistory')
const capturedRed = document.getElementById('capturedRed')
const capturedBlack = document.getElementById('capturedBlack')
const btnNewGame = document.getElementById('btnNewGame')
const btnUndo = document.getElementById('btnUndo')

const modeBtns = document.querySelectorAll('.mode-btn')
const diffBtns = document.querySelectorAll('.diff-btn')

// ─── 游戏状态 ─────────────────────────────────────────

const game = new Game()
const renderer = new Renderer(canvas)
let gameOver = false
let animating = false

// ─── AI 相关 ──────────────────────────────────────────

function isAITurn() {
  if (!game.aiMode) return false
  if (game.aiThinking) return false
  return game.turn === game.aiColor
}

function triggerAI() {
  if (gameOver || animating) return
  if (!isAITurn()) return
  if (game.status === 'checkmate' || game.status === 'stalemate') return

  game.aiThinking = true
  updateUI()

  // 使用 setTimeout 让 UI 先更新再计算
  setTimeout(() => {
    const difficultyEl = document.querySelector('.diff-btn.active')
    const difficulty = parseInt(difficultyEl?.dataset?.diff || '2', 10)

    const result = findBestMove(game.board, game.turn, difficulty)

    if (result) {
      const captured = game.board[result.toRow][result.toCol]
      animating = true
      renderer.startAnim(result.fromRow, result.fromCol, result.toRow, result.toCol,
        game.board[result.fromRow][result.fromCol])
      if (captured) {
        renderer.triggerCaptureFlash(result.toRow, result.toCol)
      }

      game.aiMove(result.fromRow, result.fromCol, result.toRow, result.toCol)

      // 动画结束后再检查
      setTimeout(() => {
        animating = false
        game.aiThinking = false
        updateUI()
        checkGameEnd()

        // AI 连续走（如果 AI 走后还是 AI 回合，但正常情况下不会发生）
        if (isAITurn() && !gameOver) {
          triggerAI()
        }
      }, 200)
    } else {
      game.aiThinking = false
      updateUI()
    }
  }, 50)
}

function checkGameEnd() {
  if (game.status === 'checkmate') {
    const winner = game.turn === RED ? '黑方' : '红方'
    statusMsg.textContent = `🏆 ${winner}胜！将杀！`
    statusMsg.className = 'status-msg checkmate'
    gameOver = true
    return true
  }
  if (game.status === 'stalemate') {
    const winner = game.turn === RED ? '黑方' : '红方'
    statusMsg.textContent = `🏆 ${winner}胜！困毙！`
    statusMsg.className = 'status-msg checkmate'
    gameOver = true
    return true
  }
  return false
}

// ─── 点击事件 ─────────────────────────────────────────

canvas.addEventListener('click', (e) => {
  if (gameOver || animating || game.aiThinking) return
  if (isAITurn()) return

  const rect = canvas.getBoundingClientRect()
  // dpr 适配：canvas.width 是 CANVAS_W * dpr，鼠标坐标需要映射回逻辑坐标系
  const logicalX = (e.clientX - rect.left) * (CANVAS_W / rect.width)
  const logicalY = (e.clientY - rect.top) * (CANVAS_H / rect.height)
  const pos = renderer.toBoard(logicalX, logicalY)
  if (!pos) return

  const { row, col } = pos
  const clickedPiece = game.board[row][col]

  // 如果已选中棋子
  if (game.selected) {
    // 点击了同一个棋子 -> 取消选中
    if (game.selected.row === row && game.selected.col === col) {
      game.selected = null
      updateUI()
      return
    }

    // 点击了己方另一个棋子 -> 切换选中
    if (clickedPiece && clickedPiece.color === game.turn) {
      game.selected = { row, col }
      updateUI()
      return
    }

    // 尝试走棋（先保存 selected 引用，因为 tryMove 内部会置 null）
    const selRow = game.selected.row
    const selCol = game.selected.col
    const movingPiece = game.board[selRow][selCol]
    const targetPiece = game.board[row][col]
    const result = game.tryMove(selRow, selCol, row, col)
    if (result) {
      animating = true
      renderer.startAnim(selRow, selCol, row, col, movingPiece)
      // 如果有吃子，触发闪光效果
      if (targetPiece) {
        renderer.triggerCaptureFlash(row, col)
      }

      setTimeout(() => {
        animating = false
        updateUI()
        if (!checkGameEnd()) {
          // AI 回合
          if (isAITurn()) {
            triggerAI()
          }
        }
      }, 200)
    } else {
      // 非法走法
      game.selected = null
      updateUI()
    }
    return
  }

  // 未选中 -> 选中己方棋子
  if (clickedPiece && clickedPiece.color === game.turn) {
    game.selected = { row, col }
    updateUI()
  }
})

// ─── UI 更新 ──────────────────────────────────────────

function updateUI() {
  const isRedTurn = game.turn === RED
  turnDot.className = `turn-dot ${isRedTurn ? 'red' : 'black'}`
  turnLabel.textContent = isRedTurn ? '红方走棋' : '黑方走棋'

  // 状态消息：将军 > 最近吃子 > AI思考 > 默认
  if (game.status === 'check') {
    statusMsg.textContent = '⚠️ 将军！'
    statusMsg.className = 'status-msg check'
  } else if (game.status === 'checkmate' || game.status === 'stalemate') {
    // checkGameEnd 已经设置了消息，这里不动
  } else if (game.aiThinking) {
    statusMsg.textContent = '🤔 AI 思考中...'
    statusMsg.className = 'status-msg'
  } else if (game.history.length > 0) {
    // 显示最近一步走法（如果有吃子，突出显示）
    const last = game.history[game.history.length - 1]
    const moveText = game.getMoveText(last)
    if (last.captured) {
      const capChar = PIECE_CHARS[last.captured.color][last.captured.type]
      statusMsg.textContent = `⚔️ ${moveText} 吃 ${capChar}`
      statusMsg.className = 'status-msg check'
      // 3 秒后恢复
      setTimeout(() => {
        if (statusMsg.classList.contains('check') &&
            statusMsg.textContent.includes('吃')) {
          statusMsg.textContent = isRedTurn ? '红方走棋' : '黑方走棋'
          statusMsg.className = 'status-msg'
        }
      }, 2500)
    } else {
      statusMsg.textContent = moveText
      statusMsg.className = 'status-msg'
    }
  } else {
    statusMsg.textContent = '点击棋子开始'
    statusMsg.className = 'status-msg'
  }

  // 被吃棋子
  updateCaptured(capturedRed, game.capturedRed, RED)
  updateCaptured(capturedBlack, game.capturedBlack, BLACK)

  // 走法历史
  renderMoveHistory()

  // 棋盘重绘
  renderer.render(game, performance.now())

  // 按钮状态
  btnUndo.disabled = game.history.length === 0 || game.aiThinking
}

function updateCaptured(el, pieces, color) {
  if (!el) return
  const textClass = color === RED ? 'red-text' : 'black-text'
  el.innerHTML = pieces.map(p =>
    `<span class="capture-piece ${textClass}">${PIECE_CHARS[p.color][p.type]}</span>`
  ).join('')
}

function renderMoveHistory() {
  if (!moveHistory) return
  const recent = game.history.slice(-20)
  moveHistory.innerHTML = recent.map((m, i) => {
    const num = game.history.length - recent.length + i + 1
    const text = game.getMoveText(m)
    return `<div class="move-entry"><span class="move-num">${num}.</span><span class="move-text">${text}</span></div>`
  }).join('')
  moveHistory.scrollTop = moveHistory.scrollHeight
}

// ─── 游戏循环 ─────────────────────────────────────────

function gameLoop(now) {
  renderer.render(game, now)
  requestAnimationFrame(gameLoop)
}

// ─── 按钮事件 ────────────────────────────────────────

btnNewGame.addEventListener('click', () => {
  // 保留当前 mode 设置，在 reset 后恢复
  const wasAiMode = game.aiMode
  const wasAiColor = game.aiColor
  game.reset()
  game.aiMode = wasAiMode
  game.aiColor = wasAiColor
  gameOver = false
  animating = false
  game.aiThinking = false
  updateUI()

  // AI 先走（如果 AI 执红）
  if (isAITurn()) {
    setTimeout(triggerAI, 300)
  }
})

btnUndo.addEventListener('click', () => {
  if (game.aiThinking) return
  game.undo()
  gameOver = false
  updateUI()
})

// 模式切换
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // ⚠️ 必须先 reset 再设 aiMode，否则 reset 会覆盖
    game.reset()
    modeBtns.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    const mode = btn.dataset.mode
    game.aiMode = mode === 'ai'
    game.aiColor = btn.dataset.aiColor || BLACK
    gameOver = false
    animating = false
    game.aiThinking = false
    updateUI()

    // 如果是 AI 模式且 AI 先走（执红）
    if (isAITurn()) {
      setTimeout(triggerAI, 300)
    }
  })
})

// 难度切换
diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
  })
})

// ─── 启动 ─────────────────────────────────────────────

// 默认选中双人模式
document.querySelector('.mode-btn[data-mode="pvp"]')?.classList.add('active')
document.querySelector('.diff-btn[data-diff="2"]')?.classList.add('active')

updateUI()
// 默认：AI 关闭，双人模式，直接开始游戏循环
requestAnimationFrame(gameLoop)

// 导出游戏对象（用于调试）
window.__game = game
