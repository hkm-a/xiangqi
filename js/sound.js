// ============================================================
// 象棋 - 音效系统
// ============================================================

/**
 * 使用 Web Audio API 生成音效 (无需外部音频文件)
 */
export class SoundManager {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null
    this.enabled = true
    this.volume = 0.3
  }

  /** 初始化 AudioContext (必须在用户交互后调用) */
  init() {
    if (this.ctx) return
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch (e) {
      console.warn('[Sound] AudioContext not available:', e.message)
      this.enabled = false
    }
  }

  /** 启用/禁用音效 */
  setEnabled(enabled) {
    this.enabled = enabled
  }

  /** 设置音量 (0-1) */
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v))
  }

  /** 走子：短木子落盘 */
  playMove() {
    if (!this._ready()) return
    this._playTone(520, 0.05, 'sine', 0.22)
    this._playTone(380, 0.04, 'triangle', 0.12)
  }

  /** 吃子：略重一记 */
  playCapture() {
    if (!this._ready()) return
    this._playTone(240, 0.12, 'triangle', 0.38)
    setTimeout(() => this._playTone(160, 0.1, 'sine', 0.22), 40)
  }

  /** 将军：两声清亮提示 */
  playCheck() {
    if (!this._ready()) return
    this._playTone(740, 0.08, 'sine', 0.28)
    setTimeout(() => this._playTone(980, 0.12, 'sine', 0.24), 90)
  }

  /** 胜利 */
  playWin() {
    if (!this._ready()) return
    ;[523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.18, 'sine', 0.26), i * 140)
    })
  }

  /** 失败 */
  playLose() {
    if (!this._ready()) return
    ;[420, 340, 280].forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.2, 'triangle', 0.18), i * 160)
    })
  }

  /** 选子：更轻 */
  playSelect() {
    if (!this._ready()) return
    this._playTone(720, 0.03, 'sine', 0.12)
  }

  /** 非法落点：闷 ded */
  playIllegal() {
    if (!this._ready()) return
    this._playTone(180, 0.08, 'triangle', 0.18)
  }

  // ─── 内部 ─────────────────────────────────────────

  _ready() {
    if (!this.enabled || !this.ctx) return false
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return true
  }

  _playTone(frequency, duration, type = 'sine', vol = 0.3) {
    if (!this.ctx) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime)

    gain.gain.setValueAtTime(vol * this.volume, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration)

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start()
    osc.stop(this.ctx.currentTime + duration + 0.05)
  }
}

/** 全局音效管理器 */
export const sound = new SoundManager()
