import { describe, it, expect, beforeEach } from 'vitest'
import { Game } from '../js/game.js'
import { RED, BLACK } from '../js/constants.js'

describe('悔棋与重复局面', () => {
  /** @type {Game} */
  let game

  beforeEach(() => {
    game = new Game()
  })

  it('undo 每次只撤一手', () => {
    game.tryMove(7, 1, 7, 4) // 红
    game.tryMove(0, 1, 2, 2) // 黑马
    expect(game.history.length).toBe(2)
    game.undo()
    expect(game.history.length).toBe(1)
    expect(game.turn).toBe(BLACK)
    game.undo()
    expect(game.history.length).toBe(0)
    expect(game.turn).toBe(RED)
  })

  it('aiMode 下 undo 仍只撤一手（双倍由 UI 控制）', () => {
    game.aiMode = true
    game.tryMove(7, 1, 7, 4)
    game.tryMove(0, 1, 2, 2)
    game.undo()
    expect(game.history.length).toBe(1)
  })

  it('makeMove 会 record 局面，悔棋 unrecord', () => {
    game.tryMove(7, 1, 7, 4)
    expect(game.repetition.moveLog.length).toBe(1)
    const countAfter = game.repetition.getCount(game.board, game.turn)
    expect(countAfter).toBeGreaterThanOrEqual(1)
    game.undo()
    expect(game.repetition.moveLog.length).toBe(0)
  })
})
