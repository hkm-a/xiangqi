// ============================================================
// 象棋 - 离线中文 TTS 播报
// 片段由 scripts/generate-tts.mjs（node-edge-tts）预生成
// 自然听感：生成仅微加速，运行时接近原速；音节间留短间隙
// ============================================================

import { spokenPieceToken } from './notation.js'

/** 基路径：Vite 下 public/tts → /tts */
const TTS_BASE = `${import.meta.env?.BASE_URL || './'}tts/`

/**
 * 播放倍速：≈原速（预生成已是 +8%）
 * 旧版 1.35x 叠 +45% 会明显「人机」
 */
const PLAYBACK_RATE = 1.02
/** 裁静音阈值（略保守，保留尾音气口） */
const SILENCE_RATIO = 0.028
/** 音节间隙（秒）：正值更像人说话，避免叠读发硬 */
const CLIP_GAP = 0.045

export class SoundManager {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null
    this.enabled = true
    this.volume = 0.92
    this.rate = PLAYBACK_RATE
    /** @type {Map<string, AudioBuffer>} */
    this._cache = new Map()
    /** @type {AudioBufferSourceNode[]} */
    this._playing = []
    /** 串行队列 */
    this._queue = Promise.resolve()
    this._gen = 0
    this._ready = false
    /** 当前句是否含关键事件（将军等），未播完时新着法排队不打断 */
    this._protectCheck = false
  }

  /** 用户手势后初始化 AudioContext，并预热关键片段 */
  init() {
    if (!this.ctx) {
      try {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext
          || (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
        if (!AC) return
        this.ctx = new AC()
      } catch (e) {
        console.warn('[Sound] AudioContext 不可用:', e.message)
        return
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    if (!this._ready) {
      this._ready = true
      // 仅预热最常卡顿的两句；其余按需加载，冷启动更轻
      if (this.enabled) {
        ;['e-jiangjun', 'e-buneng'].forEach((k) => { this._load(k).catch(() => {}) })
      }
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled
    if (!enabled) this.stop()
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v))
  }

  /** 停止当前播放 */
  stop() {
    this._gen++
    for (const src of this._playing) {
      try { src.stop() } catch { /* noop */ }
    }
    this._playing = []
  }

  // ─── 对外事件 ─────────────────────────────────────

  /** 选子：播报棋子名 */
  playSelect(piece) {
    if (!this.enabled) return
    const tok = spokenPieceToken(piece)
    if (tok) this._speakTokens([tok])
  }

  /**
   * 走子 / 吃子 / 将军：同一 token 序列一次播完
   * @param {{ tokens?: string[], check?: boolean, fallback?: string }} info
   */
  playMove(info = {}) {
    if (!this.enabled) return
    const tokens = info.tokens?.length ? [...info.tokens] : [info.fallback || 'e-zou']
    if (info.check) tokens.push('e-jiangjun')
    this._speakTokens(tokens)
  }

  /** 吃子（语义别名，默认 fallback 为 e-chi） */
  playCapture(info = {}) {
    this.playMove({ ...info, fallback: info.fallback || 'e-chi' })
  }

  /** 单独播报将军 */
  playCheck() {
    if (!this.enabled) return
    this._speakTokens(['e-jiangjun'], { priority: true })
  }

  /** 胜利 @param {string} [line] */
  playWin(line = '你赢了') {
    if (!this.enabled) return
    const tok = line.includes('红') ? 'e-hongsheng'
      : line.includes('黑') ? 'e-heisheng'
        : 'e-niying'
    this._speakTokens([tok])
  }

  /** 失败 */
  playLose(line = '你输了') {
    if (!this.enabled) return
    const tok = line.includes('红') ? 'e-hongsheng'
      : line.includes('黑') ? 'e-heisheng'
        : 'e-nishu'
    this._speakTokens([tok])
  }

  playDraw() {
    if (!this.enabled) return
    this._speakTokens(['e-heqi'])
  }

  playIllegal() {
    if (!this.enabled) return
    this._speakTokens(['e-buneng'])
  }

  playNewGame() {
    if (!this.enabled) return
    this._speakTokens(['e-xinju'])
  }

  // ─── 内部 ─────────────────────────────────────────

  /**
   * @param {string[]} tokens
   * @param {{ priority?: boolean }} [opts]
   */
  _speakTokens(tokens, opts = {}) {
    if (!tokens?.length) return
    this.init()

    const hasCheck = tokens.includes('e-jiangjun')
    const isTerminal = tokens.some((t) =>
      t === 'e-hongsheng' || t === 'e-heisheng' || t === 'e-niying' || t === 'e-nishu' || t === 'e-heqi')

    // 正在播「…将军」时：终局可打断；普通着法（含 AI 回手）排队等将军说完
    if (this._protectCheck && !isTerminal && !opts.priority) {
      this._queue = this._queue.then(() => {
        this._protectCheck = false
        this._speakTokens(tokens, { priority: true })
      })
      return
    }

    const gen = ++this._gen
    for (const src of this._playing) {
      try { src.stop() } catch { /* noop */ }
    }
    this._playing = []
    this._protectCheck = hasCheck

    this._queue = Promise.resolve().then(async () => {
      if (gen !== this._gen) return
      for (const key of tokens) {
        if (gen !== this._gen) return
        try {
          const buf = await this._load(key)
          if (gen !== this._gen) return
          await this._playBuffer(buf)
        } catch (e) {
          console.warn('[Sound] 播放失败:', key, e.message)
        }
      }
      if (gen === this._gen) this._protectCheck = false
    }).catch(() => {
      this._protectCheck = false
    })
  }

  /**
   * @param {string} key
   * @returns {Promise<AudioBuffer>}
   */
  async _load(key) {
    if (this._cache.has(key)) return this._cache.get(key)
    if (!this.ctx) this.init()
    if (!this.ctx) throw new Error('无 AudioContext')

    const url = `${TTS_BASE}${key}.mp3`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
    const raw = await res.arrayBuffer()
    let buf = await this.ctx.decodeAudioData(raw.slice(0))
    buf = this._trimSilence(buf)
    this._cache.set(key, buf)
    return buf
  }

  /**
   * 裁掉首尾静音，缩短拼接着法总时长
   * @param {AudioBuffer} buffer
   * @returns {AudioBuffer}
   */
  _trimSilence(buffer) {
    if (!this.ctx || buffer.length < 128) return buffer
    const ch = buffer.getChannelData(0)
    const n = ch.length
    let peak = 0
    for (let i = 0; i < n; i++) {
      const a = Math.abs(ch[i])
      if (a > peak) peak = a
    }
    if (peak < 1e-5) return buffer
    const thr = peak * SILENCE_RATIO
    let start = 0
    let end = n - 1
    while (start < n && Math.abs(ch[start]) < thr) start++
    while (end > start && Math.abs(ch[end]) < thr) end--
    // 保留极短淡入淡出边距
    const pad = Math.min(64, Math.floor((end - start) * 0.02))
    start = Math.max(0, start - pad)
    end = Math.min(n - 1, end + pad)
    const len = end - start + 1
    if (len >= n * 0.92) return buffer // 几乎无静音，原样返回
    if (len < 32) return buffer

    const out = this.ctx.createBuffer(buffer.numberOfChannels, len, buffer.sampleRate)
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      out.copyToChannel(buffer.getChannelData(c).subarray(start, end + 1), c)
    }
    return out
  }

  /**
   * @param {AudioBuffer} buffer
   * @returns {Promise<void>}
   */
  _playBuffer(buffer) {
    return new Promise((resolve) => {
      if (!this.ctx || !this.enabled) {
        resolve()
        return
      }
      if (this.ctx.state === 'suspended') this.ctx.resume()

      const src = this.ctx.createBufferSource()
      const gain = this.ctx.createGain()
      src.buffer = buffer
      src.playbackRate.value = this.rate
      gain.gain.value = this.volume
      src.connect(gain)
      gain.connect(this.ctx.destination)

      // 短淡入淡出，拼接时少爆音、更不「电子」
      const now = this.ctx.currentTime
      const dur = buffer.duration / this.rate
      const fade = Math.min(0.012, dur * 0.08)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(this.volume, now + fade)
      if (dur > fade * 2) {
        gain.gain.setValueAtTime(this.volume, now + dur - fade)
        gain.gain.linearRampToValueAtTime(0.0001, now + dur)
      }

      this._playing.push(src)
      // 有效时长 + 音节间隙
      const durationMs = Math.max(50, (dur + CLIP_GAP) * 1000)
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        this._playing = this._playing.filter((s) => s !== src)
        try { src.stop() } catch { /* 可能已结束 */ }
        resolve()
      }
      src.onended = done
      try {
        src.start(0)
        setTimeout(done, durationMs)
      } catch {
        done()
      }
    })
  }
}

export const sound = new SoundManager()
