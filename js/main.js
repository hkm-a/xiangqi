// ============================================================
// 象棋 - 主控制器（AI 对弈 + AI 提示）
// ============================================================
import { RED, BLACK, PIECE_CHARS, CANVAS_W, CANVAS_H } from './constants.js'
import { Game } from './game.js'
import { Renderer } from './renderer.js'
import { findBestMove, resetTT } from './ai.js'
import { sound } from './sound.js'
import { START_FEN } from './fen.js'

// ─── DOM ───────────────────────────────────────────────

const $ = (id) => document.getElementById(id)

const canvas = $('gameCanvas')
const turnDot = $('turnDot')
const turnLabel = $('turnLabel')
const statusText = $('statusText')
const moveHistory = $('moveHistory')
const capturedRed = $('capturedRed')
const capturedBlack = $('capturedBlack')
const diffBtns = document.querySelectorAll('.diff-btn')
const hintMove = $('hintMove')
const hintEvalFill = $('hintEvalFill')
const hintEvalScore = $('hintEvalScore')
const hintRefresh = $('hintRefresh')
const aiThinking = $('aiThinking')
const aiThinkingBar = $('aiThinkingBar')

// ─── State ─────────────────────────────────────────────

const game = new Game()
const renderer = new Renderer(canvas)
game.aiMode = true
game.aiColor = BLACK

let gameOver = false
let animating = false
let hintResult = null
let hintComputing = false

const SAVE_KEY = 'xiangqi_save'

// ─── AI Worker ─────────────────────────────────────────

let aiWorker = null

function getAIWorker() {
  if (aiWorker) return aiWorker
  try {
    aiWorker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' })
    aiWorker.onmessage = handleWorkerMessage
    aiWorker.onerror = () => { console.warn('[AI] worker error, fallback'); runAIFallback() }
  } catch (e) { console.warn('[AI] worker unavailable:', e.message) }
  return aiWorker
}

function handleWorkerMessage(e) {
  const { type, data } = e.data
  if (type === 'result') {
    game.aiThinking = false
    if (data?.fromRow !== undefined) executeAIMove(data)
    hideAIProgress()
  } else if (type === 'progress') {
    showAIProgress(data)
  } else if (type === 'error') {
    console.error('[AI Worker]', data?.message)
    game.aiThinking = false; hideAIProgress(); runAIFallback()
  }
}

function runAIFallback() {
  if (!game.aiThinking || !isAITurn()) return
  setTimeout(() => {
    const r = findBestMove(game.board, game.turn, getDifficulty())
    game.aiThinking = false; hideAIProgress()
    if (r) executeAIMove(r); else updateUI()
  }, 50)
}

function showAIProgress(d) {
  aiThinking.style.display = 'flex'
  if (aiThinkingBar && d) aiThinkingBar.style.width = Math.min(100, (d.depth / 6) * 100) + '%'
}

function hideAIProgress() {
  aiThinking.style.display = 'none'
  if (aiThinkingBar) aiThinkingBar.style.width = '0%'
}

// ─── AI ────────────────────────────────────────────────

function isAITurn() {
  return game.aiMode && !game.aiThinking && game.turn === game.aiColor && !gameOver
}

function getDifficulty() {
  return parseInt(document.querySelector('.diff-btn.active')?.dataset?.diff || '2', 10)
}

function triggerAI() {
  if (gameOver || animating || !isAITurn() || game.status === 'checkmate' || game.status === 'stalemate') return
  game.aiThinking = true; updateUI()

  const difficulty = getDifficulty()
  const worker = getAIWorker()
  if (worker) {
    worker.postMessage({ type: 'findBestMove', data: { fen: game.toFEN(), color: game.turn, difficulty } })
  } else {
    setTimeout(() => {
      const r = findBestMove(game.board, game.turn, difficulty, p => showAIProgress(p))
      game.aiThinking = false; hideAIProgress()
      if (r) executeAIMove(r); else updateUI()
    }, 50)
  }
}

function executeAIMove(r) {
  const captured = game.board[r.toRow][r.toCol]
  animating = true
  renderer.startAnim(r.fromRow, r.fromCol, r.toRow, r.toCol, game.board[r.fromRow][r.fromCol])
  if (captured) { renderer.triggerCaptureFlash(r.toRow, r.toCol); if (isSoundEnabled()) sound.playCapture() }
  else { if (isSoundEnabled()) sound.playMove() }
  game.aiMove(r.fromRow, r.fromCol, r.toRow, r.toCol)
  setTimeout(() => {
    animating = false; updateUI()
    if (isSoundEnabled() && game.status === 'check') sound.playCheck()
    autoSave()
    if (!checkGameEnd()) {
      if (isAITurn() && !gameOver) triggerAI(); else scheduleHint()
    }
  }, 200)
}

// ─── AI Hint ───────────────────────────────────────────

function scheduleHint() {
  if (gameOver || game.status !== 'playing') return
  hintResult = null; updateHintUI()
  setTimeout(computeHint, 300)
}

function computeHint() {
  if (hintComputing || gameOver) return
  hintComputing = true; hintRefresh.disabled = true
  setTimeout(() => {
    try {
      const r = findBestMove(game.board, game.turn, getDifficulty())
      if (r?.fromRow !== undefined) {
        const p = game.board[r.fromRow][r.fromCol]
        r.pChar = p ? PIECE_CHARS[p.color][p.type] : '?'
        hintResult = r
      }
    } catch (e) { console.warn('[Hint]', e) }
    hintComputing = false; hintRefresh.disabled = false; updateHintUI()
  }, 50)
}

/** 将坐标转为中文字典式走法 (与 game.getMoveText 格式一致) */
function formatMove(row, col) {
  return '一二三四五六七八九'[col] + '一二三四五六七八九'[9 - row]
}

function updateHintUI() {
  if (!hintResult) {
    hintMove.textContent = '—'
    hintEvalFill.style.width = '50%'; hintEvalFill.className = 'hint-eval-fill'
    hintEvalScore.textContent = '0.00'
    return
  }
  const { fromRow, fromCol, toRow, toCol, pChar, score } = hintResult
  const from = formatMove(fromRow, fromCol)
  const to = formatMove(toRow, toCol)
  hintMove.textContent = `${pChar} ${from} → ${to}`

  const isRed = game.turn === RED
  const disp = isRed ? score : -score
  const clamped = Math.max(-500, Math.min(500, disp))
  hintEvalFill.style.width = `${Math.max(2, Math.min(98, ((clamped + 500) / 1000) * 100))}%`

  if (disp > 0.5) { hintEvalFill.className = 'hint-eval-fill red'; hintEvalScore.className = 'hint-eval-score red' }
  else if (disp < -0.5) { hintEvalFill.className = 'hint-eval-fill black'; hintEvalScore.className = 'hint-eval-score black' }
  else { hintEvalFill.className = 'hint-eval-fill'; hintEvalScore.className = 'hint-eval-score' }

  if (Math.abs(score) >= 90000) {
    hintEvalScore.textContent = score > 0 ? (isRed ? '将杀' : '被将杀') : (isRed ? '被将杀' : '将杀')
  } else {
    hintEvalScore.textContent = (score / 100).toFixed(2)
  }
}

hintRefresh.addEventListener('click', computeHint)

// ─── Player Move ───────────────────────────────────────

function executeMove(fromRow, fromCol, toRow, toCol) {
  const movingPiece = game.board[fromRow][fromCol]
  const targetPiece = game.board[toRow][toCol]
  game.selected = null
  if (!game.tryMove(fromRow, fromCol, toRow, toCol)) { updateUI(); return }

  animating = true
  renderer.startAnim(fromRow, fromCol, toRow, toCol, movingPiece)
  if (targetPiece) { renderer.triggerCaptureFlash(toRow, toCol); if (isSoundEnabled()) sound.playCapture() }
  else { if (isSoundEnabled()) sound.playMove() }

  setTimeout(() => {
    animating = false; updateUI()
    if (isSoundEnabled() && game.status === 'check') sound.playCheck()
    autoSave()
    if (!checkGameEnd()) {
      if (isAITurn() && !gameOver) triggerAI(); else scheduleHint()
    }
  }, 200)
}

function checkGameEnd() {
  if (game.status === 'checkmate') {
    statusText.textContent = `🏆 ${game.turn === RED ? '黑方' : '红方'}胜！将杀！`
    statusText.className = 'status-text checkmate'; gameOver = true
    if (isSoundEnabled()) sound.playWin(); return true
  }
  if (game.status === 'stalemate') {
    statusText.textContent = `🏆 ${game.turn === RED ? '黑方' : '红方'}胜！困毙！`
    statusText.className = 'status-text checkmate'; gameOver = true
    if (isSoundEnabled()) sound.playWin(); return true
  }
  if (game.status === 'draw') {
    statusText.textContent = '🤝 和棋！'
    statusText.className = 'status-text'; gameOver = true; return true
  }
  return false
}

// ─── Canvas Click ──────────────────────────────────────

function getCanvasPos(cx, cy) {
  const r = canvas.getBoundingClientRect()
  return { x: (cx - r.left) * (CANVAS_W / r.width), y: (cy - r.top) * (CANVAS_H / r.height) }
}

canvas.addEventListener('click', (e) => {
  if (gameOver || animating || game.aiThinking || isAITurn()) return
  const p = getCanvasPos(e.clientX, e.clientY)
  const b = renderer.toBoard(p.x, p.y)
  if (!b) return

  let row = b.row, col = b.col
  if (game.flipped) { row = 9 - row; col = 8 - col }

  const clicked = game.board[row][col]

  if (game.selected) {
    if (game.selected.row === row && game.selected.col === col) { game.selected = null; updateUI(); return }
    if (clicked && clicked.color === game.turn) { game.selected = { row, col }; if (isSoundEnabled()) sound.playSelect(); updateUI(); return }
    executeMove(game.selected.row, game.selected.col, row, col); return
  }
  if (clicked && clicked.color === game.turn) { game.selected = { row, col }; if (isSoundEnabled()) sound.playSelect(); updateUI() }
})

// ─── UI ────────────────────────────────────────────────

function updateUI() {
  const isRed = game.turn === RED
  turnDot.className = `turn-dot ${isRed ? 'red' : 'black'}`
  turnLabel.textContent = isRed ? '红方走棋' : '黑方走棋'

  if (game.status === 'check') { statusText.textContent = '⚠️ 将军！'; statusText.className = 'status-text check' }
  else if (game.aiThinking) { statusText.textContent = '🤔 AI 思考中...'; statusText.className = 'status-text' }
  else if (game.history.length > 0) {
    const last = game.history.at(-1)
    const mt = game.getMoveText(last)
    if (last.captured) {
      statusText.innerHTML = `⚔️ ${mt} 吃 ${PIECE_CHARS[last.captured.color][last.captured.type]}`
      statusText.className = 'status-text check'
    } else { statusText.textContent = mt; statusText.className = 'status-text' }
  } else { statusText.textContent = '点击棋子开始'; statusText.className = 'status-text' }

  updateCaptured(capturedRed, game.capturedRed, RED)
  updateCaptured(capturedBlack, game.capturedBlack, BLACK)
  renderMoveHistory()
  renderer.render(game, performance.now())
}

function updateCaptured(el, pieces, color) {
  if (!el) return
  el.innerHTML = pieces.map(p => `<span style="color:${color === RED ? '#c62828' : '#555'}">${PIECE_CHARS[p.color][p.type]}</span>`).join('')
}

function renderMoveHistory() {
  if (!moveHistory) return
  if (game.history.length === 0) { moveHistory.innerHTML = '<span class="history-empty">对局尚未开始</span>'; return }
  moveHistory.innerHTML = game.history.map((m, i) =>
    `<span class="history-move"><span class="num">${i + 1}.</span><span class="${m.piece?.color === RED ? 'red' : 'black'}">${game.getMoveText(m)}</span></span>`
  ).join('')
  moveHistory.scrollTop = moveHistory.scrollHeight
}

// ─── Sound ─────────────────────────────────────────────

const SOUND_KEY = 'xiangqi_sound'

function isSoundEnabled() { return localStorage.getItem(SOUND_KEY) !== 'off' }

function toggleSound() {
  const on = !isSoundEnabled()
  localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  $('btnSound').textContent = on ? '🔊 音效' : '🔇 静音'
  sound.setEnabled(on)
  if (on) sound.playMove()
}

// ─── Persistence ───────────────────────────────────────

function autoSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ fen: game.toFEN(), difficulty: getDifficulty(), flipped: game.flipped })) }
  catch { /* noop */ }
}

function tryRestore() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return
    const d = JSON.parse(raw)
    if (!d.fen || d.fen === START_FEN) return
    game.fromFEN(d.fen)
    game.aiMode = true; game.aiColor = BLACK
    game.aiDifficulty = d.difficulty || 2; game.flipped = !!d.flipped
    gameOver = false
    diffBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.diff || '2', 10) === game.aiDifficulty))
    updateUI()
  } catch { /* noop */ }
}

// ─── Game Loop ─────────────────────────────────────────

function gameLoop(now) { renderer.render(game, now); requestAnimationFrame(gameLoop) }

// ─── Buttons ───────────────────────────────────────────

$('btnNewGame').addEventListener('click', () => {
  game.reset(); game.aiMode = true; game.aiColor = BLACK
  gameOver = false; animating = false; game.aiThinking = false; game.selected = null
  hintResult = null; updateHintUI(); statusText.className = 'status-text'
  localStorage.removeItem(SAVE_KEY); updateUI()
  if (isAITurn()) setTimeout(triggerAI, 300); else scheduleHint()
})

$('btnUndo').addEventListener('click', () => {
  if (game.aiThinking || game.history.length === 0) return
  for (let i = 0; i < 2; i++) if (game.history.length > 0) game.undo()
  gameOver = false; game.selected = null; updateUI(); scheduleHint()
})

$('btnSound').addEventListener('click', toggleSound)

// ─── Difficulty ────────────────────────────────────────

diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    game.aiDifficulty = Math.min(3, Math.max(1, parseInt(btn.dataset?.diff || '2', 10)))
    resetTT()
  })
})

// ─── Keyboard ──────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); $('btnUndo').click() }
})

// ─── Init ──────────────────────────────────────────────

function init() {
  sound.setEnabled(isSoundEnabled())
  $('btnSound').textContent = isSoundEnabled() ? '🔊 音效' : '🔇 静音'
  tryRestore()
  gameLoop(performance.now())
  if (!gameOver) scheduleHint()
  if (isAITurn()) setTimeout(triggerAI, 300)

  const initAudio = () => { sound.init(); document.removeEventListener('click', initAudio); document.removeEventListener('touchstart', initAudio) }
  document.addEventListener('click', initAudio, { once: true })
  document.addEventListener('touchstart', initAudio, { once: true })
}

init()
