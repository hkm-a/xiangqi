import { describe, it, expect } from 'vitest'
import {
  formatChineseMove,
  formatDisplayMove,
  formatHistoryText,
  fileNumber,
  spokenPieceName,
} from '../js/notation.js'
import { RED, BLACK, ROOK, CANNON, HORSE, PAWN, KING, ADVISOR, BISHOP } from '../js/constants.js'
import { Game } from '../js/game.js'

const move = (type, color, fr, fc, tr, tc, captured = null) => ({
  piece: { type, color },
  from: { row: fr, col: fc },
  to: { row: tr, col: tc },
  captured,
})

describe('notation', () => {
  it('红方路数自右向左', () => {
    expect(fileNumber(RED, 8)).toBe(1)
    expect(fileNumber(RED, 4)).toBe(5)
    expect(fileNumber(RED, 0)).toBe(9)
  })

  it('黑方路数自左向右', () => {
    expect(fileNumber(BLACK, 0)).toBe(1)
    expect(fileNumber(BLACK, 4)).toBe(5)
    expect(fileNumber(BLACK, 8)).toBe(9)
  })

  it('红车同路前进：车二进二', () => {
    // 红车在 col=7 → 路2，从 row=9 到 row=7
    const m = move(ROOK, RED, 9, 7, 7, 7)
    const r = formatChineseMove(m)
    expect(r.text).toBe('车二进二')
    expect(r.tokens).toEqual(['p-che', 'n-2', 'v-jin', 'n-2'])
    expect(formatDisplayMove(m)).toBe('俥二进二')
  })

  it('红炮横移：炮二平五', () => {
    // 红炮 (7,7) col=7 路2 → (7,4) col=4 路5
    const m = move(CANNON, RED, 7, 7, 7, 4)
    expect(formatChineseMove(m).text).toBe('炮二平五')
  })

  it('红马斜进写落点路数', () => {
    // 红马 (9,1) col=1 路8 → (7,2) col=2 路7
    const m = move(HORSE, RED, 9, 1, 7, 2)
    const r = formatChineseMove(m)
    expect(r.text).toBe('马八进七')
    expect(r.tokens).toContain('v-jin')
    expect(r.tokens).toContain('n-7')
  })

  it('黑卒前进', () => {
    // 黑卒 (3,4) col=4 路5 → (4,4)
    const m = move(PAWN, BLACK, 3, 4, 4, 4)
    expect(formatChineseMove(m).text).toBe('卒五进一')
  })

  it('口语棋子名', () => {
    expect(spokenPieceName({ type: ROOK, color: RED })).toBe('车')
    expect(spokenPieceName({ type: KING, color: BLACK })).toBe('将')
    expect(spokenPieceName({ type: PAWN, color: BLACK })).toBe('卒')
  })

  it('Game.getMoveText 使用中文记谱', () => {
    const game = new Game()
    // 红炮二平五
    expect(game.tryMove(7, 1, 7, 4)).toBe(true)
    const last = game.history.at(-1)
    expect(game.getMoveText(last)).toMatch(/炮.平./)
    const spoken = game.getSpokenMove(last)
    expect(spoken.tokens[0]).toBe('p-pao')
    expect(spoken.tokens).toContain('v-ping')
  })

  it('士象进退写落点', () => {
    const advisor = move(ADVISOR, RED, 9, 3, 8, 4)
    expect(formatChineseMove(advisor).text).toBe('士六进五')
    const bishop = move(BISHOP, RED, 9, 2, 7, 4)
    expect(formatChineseMove(bishop).text).toBe('象七进五')
  })

  it('formatHistoryText 导出整局记谱', () => {
    const hist = [
      move(CANNON, RED, 7, 1, 7, 4),
      move(HORSE, BLACK, 0, 1, 2, 2),
    ]
    const text = formatHistoryText(hist)
    expect(text).toMatch(/^1\..+ 2\..+/)
    expect(formatHistoryText([])).toBe('')
  })
})
