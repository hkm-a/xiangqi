// ============================================================
// 象棋 - 音效：轻提示音 + 中文语音播报（Web Speech API）
// 无需外部音频文件；系统需有中文语音包
// ============================================================

import { KING, ADVISOR, BISHOP, HORSE, ROOK, CANNON, PAWN } from './constants.js'

/** 棋子口语名（播报用） */
const SPOKEN_PIECE = {
  [KING]: '将',
  [ADVISOR]: '士',
  [BISHOP]: '象',
  [HORSE]: '马',
  [ROOK]: '车',
  [CANNON]: '炮',
  [PAWN]: '兵',
}

export class SoundManager {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null
    this.enabled = true
    this.volume = 0.35
    /** @type {SpeechSynthesisVoice|null} */
    this._voice = null
    this._voicesReady = false
  }

  /** 用户手势后初始化 AudioContext，并预热语音列表 */
  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)()
      } catch (e) {
        console.warn('[Sound] AudioContext 不可用:', e.message)
      }
    }
    this._loadVoices()
  }

  setEnabled(enabled) {
    this.enabled = enabled
    if (!enabled) this._cancelSpeech()
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v))
  }

  // ─── 对外事件 ─────────────────────────────────────

  /** 选子：轻音 + 棋子名 */
  playSelect(piece) {
    if (!this.enabled) return
    this._tick(680, 0.03, 0.1)
    if (piece?.type) this.speak(SPOKEN_PIECE[piece.type] || '', { rate: 1.15, volume: 0.85 })
  }

  /**
   * 走子：轻落子音 + 着法语音
   * @param {{ text?: string, piece?: { type: string } }} info
   */
  playMove(info = {}) {
    if (!this.enabled) return
    this._tick(480, 0.05, 0.16)
    this._tick(360, 0.04, 0.08)
    const line = info.text || (info.piece ? SPOKEN_PIECE[info.piece.type] : '') || '走'
    this.speak(line, { rate: 1.08, volume: 0.95 })
  }

  /**
   * 吃子
   * @param {{ text?: string, captured?: { type: string } }} info
   */
  playCapture(info = {}) {
    if (!this.enabled) return
    this._tick(220, 0.1, 0.28)
    setTimeout(() => this._tick(150, 0.08, 0.16), 35)
    const name = info.captured ? SPOKEN_PIECE[info.captured.type] : ''
    const line = info.text || (name ? `吃${name}` : '吃')
    this.speak(line, { rate: 1.05, volume: 1 })
  }

  /** 将军 */
  playCheck() {
    if (!this.enabled) return
    this._tick(760, 0.06, 0.18)
    this.speak('将军', { rate: 1.0, volume: 1, pitch: 1.05 })
  }

  /** 胜利 @param {string} [line] 如「红方胜」 */
  playWin(line = '你赢了') {
    if (!this.enabled) return
    ;[523, 659, 784].forEach((f, i) => setTimeout(() => this._tick(f, 0.12, 0.14), i * 120))
    this.speak(line, { rate: 0.95, volume: 1 })
  }

  /** 失败 */
  playLose(line = '你输了') {
    if (!this.enabled) return
    ;[400, 320].forEach((f, i) => setTimeout(() => this._tick(f, 0.14, 0.12), i * 140))
    this.speak(line, { rate: 0.92, volume: 1 })
  }

  /** 和棋 */
  playDraw() {
    if (!this.enabled) return
    this.speak('和棋', { rate: 1, volume: 0.95 })
  }

  /** 非法 */
  playIllegal() {
    if (!this.enabled) return
    this._tick(160, 0.07, 0.14)
    this.speak('不能走', { rate: 1.1, volume: 0.8 })
  }

  /** 新局 */
  playNewGame() {
    if (!this.enabled) return
    this.speak('新局', { rate: 1.05, volume: 0.9 })
  }

  // ─── 语音 ─────────────────────────────────────────

  /**
   * @param {string} text
   * @param {{ rate?: number, pitch?: number, volume?: number }} [opts]
   */
  speak(text, opts = {}) {
    if (!this.enabled || !text || typeof speechSynthesis === 'undefined') return
    this._loadVoices()
    this._cancelSpeech()

    const u = new SpeechSynthesisUtterance(String(text))
    u.lang = 'zh-CN'
    u.rate = opts.rate ?? 1.05
    u.pitch = opts.pitch ?? 1
    u.volume = Math.max(0, Math.min(1, (opts.volume ?? 1) * Math.min(1, this.volume + 0.55)))
    if (this._voice) u.voice = this._voice

    try {
      speechSynthesis.speak(u)
    } catch (e) {
      console.warn('[Sound] 语音播报失败:', e.message)
    }
  }

  _cancelSpeech() {
    try {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
    } catch { /* noop */ }
  }

  _loadVoices() {
    if (typeof speechSynthesis === 'undefined') return
    const pick = () => {
      const voices = speechSynthesis.getVoices() || []
      const zh = voices.filter((v) => /zh(-|_)?CN|Chinese|中文|普通话/i.test(`${v.lang} ${v.name}`))
      this._voice =
        zh.find((v) => /Xiaoxiao|Xiaoyi|Yunxi|Huihui|Yaoyao|Kangkang|Google.*Chinese|Microsoft.*Chinese/i.test(v.name)) ||
        zh[0] ||
        null
      this._voicesReady = voices.length > 0
    }
    pick()
    if (!this._voicesReady) {
      speechSynthesis.addEventListener('voiceschanged', pick, { once: true })
    }
  }

  _tick(frequency, duration, vol = 0.2) {
    if (!this.ctx || !this.enabled) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    const t0 = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, t0)
    gain.gain.setValueAtTime(vol * this.volume * 0.55, t0)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start(t0)
    osc.stop(t0 + duration + 0.03)
  }
}

export const sound = new SoundManager()
