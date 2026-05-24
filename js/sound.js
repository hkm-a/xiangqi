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

  /** 播放走子音效 (短促点击声) */
  playMove() {
    if (!this._ready()) return
    this._playTone(600, 0.06, 'sine', 0.3)
  }

  /** 播放吃子音效 (较响的撞击声) */
  playCapture() {
    if (!this._ready()) return
    this._playTone(300, 0.15, 'triangle', 0.5)
    setTimeout(() => this._playTone(200, 0.1, 'sawtooth', 0.3), 50)
  }

  /** 播放将军音效 (警示音) */
  playCheck() {
    if (!this._ready()) return
    this._playTone(880, 0.1, 'square', 0.4)
    setTimeout(() => this._playTone(1100, 0.15, 'square', 0.3), 100)
  }

  /** 播放胜利音效 */
  playWin() {
    if (!this._ready()) return
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.2, 'sine', 0.3), i * 150)
    })
  }

  /** 播放失败音效 */
  playLose() {
    if (!this._ready()) return
    const notes = [400, 350, 300, 250]
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.25, 'sawtooth', 0.2), i * 200)
    })
  }

  /** 播放落子/选择音效 */
  playSelect() {
    if (!this._ready()) return
    this._playTone(800, 0.04, 'sine', 0.2)
  }

  /** 播放倒计时警告音 */
  playTimerWarning() {
    if (!this._ready()) return
    this._playTone(1000, 0.08, 'square', 0.3)
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
