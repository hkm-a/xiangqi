// ============================================================
// 象棋 - 主控制器（对弈 + 提示 + 语音）
// ============================================================
import { RED, BLACK, PIECE_CHARS, CANVAS_W, CANVAS_H } from './constants.js'
import { Game } from './game.js'
import { Renderer } from './renderer.js'
import { findBestMove, resetTT } from './ai.js'
import { formatHistoryText } from './notation.js'
import { sound } from './sound.js'
import { initAutoUpdate, isTauriShell } from './updater.js'

// ─── DOM ───────────────────────────────────────────────

const $ = (id) => document.getElementById(id)

const canvas = $('gameCanvas')
const turnDot = $('turnDot')
const statusLine = document.querySelector('.status-line')
const statusText = $('statusText')
const moveHistory = $('moveHistory')
const btnCopyMoves = $('btnCopyMoves')
const btnUndo = $('btnUndo')
const capturedLine = $('capturedLine')
const diffBtns = document.querySelectorAll('.diff-btn')
const hintMove = $('hintMove')
const hintRefresh = $('hintRefresh')
const endSeal = $('endSeal')
const endSealChar = $('endSealChar')
const endSealSub = $('endSealSub')
const checkFlash = $('checkFlash')
const boardFrame = document.querySelector('.board-frame')

// ─── State ─────────────────────────────────────────────

const game = new Game()
const renderer = new Renderer(canvas)
game.aiMode = true
game.aiColor = BLACK

let gameOver = false
let animating = false
let hintResult = null
let hintComputing = false

const PREFS_KEY = 'xiangqi_prefs'
const SOUND_KEY = 'xiangqi_sound'
const ANIM_MS = 230

// ─── AI Worker ─────────────────────────────────────────

let aiWorker = null
let aiRequestId = 0
let activeAiRequestId = 0
let hintRequestId = 0

function getAIWorker() {
  if (aiWorker) return aiWorker
  try {
    aiWorker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' })
    aiWorker.onmessage = handleWorkerMessage
    aiWorker.onerror = () => { console.warn('[AI] worker error, fallback'); runAIFallback() }
  } catch (e) {
    console.warn('[AI] worker unavailable:', e.message)
  }
  return aiWorker
}

function handleWorkerMessage(e) {
  const { type, data, requestId } = e.data
  if (type === 'result') {
    if (data?.purpose === 'hint') {
      if (requestId !== hintRequestId || game.aiThinking) {
        hintComputing = false
        hintRefresh.disabled = false
        return
      }
      applyHintResult(data)
      return
    }
    if (requestId !== activeAiRequestId) return
    game.aiThinking = false
    if (data?.fromRow !== undefined) executeAIMove(data)
    else updateUI()
  } else if (type === 'error') {
    console.error('[AI Worker]', data?.message)
    if (requestId === activeAiRequestId) {
      game.aiThinking = false
      runAIFallback()
    } else if (requestId === hintRequestId) {
      hintComputing = false
      hintRefresh.disabled = false
    }
  }
  // progress 消息忽略：状态行已显示「思考中」
}

function runAIFallback() {
  if (!game.aiThinking || !isAITurn()) return
  setTimeout(() => {
    const r = findBestMove(game.board, game.turn, getDifficulty())
    game.aiThinking = false
    if (r) executeAIMove(r)
    else updateUI()
  }, 50)
}

function isAITurn() {
  return game.aiMode && !game.aiThinking && game.turn === game.aiColor && !gameOver
}

function getDifficulty() {
  return parseInt(document.querySelector('.diff-btn.active')?.dataset?.diff || '2', 10)
}

function isEndedStatus(s) {
  return s === 'checkmate' || s === 'stalemate' || s === 'draw'
}

function triggerAI() {
  if (gameOver || animating || !isAITurn() || isEndedStatus(game.status)) return
  game.aiThinking = true
  updateUI()

  const difficulty = getDifficulty()
  const worker = getAIWorker()
  if (worker) {
    activeAiRequestId = ++aiRequestId
    worker.postMessage({
      type: 'findBestMove',
      requestId: activeAiRequestId,
      data: { fen: game.toFEN(), color: game.turn, difficulty, purpose: 'ai' },
    })
  } else {
    setTimeout(() => {
      const r = findBestMove(game.board, game.turn, difficulty)
      game.aiThinking = false
      if (r) executeAIMove(r)
      else updateUI()
    }, 50)
  }
}

// ─── 走子 ─────────────────────────────────────────────

function speakLastMove(captured) {
  if (!isSoundEnabled()) return
  const last = game.history.at(-1)
  if (!last) return
  const spoken = game.getSpokenMove(last)
  const check = game.status === 'check'
  if (captured) sound.playCapture({ tokens: spoken.tokens, check })
  else sound.playMove({ tokens: spoken.tokens, check })
}

function afterMoveSettled() {
  animating = false
  updateUI()
  savePrefs()
  if (!checkGameEnd()) {
    // 走完若将军：闪「將」印
    if (game.status === 'check') flashCheckSeal()
    clearHint()
    if (isAITurn() && !gameOver) triggerAI()
  }
}

function playMoveAnim(fromRow, fromCol, toRow, toCol, moving, captured) {
  animating = true
  renderer.setHintMove(null)
  renderer.startAnim(fromRow, fromCol, toRow, toCol, moving)
  if (captured) renderer.triggerCaptureFlash(toRow, toCol)
  // 落点涟漪在动画中段出现，更有「砸下去」的感觉
  setTimeout(() => {
    renderer.triggerLandingRipple(toRow, toCol, !!captured)
    requestDraw()
  }, Math.floor(ANIM_MS * 0.72))
  speakLastMove(captured)
  requestDraw()
  setTimeout(afterMoveSettled, ANIM_MS)
}

/** 将军朱印一闪 */
let checkFlashTimer = 0
function flashCheckSeal() {
  if (!checkFlash) return
  if (typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    // 减少动态：仅框体红光
    boardFrame?.classList.add('is-check')
    return
  }
  checkFlash.hidden = false
  checkFlash.style.animation = 'none'
  void checkFlash.offsetWidth
  checkFlash.style.animation = ''
  boardFrame?.classList.add('is-check')
  clearTimeout(checkFlashTimer)
  checkFlashTimer = setTimeout(() => {
    checkFlash.hidden = true
  }, 900)
}

function clearCheckFx() {
  if (checkFlash) checkFlash.hidden = true
  boardFrame?.classList.remove('is-check')
  clearTimeout(checkFlashTimer)
}

function executeAIMove(r) {
  const moving = game.board[r.fromRow][r.fromCol]
  const captured = game.board[r.toRow][r.toCol]
  game.aiMove(r.fromRow, r.fromCol, r.toRow, r.toCol)
  playMoveAnim(r.fromRow, r.fromCol, r.toRow, r.toCol, moving, captured)
}

function executeMove(fromRow, fromCol, toRow, toCol) {
  const movingPiece = game.board[fromRow][fromCol]
  const targetPiece = game.board[toRow][toCol]
  game.selected = null
  if (!game.tryMove(fromRow, fromCol, toRow, toCol)) {
    if (isSoundEnabled()) sound.playIllegal()
    updateUI()
    return
  }
  playMoveAnim(fromRow, fromCol, toRow, toCol, movingPiece, targetPiece)
}

function showEndSeal(char, sub) {
  if (!endSeal) return
  if (endSealChar) endSealChar.textContent = char
  if (endSealSub) endSealSub.textContent = sub || ''
  endSeal.hidden = false
  // 重播落印动画
  endSeal.style.animation = 'none'
  // 强制回流
  void endSeal.offsetWidth
  endSeal.style.animation = ''
}

function hideEndSeal() {
  if (endSeal) endSeal.hidden = true
}

function checkGameEnd() {
  if (game.status === 'checkmate' || game.status === 'stalemate') {
    const winnerLabel = game.turn === BLACK ? '红方' : '黑方'
    const reason = game.status === 'checkmate' ? '将杀' : '困毙'
    const playerWon = game.aiMode ? (game.turn === game.aiColor) : true
    setStatus(`${winnerLabel}胜 · ${reason}`, 'end')
    gameOver = true
    showEndSeal(playerWon ? '勝' : '負', `${winnerLabel} · ${reason}`)
    if (isSoundEnabled()) {
      if (playerWon) sound.playWin(`${winnerLabel}胜`)
      else sound.playLose(`${winnerLabel}胜`)
    }
    return true
  }
  if (game.status === 'draw') {
    setStatus('和棋', 'end')
    gameOver = true
    showEndSeal('和', '双方不变作和')
    if (isSoundEnabled()) sound.playDraw()
    return true
  }
  return false
}

// ─── 提示（按需：仅点「示」或按 H，不自动分析）────────

function canHint() {
  return !gameOver && !isEndedStatus(game.status) && !game.aiThinking && !isAITurn()
}

/** 清掉箭头与文案，并作废进行中的提示请求 */
function clearHint() {
  hintResult = null
  hintComputing = false
  hintRequestId++
  hintRefresh.disabled = false
  renderer.setHintMove(null)
  updateHintUI()
}

function applyHintResult(r) {
  if (r?.fromRow !== undefined) {
    const p = game.board[r.fromRow]?.[r.fromCol]
    if (p) {
      r.moveText = game.getMoveText({
        piece: p,
        from: { row: r.fromRow, col: r.fromCol },
        to: { row: r.toRow, col: r.toCol },
      })
    } else {
      r.moveText = '—'
    }
    hintResult = r
  }
  hintComputing = false
  hintRefresh.disabled = false
  updateHintUI()
}

function computeHint() {
  if (hintComputing || !canHint()) return
  hintComputing = true
  hintRefresh.disabled = true
  hintResult = null
  renderer.setHintMove(null)
  updateHintUI()

  const difficulty = getDifficulty()
  const fen = game.toFEN()
  const color = game.turn
  const worker = getAIWorker()

  if (worker) {
    hintRequestId = ++aiRequestId
    worker.postMessage({
      type: 'findBestMove',
      requestId: hintRequestId,
      data: { fen, color, difficulty, purpose: 'hint' },
    })
  } else {
    setTimeout(() => {
      try {
        applyHintResult(findBestMove(game.board, color, difficulty))
      } catch (e) {
        console.warn('[Hint]', e)
        hintComputing = false
        hintRefresh.disabled = false
        updateHintUI()
      }
    }, 50)
  }
}

function updateHintUI() {
  if (!hintResult) {
    hintMove.textContent = hintComputing ? '…' : '点示'
    hintMove.classList.toggle('is-idle', !hintComputing)
    renderer.setHintMove(null)
    requestDraw()
    return
  }
  hintMove.textContent = hintResult.moveText || '—'
  hintMove.classList.remove('is-idle')
  renderer.setHintMove(hintResult)
  requestDraw()
}

hintRefresh.addEventListener('click', computeHint)

// ─── 指针走棋 ─────────────────────────────────────────

function getCanvasPos(cx, cy) {
  const r = canvas.getBoundingClientRect()
  return {
    x: (cx - r.left) * (CANVAS_W / r.width),
    y: (cy - r.top) * (CANVAS_H / r.height),
  }
}

function canInteract() {
  return !gameOver && !animating && !game.aiThinking && !isAITurn()
}

/** @type {{ row: number, col: number, x: number, y: number, dragging: boolean }|null} */
let pointerState = null
const DRAG_THRESHOLD = 8

function selectPiece(row, col) {
  const piece = game.board[row][col]
  if (!piece || piece.color !== game.turn) return false
  game.selected = { row, col }
  if (isSoundEnabled()) sound.playSelect(piece)
  updateUI()
  return true
}

canvas.addEventListener('pointerdown', (e) => {
  if (!canInteract()) return
  sound.init()
  const p = getCanvasPos(e.clientX, e.clientY)
  const b = renderer.toBoard(p.x, p.y)
  if (!b) return

  const clicked = game.board[b.row][b.col]
  pointerState = { row: b.row, col: b.col, x: p.x, y: p.y, dragging: false }

  if (clicked && clicked.color === game.turn) {
    if (!game.selected || game.selected.row !== b.row || game.selected.col !== b.col) {
      selectPiece(b.row, b.col)
    }
    renderer.startDrag(clicked, p.x, p.y, b.row, b.col, game.getSelectedMoves())
    try { canvas.setPointerCapture(e.pointerId) } catch { /* noop */ }
  }
})

canvas.addEventListener('pointermove', (e) => {
  const p = getCanvasPos(e.clientX, e.clientY)

  if (pointerState && renderer.draggedPiece) {
    const dx = p.x - pointerState.x
    const dy = p.y - pointerState.y
    if (!pointerState.dragging && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      pointerState.dragging = true
      canvas.style.cursor = 'grabbing'
    }
    if (pointerState.dragging) {
      renderer.updateDrag(p.x, p.y)
      requestDraw()
    }
    return
  }

  if (!canInteract()) {
    canvas.style.cursor = 'default'
    return
  }
  const b = renderer.toBoard(p.x, p.y)
  const piece = b && game.board[b.row][b.col]
  canvas.style.cursor = piece && piece.color === game.turn ? 'pointer' : 'default'
})

function endPointer(e) {
  if (!pointerState) return
  const p = getCanvasPos(e.clientX, e.clientY)
  const wasDragging = pointerState.dragging
  const fromRow = pointerState.row
  const fromCol = pointerState.col
  pointerState = null

  const drop = renderer.endDrag(p.x, p.y)
  canvas.style.cursor = 'default'

  if (!canInteract()) {
    updateUI()
    return
  }

  if (wasDragging) {
    if (drop && (drop.row !== fromRow || drop.col !== fromCol)) {
      executeMove(fromRow, fromCol, drop.row, drop.col)
    } else {
      updateUI()
    }
    return
  }

  const b = renderer.toBoard(p.x, p.y)
  if (!b) {
    updateUI()
    return
  }
  const { row, col } = b
  const clicked = game.board[row][col]

  if (game.selected) {
    if (game.selected.row === row && game.selected.col === col) {
      game.selected = null
      updateUI()
      return
    }
    if (clicked && clicked.color === game.turn) {
      selectPiece(row, col)
      return
    }
    executeMove(game.selected.row, game.selected.col, row, col)
    return
  }
  if (clicked && clicked.color === game.turn) selectPiece(row, col)
}

canvas.addEventListener('pointerup', endPointer)
canvas.addEventListener('pointercancel', () => {
  pointerState = null
  renderer.draggedPiece = null
  updateUI()
})

// ─── UI ────────────────────────────────────────────────

function setStatus(text, kind = '') {
  statusText.textContent = text
  if (statusLine) {
    statusLine.classList.toggle('is-check', kind === 'check')
    statusLine.classList.toggle('is-end', kind === 'end')
  }
}

function updateUI() {
  const isRed = game.turn === RED
  turnDot.className = `turn-dot ${isRed ? 'red' : 'black'}`

  if (gameOver) {
    // 终局文案已由 checkGameEnd 写入
  } else if (game.status === 'check') {
    setStatus('将军', 'check')
    boardFrame?.classList.add('is-check')
  } else if (game.aiThinking) {
    setStatus('思考中…')
    boardFrame?.classList.remove('is-check')
  } else if (game.history.length > 0) {
    const last = game.history.at(-1)
    const mt = game.getMoveText(last)
    if (last.captured) {
      setStatus(`${mt} 吃${PIECE_CHARS[last.captured.color][last.captured.type]}`)
    } else {
      setStatus(mt)
    }
    boardFrame?.classList.remove('is-check')
  } else {
    setStatus(isRed ? '红方走棋' : '黑方走棋')
    boardFrame?.classList.remove('is-check')
  }

  if (btnUndo) {
    btnUndo.disabled = game.aiThinking || animating || game.history.length === 0
  }
  if (hintRefresh) {
    hintRefresh.disabled = hintComputing || !canHint()
  }

  renderCaptured()
  renderMoveHistory()
  requestDraw()
}

function renderCaptured() {
  if (!capturedLine) return
  const red = game.capturedRed.map((p) => PIECE_CHARS[p.color][p.type]).join('')
  const black = game.capturedBlack.map((p) => PIECE_CHARS[p.color][p.type]).join('')
  if (!red && !black) {
    capturedLine.innerHTML = ''
    return
  }
  capturedLine.innerHTML =
    `<span class="c-red">${red || '·'}</span>` +
    `<span class="sep">·</span>` +
    `<span class="c-black">${black || '·'}</span>`
}

function renderMoveHistory() {
  if (!moveHistory) return
  if (btnCopyMoves) btnCopyMoves.hidden = game.history.length === 0
  if (game.history.length === 0) {
    moveHistory.innerHTML = '<span class="history-empty">尚未开始</span>'
    return
  }
  moveHistory.innerHTML = game.history.map((m, i) =>
    `<span class="history-move"><span class="num">${i + 1}.</span>` +
    `<span class="${m.piece?.color === RED ? 'red' : 'black'}">${game.getMoveText(m)}</span></span>`,
  ).join('')
  moveHistory.scrollTop = moveHistory.scrollHeight
}

async function copyMoves() {
  if (game.history.length === 0) return
  const text = formatHistoryText(game.history, (m) => game.getMoveText(m))
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    if (btnCopyMoves) {
      const prev = btnCopyMoves.textContent
      btnCopyMoves.textContent = '已复制'
      setTimeout(() => { btnCopyMoves.textContent = prev || '复制' }, 900)
    }
  } catch {
    if (btnCopyMoves) btnCopyMoves.textContent = '失败'
    setTimeout(() => { if (btnCopyMoves) btnCopyMoves.textContent = '复制' }, 900)
  }
}

// ─── 音效 ─────────────────────────────────────────────

function isSoundEnabled() {
  return localStorage.getItem(SOUND_KEY) !== 'off'
}

function syncSoundButton() {
  const on = isSoundEnabled()
  $('btnSound').textContent = on ? '音效' : '静音'
  $('btnSound').classList.toggle('is-muted', !on)
  $('btnSound').title = on ? '关闭音效' : '打开音效'
}

function toggleSound() {
  const on = !isSoundEnabled()
  localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  syncSoundButton()
  sound.setEnabled(on)
  if (on) {
    sound.init()
    sound.playNewGame()
  }
}

// ─── 偏好 ─────────────────────────────────────────────

function getPlayerColor() {
  return document.querySelector('.side-btn.active')?.dataset?.side === 'black' ? BLACK : RED
}

function applySideUI(playerColor) {
  document.querySelectorAll('.side-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.side === (playerColor === BLACK ? 'black' : 'red'))
  })
}

function applyPlayerSide(playerColor, { flipForBlack = true } = {}) {
  game.aiMode = true
  game.aiColor = playerColor === RED ? BLACK : RED
  if (flipForBlack) game.flipped = playerColor === BLACK
  applySideUI(playerColor)
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      difficulty: getDifficulty(),
      playerColor: getPlayerColor() === BLACK ? 'black' : 'red',
      flipped: game.flipped,
    }))
  } catch { /* noop */ }
}

function restorePrefs() {
  try {
    localStorage.removeItem('xiangqi_save')
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return
    const d = JSON.parse(raw)
    const playerColor = d.playerColor === 'black' ? BLACK : RED
    applyPlayerSide(playerColor, { flipForBlack: true })
    if (typeof d.flipped === 'boolean') game.flipped = d.flipped
    const diff = Math.min(3, Math.max(1, parseInt(d.difficulty || '2', 10)))
    game.aiDifficulty = diff
    diffBtns.forEach((b) => b.classList.toggle('active', parseInt(b.dataset.diff || '2', 10) === diff))
  } catch { /* noop */ }
}

// ─── 渲染：有动画才持续 rAF，空闲时停帧省电 ─────────

let loopRunning = false

function needsContinuousDraw() {
  // 减少动态效果时：将军/提示静态绘制，不必持续 rAF
  const pulse = !renderer.reduceMotion && (game.status === 'check' || renderer.hintMove)
  return !!(
    renderer.hasFx()
    || renderer.draggedPiece
    || pulse
  )
}

function requestDraw() {
  renderer.render(game, performance.now())
  if (needsContinuousDraw() && !loopRunning) {
    loopRunning = true
    requestAnimationFrame(gameLoop)
  }
}

function gameLoop(now) {
  renderer.render(game, now)
  if (needsContinuousDraw()) {
    requestAnimationFrame(gameLoop)
  } else {
    loopRunning = false
  }
}

// ─── 按钮 ─────────────────────────────────────────────

$('btnNewGame').addEventListener('click', () => {
  const playerColor = getPlayerColor()
  game.reset()
  applyPlayerSide(playerColor)
  gameOver = false
  animating = false
  game.aiThinking = false
  game.selected = null
  clearHint()
  hideEndSeal()
  clearCheckFx()
  setStatus(playerColor === RED ? '红方走棋' : '黑方走棋')
  savePrefs()
  updateUI()
  if (isSoundEnabled()) {
    sound.init()
    sound.playNewGame()
  }
  if (isAITurn()) setTimeout(triggerAI, 300)
})

btnUndo.addEventListener('click', () => {
  if (game.aiThinking || game.history.length === 0 || animating) return
  const steps = game.history.length >= 2 ? 2 : 1
  for (let i = 0; i < steps; i++) {
    if (game.history.length > 0) game.undo()
  }
  gameOver = false
  game.selected = null
  clearHint()
  hideEndSeal()
  clearCheckFx()
  updateUI()
  savePrefs()
  if (isAITurn()) setTimeout(triggerAI, 200)
})

$('btnFlip').addEventListener('click', () => {
  game.flipBoard()
  game.selected = null
  updateUI()
  savePrefs()
})

$('btnSound').addEventListener('click', toggleSound)

if (btnCopyMoves) btnCopyMoves.addEventListener('click', copyMoves)
if (moveHistory) {
  moveHistory.addEventListener('dblclick', () => { copyMoves() })
}

document.querySelectorAll('.side-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const side = btn.dataset.side === 'black' ? BLACK : RED
    if (side === getPlayerColor() && document.querySelector('.side-btn.active') === btn) return
    const midGame = game.history.length > 0
    applySideUI(side)
    if (midGame) {
      $('btnNewGame').click()
    } else {
      applyPlayerSide(side)
      clearHint()
      updateUI()
      if (isAITurn()) setTimeout(triggerAI, 300)
    }
  })
})

diffBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    diffBtns.forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    game.aiDifficulty = Math.min(3, Math.max(1, parseInt(btn.dataset?.diff || '2', 10)))
    resetTT()
    savePrefs()
    // 难度变了，旧提示作废；需再点「示」
    clearHint()
  })
})

document.addEventListener('keydown', (e) => {
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    btnUndo.click()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    // 无选中文本时复制记谱
    const sel = window.getSelection?.()?.toString()
    if (!sel) {
      e.preventDefault()
      copyMoves()
    }
    return
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const k = e.key.toLowerCase()
  if (k === 'n') { e.preventDefault(); $('btnNewGame').click() }
  else if (k === 'u' || k === 'z') { e.preventDefault(); btnUndo.click() }
  else if (k === 'f') { e.preventDefault(); $('btnFlip').click() }
  else if (k === 'h') { e.preventDefault(); $('hintRefresh').click() }
  else if (k === 'm') { e.preventDefault(); $('btnSound').click() }
  else if (k === 'c') { e.preventDefault(); copyMoves() }
  else if (k === 'escape') {
    if (game.selected) {
      game.selected = null
      updateUI()
    }
  }
})

// ─── 启动 ─────────────────────────────────────────────

function registerPWA() {
  if (!('serviceWorker' in navigator)) return
  // 开发 / 桌面壳不注册 SW
  if (import.meta.env?.DEV || isTauriShell()) return
  const swUrl = `${import.meta.env.BASE_URL || './'}sw.js`
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).catch(() => {})
  })
}

function init() {
  sound.setEnabled(isSoundEnabled())
  syncSoundButton()
  game.reset()
  applyPlayerSide(RED)
  restorePrefs()
  gameOver = false
  clearHint()
  updateUI()
  if (isAITurn()) setTimeout(triggerAI, 300)
  registerPWA()
  // 桌面端：延迟检查 GitHub Releases 更新
  initAutoUpdate({ delayMs: 2800 })

  // 仅在音效开启时预热 AudioContext
  if (isSoundEnabled()) {
    const initAudio = () => {
      sound.init()
      document.removeEventListener('click', initAudio)
      document.removeEventListener('touchstart', initAudio)
    }
    document.addEventListener('click', initAudio, { once: true })
    document.addEventListener('touchstart', initAudio, { once: true })
  }
}

init()
