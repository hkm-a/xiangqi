// ============================================================
// 象棋 - Canvas 棋盘渲染器
// ============================================================
import { RED, BLACK,
  COLS, ROWS, CELL_SIZE, PADDING, PIECE_RADIUS, CANVAS_W, CANVAS_H,
  PIECE_CHARS } from './constants.js'

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.dpr = window.devicePixelRatio || 1
    this.ctx = canvas.getContext('2d')

    // Retina 高清适配：物理像素 = 逻辑像素 × dpr
    canvas.style.width = CANVAS_W + 'px'
    canvas.style.height = CANVAS_H + 'px'
    canvas.width = CANVAS_W * this.dpr
    canvas.height = CANVAS_H * this.dpr
    this.ctx.scale(this.dpr, this.dpr)

    // 动画状态
    this.animPiece = null
    this.animStart = null
    this.animDuration = 180 // ms

    // 吃子闪光效果
    this.captureFlash = null // { row, col, start }
    this.flashDuration = 300 // ms
  }

  /** 触发吃子闪光 */
  triggerCaptureFlash(row, col) {
    this.captureFlash = { row, col, start: performance.now() }
  }

  /** 开始棋子移动动画 */
  startAnim(fromRow, fromCol, toRow, toCol, piece) {
    this.animPiece = {
      piece,
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
    }
    this.animStart = performance.now()
  }

  /** 获取棋子在画布上的坐标 */
  toCanvas(row, col) {
    return {
      x: PADDING + col * CELL_SIZE,
      y: PADDING + row * CELL_SIZE,
    }
  }

  /** 根据画布坐标获取棋盘位置 */
  toBoard(x, y) {
    const col = Math.round((x - PADDING) / CELL_SIZE)
    const row = Math.round((y - PADDING) / CELL_SIZE)
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null
    // 距离检查
    const pos = this.toCanvas(row, col)
    const dist = Math.hypot(x - pos.x, y - pos.y)
    if (dist > CELL_SIZE * 0.6) return null
    return { row, col }
  }

  /** 主渲染循环 */
  render(game, now) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    this.drawBoard(ctx)
    this.drawGrid(ctx)
    this.drawRiver(ctx)
    this.drawPalace(ctx)

    // 动画更新
    let animPos = null
    if (this.animPiece && this.animStart !== null) {
      const elapsed = now - this.animStart
      const t = Math.min(elapsed / this.animDuration, 1)
      const ease = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const fromPos = this.toCanvas(this.animPiece.from.row, this.animPiece.from.col)
      const toPos = this.toCanvas(this.animPiece.to.row, this.animPiece.to.col)

      if (t < 1) {
        animPos = {
          x: fromPos.x + (toPos.x - fromPos.x) * ease,
          y: fromPos.y + (toPos.y - fromPos.y) * ease,
          piece: this.animPiece.piece,
          fromRow: this.animPiece.from.row,
          fromCol: this.animPiece.from.col,
          toRow: this.animPiece.to.row,
          toCol: this.animPiece.to.col,
        }
      } else {
        this.animPiece = null
        this.animStart = null
      }
    }

    // 绘制有效走法提示
    if (game.selected) {
      const moves = game.getSelectedMoves()
      for (const m of moves) {
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

        const piece = game.board[r][c]
        if (piece) {
          const pos = this.toCanvas(r, c)
          const isSelected = game.selected && game.selected.row === r && game.selected.col === c
          this.drawPiece(ctx, pos.x, pos.y, piece, isSelected)
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

    // 绘制动画中的棋子（在最上层）
    if (animPos) {
      const isSelected = game.selected &&
        game.selected.row === animPos.piece.fromRow &&
        game.selected.col === animPos.piece.fromCol
      this.drawPiece(ctx, animPos.x, animPos.y, animPos.piece, isSelected)
    }
  }

  // ─── 棋盘绘制 ─────────────────────────────────────

  drawBoard(ctx) {
    // 木板底色
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H)
    grad.addColorStop(0, '#d4a853')
    grad.addColorStop(0.3, '#c49a45')
    grad.addColorStop(0.6, '#d4a853')
    grad.addColorStop(1, '#b8893a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // 木板纹理 - 细横纹
    ctx.strokeStyle = 'rgba(139,90,43,0.12)'
    ctx.lineWidth = 1
    for (let y = 0; y < CANVAS_H; y += 6) {
      ctx.beginPath()
      ctx.moveTo(0, y + Math.random() * 2)
      ctx.lineTo(CANVAS_W, y + Math.random() * 2)
      ctx.stroke()
    }

    // 木板纹理 - 竖纹
    ctx.strokeStyle = 'rgba(139,90,43,0.06)'
    for (let x = 0; x < CANVAS_W; x += 40 + Math.random() * 30) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_H)
      ctx.stroke()
    }

    // 木板边框阴影（内）
    const vGrad = ctx.createLinearGradient(0, 0, 20, 0)
    vGrad.addColorStop(0, 'rgba(0,0,0,0.15)')
    vGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = vGrad
    ctx.fillRect(0, 0, 20, CANVAS_H)

    // 右下角高光
    const hGrad = ctx.createLinearGradient(0, CANVAS_H - 20, 0, CANVAS_H)
    hGrad.addColorStop(0, 'rgba(255,255,255,0.05)')
    hGrad.addColorStop(1, 'rgba(255,255,255,0.15)')
    ctx.fillStyle = hGrad
    ctx.fillRect(0, CANVAS_H - 20, CANVAS_W, 20)
  }

  drawGrid(ctx) {
    ctx.strokeStyle = '#4a3520'
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
    const len = 6
    const gap = 4

    ctx.strokeStyle = '#4a3520'
    ctx.lineWidth = 1

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

  drawRiver(ctx) {
    const y = PADDING + 4.5 * CELL_SIZE
    ctx.save()

    // 河水效果
    ctx.fillStyle = 'rgba(100, 180, 255, 0.06)'
    ctx.fillRect(PADDING + 1, PADDING + 4 * CELL_SIZE, (COLS - 1) * CELL_SIZE - 2, CELL_SIZE)

    // 楚河 漢界 文字
    ctx.font = 'bold 32px "KaiTi", "STKaiti", "楷体", serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 左：楚河
    ctx.fillStyle = 'rgba(60, 40, 20, 0.5)'
    ctx.fillText('楚  河', PADDING + 1.5 * CELL_SIZE, y)

    // 右：漢界
    ctx.fillText('漢  界', PADDING + 6.5 * CELL_SIZE, y)

    ctx.restore()
  }

  drawPalace(ctx) {
    ctx.strokeStyle = '#4a3520'
    ctx.lineWidth = 1

    // 黑方九宫格（上方）
    const x1 = PADDING + 3 * CELL_SIZE
    const x2 = PADDING + 5 * CELL_SIZE
    const y0 = PADDING
    const y2 = PADDING + 2 * CELL_SIZE
    ctx.beginPath()
    ctx.moveTo(x1, y0)
    ctx.lineTo(x2, y2)
    ctx.moveTo(x2, y0)
    ctx.lineTo(x1, y2)
    ctx.stroke()

    // 红方九宫格（下方）
    const y7 = PADDING + 7 * CELL_SIZE
    const y9 = PADDING + 9 * CELL_SIZE
    ctx.beginPath()
    ctx.moveTo(x1, y7)
    ctx.lineTo(x2, y9)
    ctx.moveTo(x2, y7)
    ctx.lineTo(x1, y9)
    ctx.stroke()
  }

  // ─── 棋子绘制 ─────────────────────────────────────

  drawPiece(ctx, x, y, piece, isSelected) {
    const r = PIECE_RADIUS
    const char = PIECE_CHARS[piece.color][piece.type]

    ctx.save()

    // 阴影
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 3

    // 棋子底色（立体效果）
    const grad = ctx.createRadialGradient(x - 6, y - 8, 2, x, y, r)
    grad.addColorStop(0, '#f5e6c8')
    grad.addColorStop(0.5, '#e8d5a8')
    grad.addColorStop(0.85, '#d4b87a')
    grad.addColorStop(1, '#c4a460')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 边框
    ctx.strokeStyle = piece.color === RED ? '#8b3a3a' : '#333'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()

    // 内圈装饰
    ctx.strokeStyle = piece.color === RED ? 'rgba(200, 60, 60, 0.3)' : 'rgba(60, 60, 60, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(x, y, r - 5, 0, Math.PI * 2)
    ctx.stroke()

    // 文字
    ctx.font = `bold ${r * 1.1}px "KaiTi", "STKaiti", "楷体", "Microsoft YaHei", serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (piece.color === RED) {
      ctx.fillStyle = '#c62828'
      ctx.shadowColor = 'rgba(198,40,40,0.2)'
    } else {
      ctx.fillStyle = '#1a1a1a'
      ctx.shadowColor = 'rgba(0,0,0,0.15)'
    }
    ctx.shadowBlur = 2
    ctx.fillText(char, x, y + 1)

    // 选中高亮
    if (isSelected) {
      ctx.shadowBlur = 0
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = 3
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.arc(x, y, r + 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])

      // 光晕
      const glow = ctx.createRadialGradient(x, y, r, x, y, r + 18)
      glow.addColorStop(0, 'rgba(255,215,0,0.2)')
      glow.addColorStop(1, 'rgba(255,215,0,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, r + 18, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  /** 走法提示点 */
  drawMoveDot(ctx, x, y) {
    ctx.save()
    ctx.fillStyle = 'rgba(0, 180, 0, 0.45)'
    ctx.beginPath()
    ctx.arc(x, y, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /** 吃子提示（红色圈） */
  drawCaptureHint(ctx, x, y) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.5)'
    ctx.lineWidth = 2.5
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.arc(x, y, PIECE_RADIUS + 4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }
}
