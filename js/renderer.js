// ============================================================
// 象棋 - Canvas 棋盘渲染器
// ============================================================
import { RED, KING,
  COLS, ROWS, CELL_SIZE, PADDING, PIECE_RADIUS, CANVAS_W, CANVAS_H,
  PIECE_CHARS } from './constants.js'

/** 棋盘色板：暖金木纹 + 书法用色 */
const BOARD = {
  boardStart: '#e0b85c',
  boardMid1: '#d0a040',
  boardMid2: '#c49438',
  boardEnd: '#a87828',
  stroke: 'rgba(90, 50, 15, 0.14)',
  stroke2: 'rgba(90, 50, 15, 0.07)',
  border: 'rgba(40, 20, 5, 0.22)',
  highlight: 'rgba(255, 240, 200, 0.08)',
  grid: '#3d2a16',
  river: 'rgba(55, 38, 18, 0.28)',
  riverText: 'rgba(48, 30, 12, 0.72)',
  riverStroke: 'rgba(255, 230, 180, 0.22)',
  star: '#3d2a16',
}

/** 棋子书法字体栈 */
const PIECE_FONT = '"KaiTi", "STKaiti", "华文楷体", "楷体", "Songti SC", serif'

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.dpr = window.devicePixelRatio || 1
    this.ctx = canvas.getContext('2d')
    // 系统「减少动态效果」：将军/提示不闪烁，便于省电与无障碍
    this.reduceMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Retina 高清适配：物理像素 = 逻辑像素 × dpr
    canvas.style.width = CANVAS_W + 'px'
    canvas.style.height = CANVAS_H + 'px'
    canvas.width = CANVAS_W * this.dpr
    canvas.height = CANVAS_H * this.dpr
    this.ctx.scale(this.dpr, this.dpr)

    // 动画状态
    this.animPiece = null
    this.animStart = null
    this.animDuration = 230 // ms — 与 main ANIM_MS 对齐

    // 吃子闪光效果
    this.captureFlash = null // { row, col, start }
    this.flashDuration = 340 // ms

    // 落子涟漪：[{ x, y, start, color }]
    this.ripples = []
    this.rippleDuration = 480 // ms

    // 走子轨迹光尘：[{ x, y, vx, vy, life, max, color }]
    this.sparks = []

    // 拖拽状态
    this.draggedPiece = null // { piece, x, y, fromRow, fromCol, moves[] }

    // AI 提示箭头（棋盘坐标，null 表示不画）
    this.hintMove = null // { fromRow, fromCol, toRow, toCol }

    // 当前是否翻转绘制（由 render 每帧同步）
    this._flipped = false
  }

  /** 设置 / 清除 AI 推荐走法箭头 */
  setHintMove(move) {
    if (!move || move.fromRow === undefined) {
      this.hintMove = null
      return
    }
    this.hintMove = {
      fromRow: move.fromRow,
      fromCol: move.fromCol,
      toRow: move.toRow,
      toCol: move.toCol,
    }
  }

  /** 触发吃子闪光 */
  triggerCaptureFlash(row, col) {
    this.captureFlash = { row, col, start: performance.now() }
  }

  /** 落子涟漪（落点坐标） */
  triggerLandingRipple(row, col, isCapture = false) {
    if (this.reduceMotion) return
    const { x, y } = this.toCanvas(row, col)
    this.ripples.push({
      x, y,
      start: performance.now(),
      color: isCapture ? '255, 80, 50' : '212, 175, 90',
    })
    // 限制数量，避免连走堆积
    if (this.ripples.length > 4) this.ripples.shift()
  }

  /** 走子轨迹喷一点光尘 */
  spawnMoveSparks(x, y, color = '212, 175, 90') {
    if (this.reduceMotion) return
    const n = 5
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 0.4 + Math.random() * 1.2
      this.sparks.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: 280 + Math.random() * 180,
        color,
      })
    }
    if (this.sparks.length > 40) this.sparks.splice(0, this.sparks.length - 40)
  }

  /** 是否仍有临时特效需要持续绘制 */
  hasFx() {
    return !!(
      this.captureFlash
      || this.ripples.length
      || this.sparks.length
      || this.animPiece
    )
  }

  /** 开始拖拽棋子 */
  startDrag(piece, x, y, row, col, moves) {
    this.draggedPiece = { piece, x, y, fromRow: row, fromCol: col, moves }
  }

  /** 更新拖拽位置 */
  updateDrag(x, y) {
    if (this.draggedPiece) {
      this.draggedPiece.x = x
      this.draggedPiece.y = y
    }
  }

  /** 结束拖拽，返回落点棋盘坐标 */
  endDrag(cx, cy) {
    if (!this.draggedPiece) return null
    const pos = this.toBoard(cx, cy)
    this.draggedPiece = null
    return pos
  }

  /** 开始棋子移动动画 */
  startAnim(fromRow, fromCol, toRow, toCol, piece) {
    this.animPiece = {
      piece,
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      _lastSpark: 0,
    }
    this.animStart = performance.now()
  }

  /** 逻辑坐标 → 绘制坐标（含翻转） */
  _displayRC(row, col) {
    if (!this._flipped) return { row, col }
    return { row: ROWS - 1 - row, col: COLS - 1 - col }
  }

  /** 获取棋子在画布上的坐标（逻辑棋盘坐标） */
  toCanvas(row, col) {
    const d = this._displayRC(row, col)
    return {
      x: PADDING + d.col * CELL_SIZE,
      y: PADDING + d.row * CELL_SIZE,
    }
  }

  /** 根据画布坐标获取逻辑棋盘位置 */
  toBoard(x, y) {
    const dispCol = Math.round((x - PADDING) / CELL_SIZE)
    const dispRow = Math.round((y - PADDING) / CELL_SIZE)
    if (dispRow < 0 || dispRow >= ROWS || dispCol < 0 || dispCol >= COLS) return null
    const sx = PADDING + dispCol * CELL_SIZE
    const sy = PADDING + dispRow * CELL_SIZE
    if (Math.hypot(x - sx, y - sy) > CELL_SIZE * 0.6) return null
    if (this._flipped) {
      return { row: ROWS - 1 - dispRow, col: COLS - 1 - dispCol }
    }
    return { row: dispRow, col: dispCol }
  }

  /** 主渲染循环 */
  render(game, now) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    this._flipped = !!game.flipped

    this.drawBoard(ctx)
    this.drawGrid(ctx)
    this.drawRiver(ctx)
    this.drawPalace(ctx)
    this.drawBoardCorners(ctx)
    this.drawLabels(ctx)

    // 绘制最后一步高亮
    this.drawLastMoveHighlight(ctx, game)

    // AI 提示箭头（在棋子下方，不挡字）
    this.drawHintArrow(ctx, now)

    // 动画更新
    let animPos = null
    if (this.animPiece && this.animStart !== null) {
      const elapsed = now - this.animStart
      const t = Math.min(elapsed / this.animDuration, 1)
      const ease = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const fromPos = this.toCanvas(this.animPiece.from.row, this.animPiece.from.col)
      const toPos = this.toCanvas(this.animPiece.to.row, this.animPiece.to.col)
      const ax = fromPos.x + (toPos.x - fromPos.x) * ease
      const ay = fromPos.y + (toPos.y - fromPos.y) * ease

      if (t < 1) {
        animPos = {
          x: ax,
          y: ay,
          piece: this.animPiece.piece,
          fromRow: this.animPiece.from.row,
          fromCol: this.animPiece.from.col,
          toRow: this.animPiece.to.row,
          toCol: this.animPiece.to.col,
        }
        // 轨迹光尘
        if (!this.reduceMotion && now - (this.animPiece._lastSpark || 0) > 28) {
          this.animPiece._lastSpark = now
          const c = this.animPiece.piece?.color === RED ? '198, 40, 40' : '80, 80, 80'
          this.spawnMoveSparks(ax, ay, c)
        }
      } else {
        this.animPiece = null
        this.animStart = null
      }
    }

    // 绘制有效走法提示（选中棋子或拖拽中的棋子）
    const hintMoves = this.draggedPiece
      ? this.draggedPiece.moves
      : (game.selected ? game.getSelectedMoves() : null)
    if (hintMoves) {
      for (const m of hintMoves) {
        const pos = this.toCanvas(m.row, m.col)
        const target = game.board[m.row][m.col]
        if (target) {
          this.drawCaptureHint(ctx, pos.x, pos.y)
        } else {
          this.drawMoveDot(ctx, pos.x, pos.y)
        }
      }
    }

    // 绘制棋子
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // 跳过正在动画中的棋子（源位置和目标位置都跳过）
        if (animPos && (
          (animPos.fromRow === r && animPos.fromCol === c) ||
          (animPos.toRow === r && animPos.toCol === c)
        )) continue

        // 跳过正在被拖拽的棋子（源位置）
        if (this.draggedPiece &&
          this.draggedPiece.fromRow === r &&
          this.draggedPiece.fromCol === c) continue

        const piece = game.board[r][c]
        if (piece) {
          const pos = this.toCanvas(r, c)
          const isSelected = game.selected && game.selected.row === r && game.selected.col === c
          const isCheck = game.status === 'check' && piece.type === KING && piece.color === game.turn
          this.drawPiece(ctx, pos.x, pos.y, piece, isSelected, isCheck, now)
        }
      }
    }

    // 绘制吃子闪光效果
    if (this.captureFlash) {
      const elapsed = now - this.captureFlash.start
      if (elapsed < this.flashDuration) {
        const progress = elapsed / this.flashDuration
        const flashPos = this.toCanvas(this.captureFlash.row, this.captureFlash.col)
        const alpha = 1 - progress
        const radius = PIECE_RADIUS + 10 + progress * 20
        ctx.save()
        ctx.strokeStyle = `rgba(255, 50, 50, ${alpha * 0.6})`
        ctx.lineWidth = 3 * (1 - progress) + 1
        ctx.beginPath()
        ctx.arc(flashPos.x, flashPos.y, radius, 0, Math.PI * 2)
        ctx.stroke()

        // 中心光晕
        const glow = ctx.createRadialGradient(flashPos.x, flashPos.y, 0, flashPos.x, flashPos.y, PIECE_RADIUS)
        glow.addColorStop(0, `rgba(255, 100, 50, ${alpha * 0.25})`)
        glow.addColorStop(1, `rgba(255, 100, 50, 0)`)
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(flashPos.x, flashPos.y, PIECE_RADIUS, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
      } else {
        this.captureFlash = null
      }
    }

    // 落子涟漪
    this.drawRipples(ctx, now)

    // 轨迹光尘
    this.drawSparks(ctx, now)

    // 绘制动画中的棋子（在最上层）
    if (animPos) {
      const isSelected = game.selected &&
        game.selected.row === animPos.piece.fromRow &&
        game.selected.col === animPos.piece.fromCol
      // 移动中微缩放 + 阴影
      ctx.save()
      const lift = 1 + Math.sin(Math.min(1, (now - this.animStart) / this.animDuration) * Math.PI) * 0.06
      ctx.translate(animPos.x, animPos.y)
      ctx.scale(lift, lift)
      this.drawPiece(ctx, 0, 0, animPos.piece, isSelected, false, now)
      ctx.restore()
    }

    // 绘制被拖拽的棋子（最上层，半透明）
    if (this.draggedPiece) {
      ctx.save()
      ctx.globalAlpha = 0.88
      ctx.translate(this.draggedPiece.x, this.draggedPiece.y)
      ctx.scale(1.06, 1.06)
      this.drawPiece(ctx, 0, 0, this.draggedPiece.piece, true, false, now)
      ctx.restore()
    }
  }

  drawRipples(ctx, now) {
    if (!this.ripples.length) return
    ctx.save()
    this.ripples = this.ripples.filter((rp) => {
      const t = (now - rp.start) / this.rippleDuration
      if (t >= 1) return false
      const ease = 1 - Math.pow(1 - t, 2)
      const r0 = PIECE_RADIUS * 0.6
      const r1 = PIECE_RADIUS * 2.4
      const radius = r0 + (r1 - r0) * ease
      const alpha = (1 - t) * 0.55
      ctx.strokeStyle = `rgba(${rp.color}, ${alpha})`
      ctx.lineWidth = 2.2 * (1 - t) + 0.6
      ctx.beginPath()
      ctx.arc(rp.x, rp.y, radius, 0, Math.PI * 2)
      ctx.stroke()
      // 第二圈
      if (t > 0.15) {
        const t2 = (t - 0.15) / 0.85
        const r2 = r0 + (r1 - r0) * t2 * 0.85
        ctx.strokeStyle = `rgba(${rp.color}, ${(1 - t2) * 0.28})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(rp.x, rp.y, r2, 0, Math.PI * 2)
        ctx.stroke()
      }
      return true
    })
    ctx.restore()
  }

  drawSparks(ctx, now) {
    if (!this.sparks.length) return
    // now 仅用于保持接口一致；life 按帧累加
    void now
    ctx.save()
    this.sparks = this.sparks.filter((s) => {
      s.life += 16
      if (s.life >= s.max) return false
      const t = s.life / s.max
      s.x += s.vx
      s.y += s.vy
      s.vy += 0.04
      const alpha = (1 - t) * 0.7
      const r = 1.6 * (1 - t * 0.6)
      ctx.fillStyle = `rgba(${s.color}, ${alpha})`
      ctx.beginPath()
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
      ctx.fill()
      return true
    })
    ctx.restore()
  }

  // ─── 棋盘绘制（单一金色木纹主题）─────────────────

  drawBoard(ctx) {
    const c = BOARD

    // 木板底色
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H)
    grad.addColorStop(0, c.boardStart)
    grad.addColorStop(0.3, c.boardMid1)
    grad.addColorStop(0.6, c.boardMid2)
    grad.addColorStop(1, c.boardEnd)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // 木板纹理 - 细横纹（预生成，避免每帧 Math.random()）
    if (!this._woodLinesH) {
      this._woodLinesH = []
      for (let y = 0; y < CANVAS_H; y += 6) {
        this._woodLinesH.push({
          y1: y + (Math.random() * 2 - 1),
          y2: y + (Math.random() * 2 - 1),
        })
      }
    }
    ctx.strokeStyle = c.stroke
    ctx.lineWidth = 1
    for (const line of this._woodLinesH) {
      ctx.beginPath()
      ctx.moveTo(0, line.y1)
      ctx.lineTo(CANVAS_W, line.y2)
      ctx.stroke()
    }

    // 木板纹理 - 竖纹（预生成）
    if (!this._woodLinesV) {
      this._woodLinesV = []
      for (let x = 0; x < CANVAS_W; x += 40 + Math.random() * 30) {
        this._woodLinesV.push(x)
      }
    }
    ctx.strokeStyle = c.stroke2
    for (const x of this._woodLinesV) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_H)
      ctx.stroke()
    }

    // 木板边框阴影（内）
    const vGrad = ctx.createLinearGradient(0, 0, 20, 0)
    vGrad.addColorStop(0, c.border)
    vGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = vGrad
    ctx.fillRect(0, 0, 20, CANVAS_H)

    // 右下角高光
    const hGrad = ctx.createLinearGradient(0, CANVAS_H - 20, 0, CANVAS_H)
    hGrad.addColorStop(0, c.highlight)
    hGrad.addColorStop(1, 'rgba(255,255,255,0.15)')
    ctx.fillStyle = hGrad
    ctx.fillRect(0, CANVAS_H - 20, CANVAS_W, 20)

    // 外缘暗角，更有景深
    const vignette = ctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, Math.min(CANVAS_W, CANVAS_H) * 0.35,
      CANVAS_W / 2, CANVAS_H / 2, Math.max(CANVAS_W, CANVAS_H) * 0.72,
    )
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(40, 22, 6, 0.18)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  }

  drawGrid(ctx) {
    ctx.strokeStyle = BOARD.grid
    ctx.lineWidth = 1

    // 横线
    for (let r = 0; r < ROWS; r++) {
      const y = PADDING + r * CELL_SIZE
      ctx.beginPath()
      ctx.moveTo(PADDING, y)
      ctx.lineTo(PADDING + (COLS - 1) * CELL_SIZE, y)
      ctx.stroke()
    }

    // 竖线（河界处断开）
    for (let c = 0; c < COLS; c++) {
      const x = PADDING + c * CELL_SIZE
      ctx.beginPath()
      if (c === 0 || c === COLS - 1) {
        // 边线贯通
        ctx.moveTo(x, PADDING)
        ctx.lineTo(x, PADDING + (ROWS - 1) * CELL_SIZE)
      } else {
        // 上半
        ctx.moveTo(x, PADDING)
        ctx.lineTo(x, PADDING + 4 * CELL_SIZE)
        // 下半
        ctx.moveTo(x, PADDING + 5 * CELL_SIZE)
        ctx.lineTo(x, PADDING + (ROWS - 1) * CELL_SIZE)
      }
      ctx.stroke()
    }

    // 兵/炮位标记（十字星）
    const markerPositions = [
      // 炮位
      { row: 2, col: 1 }, { row: 2, col: 7 },
      { row: 7, col: 1 }, { row: 7, col: 7 },
      // 兵/卒位
      { row: 3, col: 0 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 3, col: 6 }, { row: 3, col: 8 },
      { row: 6, col: 0 }, { row: 6, col: 2 }, { row: 6, col: 4 }, { row: 6, col: 6 }, { row: 6, col: 8 },
    ]

    for (const m of markerPositions) {
      this.drawStarMarker(ctx, m.row, m.col)
    }
  }

  /** 绘制十字星标记 */
  drawStarMarker(ctx, row, col) {
    const { x, y } = this.toCanvas(row, col)
    const len = 7
    const gap = 3.5

    ctx.strokeStyle = BOARD.star
    ctx.lineWidth = 1.15

    // 四个方向的短标记
    const parts = [
      // 左上
      [[-1, -1], [-len - gap, -1]],
      [[-1, -1], [-1, -len - gap]],
      // 右上
      [[1, -1], [len + gap, -1]],
      [[1, -1], [1, -len - gap]],
      // 左下
      [[-1, 1], [-len - gap, 1]],
      [[-1, 1], [-1, len + gap]],
      // 右下
      [[1, 1], [len + gap, 1]],
      [[1, 1], [1, len + gap]],
    ]

    for (const [from, to] of parts) {
      ctx.beginPath()
      ctx.moveTo(x + from[0], y + from[1])
      ctx.lineTo(x + to[0], y + to[1])
      ctx.stroke()
    }
  }

  /** 绘制行列坐标标注 */
  drawLabels(ctx) {
    ctx.save()
    ctx.font = `600 11px ${PIECE_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 行号：左边缘 & 右边缘，从 1（底部 row=9）到 10（顶部 row=0）
    ctx.fillStyle = 'rgba(61, 42, 22, 0.75)'
    for (let r = 0; r < ROWS; r++) {
      const label = String(10 - r)
      const y = PADDING + r * CELL_SIZE
      // 左
      ctx.textAlign = 'right'
      ctx.fillText(label, PADDING - 10, y)
      // 右
      ctx.textAlign = 'left'
      ctx.fillText(label, PADDING + (COLS - 1) * CELL_SIZE + 10, y)
    }

    // 列号：底部 & 顶部，从 1（col=0 左侧）到 9（col=8 右侧）
    ctx.textAlign = 'center'
    for (let c = 0; c < COLS; c++) {
      const label = String(c + 1)
      const x = PADDING + c * CELL_SIZE
      // 底部
      ctx.textBaseline = 'top'
      ctx.fillText(label, x, PADDING + (ROWS - 1) * CELL_SIZE + 6)
      // 顶部
      ctx.textBaseline = 'bottom'
      ctx.fillText(label, x, PADDING - 6)
    }

    ctx.restore()
  }

  drawRiver(ctx) {
    const y = PADDING + 4.5 * CELL_SIZE
    ctx.save()

    // 河带：略深的木色带 + 细边
    const rx = PADDING + 1
    const ry = PADDING + 4 * CELL_SIZE
    const rw = (COLS - 1) * CELL_SIZE - 2
    const rh = CELL_SIZE
    ctx.fillStyle = BOARD.river
    ctx.fillRect(rx, ry, rw, rh)
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.18)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(rx, ry + 0.5)
    ctx.lineTo(rx + rw, ry + 0.5)
    ctx.moveTo(rx, ry + rh - 0.5)
    ctx.lineTo(rx + rw, ry + rh - 0.5)
    ctx.stroke()

    // 楚河 漢界：书法描边字
    ctx.font = `bold 34px ${PIECE_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const left = PADDING + 1.5 * CELL_SIZE
    const right = PADDING + 6.5 * CELL_SIZE
    const leftText = this._flipped ? '漢  界' : '楚  河'
    const rightText = this._flipped ? '楚  河' : '漢  界'
    this._drawCalligraphy(ctx, leftText, left, y)
    this._drawCalligraphy(ctx, rightText, right, y)

    ctx.restore()
  }

  /** 匾额/书法字：浅描边 + 深填色 */
  _drawCalligraphy(ctx, text, x, y) {
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    ctx.lineWidth = 2.2
    ctx.strokeStyle = BOARD.riverStroke
    ctx.strokeText(text, x, y)
    ctx.fillStyle = BOARD.riverText
    ctx.fillText(text, x, y + 0.5)
  }

  drawPalace(ctx) {
    ctx.strokeStyle = BOARD.grid
    ctx.lineWidth = 1.35

    // 用逻辑坐标画 X，翻转时跟着棋子走
    const drawX = (r0, c0, r1, c1) => {
      const a = this.toCanvas(r0, c0)
      const b = this.toCanvas(r1, c1)
      const c = this.toCanvas(r0, c1)
      const d = this.toCanvas(r1, c0)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.moveTo(c.x, c.y)
      ctx.lineTo(d.x, d.y)
      ctx.stroke()
    }
    // 黑方九宫 (0-2, 3-5) · 红方九宫 (7-9, 3-5)
    drawX(0, 3, 2, 5)
    drawX(7, 3, 9, 5)

    // 九宫淡色底，增强仪式感
    ctx.save()
    for (const [r0, c0, r1, c1] of [[0, 3, 2, 5], [7, 3, 9, 5]]) {
      const a = this.toCanvas(r0, c0)
      const b = this.toCanvas(r1, c1)
      const x = Math.min(a.x, b.x)
      const y = Math.min(a.y, b.y)
      const w = Math.abs(b.x - a.x)
      const h = Math.abs(b.y - a.y)
      ctx.fillStyle = 'rgba(80, 45, 15, 0.06)'
      ctx.fillRect(x, y, w, h)
    }
    ctx.restore()
  }

  /** 棋盘四角回纹小饰 */
  drawBoardCorners(ctx) {
    const pad = PADDING
    const right = pad + (COLS - 1) * CELL_SIZE
    const bottom = pad + (ROWS - 1) * CELL_SIZE
    const s = 10
    ctx.save()
    ctx.strokeStyle = 'rgba(60, 40, 18, 0.35)'
    ctx.lineWidth = 1.2
    const corners = [
      [pad, pad, 1, 1],
      [right, pad, -1, 1],
      [pad, bottom, 1, -1],
      [right, bottom, -1, -1],
    ]
    for (const [x, y, sx, sy] of corners) {
      ctx.beginPath()
      ctx.moveTo(x, y + sy * s)
      ctx.lineTo(x, y)
      ctx.lineTo(x + sx * s, y)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x + sx * 3, y + sy * 3)
      ctx.lineTo(x + sx * 3, y + sy * (s - 2))
      ctx.lineTo(x + sx * (s - 2), y + sy * 3)
      ctx.stroke()
    }
    ctx.restore()
  }

  // ─── 棋子绘制 ─────────────────────────────────────

  drawPiece(ctx, x, y, piece, isSelected, isCheck, now) {
    const r = PIECE_RADIUS
    const char = PIECE_CHARS[piece.color][piece.type]
    const isRed = piece.color === RED

    ctx.save()

    // 阴影
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.38)'
    ctx.shadowBlur = 7
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 3

    // 棋子底：象牙/老木色
    const grad = ctx.createRadialGradient(x - 7, y - 9, 1, x, y, r)
    grad.addColorStop(0, '#faf0d8')
    grad.addColorStop(0.45, '#efdcb0')
    grad.addColorStop(0.82, '#d8bc78')
    grad.addColorStop(1, '#c4a050')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 外圈：红/黑双线（仿实体棋子）
    ctx.strokeStyle = isRed ? '#8b2e2e' : '#2a2a2a'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.arc(x, y, r - 0.5, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = isRed ? 'rgba(180, 50, 50, 0.55)' : 'rgba(40, 40, 40, 0.45)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(x, y, r - 5.5, 0, Math.PI * 2)
    ctx.stroke()

    // 字：描边 + 填色，篆印感
    ctx.font = `bold ${r * 1.12}px ${PIECE_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2.5, r * 0.1)
    ctx.strokeStyle = isRed ? 'rgba(255, 220, 200, 0.55)' : 'rgba(255, 255, 255, 0.35)'
    ctx.strokeText(char, x, y + 1)
    ctx.fillStyle = isRed ? '#b71c1c' : '#1a1a1a'
    ctx.fillText(char, x, y + 1)

    // 选中高亮
    if (isSelected) {
      ctx.strokeStyle = '#f0d78c'
      ctx.lineWidth = 2.5
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.arc(x, y, r + 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])

      const glow = ctx.createRadialGradient(x, y, r, x, y, r + 18)
      glow.addColorStop(0, 'rgba(240, 215, 140, 0.28)')
      glow.addColorStop(1, 'rgba(240, 215, 140, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, r + 18, 0, Math.PI * 2)
      ctx.fill()
    }

    // 将军高亮（可按系统设置关闭闪烁）
    if (isCheck && now) {
      const pulse = this.reduceMotion ? 0.55 : Math.sin(now / 160) * 0.5 + 0.5
      ctx.strokeStyle = `rgba(255, 40, 40, ${0.45 + pulse * 0.5})`
      ctx.lineWidth = 2.5 + pulse * 2
      ctx.beginPath()
      ctx.arc(x, y, r + 4 + pulse * 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = `rgba(255, 120, 60, ${0.2 + pulse * 0.35})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, r + 10 + pulse * 6, 0, Math.PI * 2)
      ctx.stroke()

      const pg = ctx.createRadialGradient(x, y, r * 0.4, x, y, r + 26 + pulse * 12)
      pg.addColorStop(0, `rgba(255, 40, 20, ${0.12 + pulse * 0.18})`)
      pg.addColorStop(1, 'rgba(255,0,0,0)')
      ctx.fillStyle = pg
      ctx.beginPath()
      ctx.arc(x, y, r + 26 + pulse * 12, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  /** 最后一步高亮 + 细箭头 */
  drawLastMoveHighlight(ctx, game) {
    if (!game.history || game.history.length === 0) return
    const last = game.history[game.history.length - 1]
    const fromPos = this.toCanvas(last.from.row, last.from.col)
    const toPos = this.toCanvas(last.to.row, last.to.col)
    const sz = CELL_SIZE * 0.88

    ctx.save()
    ctx.fillStyle = 'rgba(255, 215, 0, 0.16)'
    for (const p of [fromPos, toPos]) {
      ctx.beginPath()
      ctx.roundRect(p.x - sz / 2, p.y - sz / 2, sz, sz, 5)
      ctx.fill()
    }
    // 落点描边更亮一点
    ctx.strokeStyle = 'rgba(255, 200, 60, 0.35)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(toPos.x - sz / 2, toPos.y - sz / 2, sz, sz, 5)
    ctx.stroke()

    this._drawBoardArrow(ctx, fromPos.x, fromPos.y, toPos.x, toPos.y, {
      color: 'rgba(255, 190, 40, 0.55)',
      width: 2.2,
      head: 9,
    })
    ctx.restore()
  }

  /** AI 提示箭头（青色，与最后一步金色区分） */
  drawHintArrow(ctx, now) {
    if (!this.hintMove) return
    const { fromRow, fromCol, toRow, toCol } = this.hintMove
    const from = this.toCanvas(fromRow, fromCol)
    const to = this.toCanvas(toRow, toCol)
    const pulse = this.reduceMotion ? 0.5 : (now ? Math.sin(now / 280) * 0.5 + 0.5 : 0.5)

    ctx.save()
    // 起终点浅圈
    ctx.strokeStyle = `rgba(80, 200, 160, ${0.35 + pulse * 0.25})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(from.x, from.y, PIECE_RADIUS * 0.55, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(to.x, to.y, PIECE_RADIUS * 0.65, 0, Math.PI * 2)
    ctx.stroke()

    this._drawBoardArrow(ctx, from.x, from.y, to.x, to.y, {
      color: `rgba(64, 200, 160, ${0.55 + pulse * 0.3})`,
      width: 2.6,
      head: 11,
    })
    ctx.restore()
  }

  /** 棋盘上画箭头（不挡中心，略缩短） */
  _drawBoardArrow(ctx, x1, y1, x2, y2, opts = {}) {
    const color = opts.color || 'rgba(255,200,60,0.5)'
    const width = opts.width || 2
    const head = opts.head || 10
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len < 8) return
    const ux = dx / len
    const uy = dy / len
    // 从棋子边缘出发/到达，避免箭头穿心
    const pad = PIECE_RADIUS * 0.72
    const sx = x1 + ux * pad
    const sy = y1 + uy * pad
    const ex = x2 - ux * pad
    const ey = y2 - uy * pad

    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(ex, ey)
    ctx.stroke()

    const angle = Math.atan2(ey - sy, ex - sx)
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - head * Math.cos(angle - 0.4), ey - head * Math.sin(angle - 0.4))
    ctx.lineTo(ex - head * Math.cos(angle + 0.4), ey - head * Math.sin(angle + 0.4))
    ctx.closePath()
    ctx.fill()
  }

  /** 走法提示点 */
  drawMoveDot(ctx, x, y) {
    ctx.save()
    // 外晕 + 实心点
    const g = ctx.createRadialGradient(x, y, 0, x, y, 11)
    g.addColorStop(0, 'rgba(80, 200, 120, 0.55)')
    g.addColorStop(0.55, 'rgba(40, 160, 90, 0.35)')
    g.addColorStop(1, 'rgba(40, 160, 90, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(30, 170, 90, 0.75)'
    ctx.beginPath()
    ctx.arc(x, y, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /** 吃子提示（红色圈） */
  drawCaptureHint(ctx, x, y) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 70, 50, 0.55)'
    ctx.lineWidth = 2.5
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.arc(x, y, PIECE_RADIUS + 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    // 内红晕
    const g = ctx.createRadialGradient(x, y, PIECE_RADIUS * 0.4, x, y, PIECE_RADIUS + 6)
    g.addColorStop(0, 'rgba(255, 60, 40, 0.08)')
    g.addColorStop(1, 'rgba(255, 60, 40, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, PIECE_RADIUS + 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
