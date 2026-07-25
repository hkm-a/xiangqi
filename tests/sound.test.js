import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SoundManager } from '../js/sound.js'

describe('SoundManager', () => {
  /** @type {SoundManager} */
  let sm

  beforeEach(() => {
    sm = new SoundManager()
    // Node 环境无 window，init 应安全失败
    globalThis.window = undefined
  })

  it('默认启用', () => {
    expect(sm.enabled).toBe(true)
  })

  it('setEnabled(false) 后不再排队播报', () => {
    sm.setEnabled(false)
    const spy = vi.spyOn(sm, '_speakTokens')
    sm.playCheck()
    sm.playIllegal()
    sm.playNewGame()
    expect(spy).not.toHaveBeenCalled()
  })

  it('setVolume 钳制到 0..1', () => {
    sm.setVolume(2)
    expect(sm.volume).toBe(1)
    sm.setVolume(-1)
    expect(sm.volume).toBe(0)
    sm.setVolume(0.4)
    expect(sm.volume).toBe(0.4)
  })

  it('playWin / playLose 按文案选择 token', () => {
    const calls = []
    sm._speakTokens = (tokens) => { calls.push(tokens) }
    sm.playWin('红方胜')
    sm.playLose('黑方胜')
    sm.playDraw()
    expect(calls[0]).toEqual(['e-hongsheng'])
    expect(calls[1]).toEqual(['e-heisheng'])
    expect(calls[2]).toEqual(['e-heqi'])
  })

  it('playMove 使用传入 tokens', () => {
    const calls = []
    sm._speakTokens = (tokens) => { calls.push(tokens) }
    sm.playMove({ tokens: ['p-che', 'n-2', 'v-jin', 'n-1'] })
    expect(calls[0]).toEqual(['p-che', 'n-2', 'v-jin', 'n-1'])
  })

  it('playMove check=true 时追加将军', () => {
    const calls = []
    sm._speakTokens = (tokens) => { calls.push(tokens) }
    sm.playMove({ tokens: ['p-che', 'n-2', 'v-jin', 'n-1'], check: true })
    expect(calls[0]).toEqual(['p-che', 'n-2', 'v-jin', 'n-1', 'e-jiangjun'])
  })

  it('playCapture check=true 时追加将军', () => {
    const calls = []
    sm._speakTokens = (tokens) => { calls.push(tokens) }
    sm.playCapture({ tokens: ['p-pao', 'n-2', 'v-ping', 'n-5'], check: true })
    expect(calls[0].at(-1)).toBe('e-jiangjun')
  })

  it('stop 提升 generation 以打断队列', () => {
    const g0 = sm._gen
    sm.stop()
    expect(sm._gen).toBe(g0 + 1)
  })

})
