import { describe, it, expect } from 'vitest'
import { createInitialBoard, cloneBoard } from '../js/pieces.js'
import { KING, ROOK, CANNON, HORSE, PAWN, RED, BLACK, ROWS, COLS } from '../js/constants.js'

const p = (type, color) => ({ type, color })

describe('Board flip', () => {
  function flipBoard(board) {
    const flipped = Array.from({ length: ROWS }, () => Array(COLS).fill(null))
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = board[r][c]
        if (piece) {
          flipped[ROWS - 1 - r][COLS - 1 - c] = { ...piece }
        }
      }
    }
    return flipped
  }

  it('should mirror the board 180 degrees', () => {
    const board = createInitialBoard()
    const flipped = flipBoard(board)
    // Top-left black rook should move to bottom-right
    expect(flipped[9][8]).toEqual(p(ROOK, BLACK))
    // Bottom-left red rook should move to top-right
    expect(flipped[0][8]).toEqual(p(ROOK, RED))
  })

  it('should swap colors visually (rotation, not color swap)', () => {
    const board = createInitialBoard()
    const flipped = flipBoard(board)
    // Black king at (0,4) → should be at (9,4) in flipped
    expect(flipped[9][4]).toEqual(p(KING, BLACK))
    // Red king at (9,4) → should be at (0,4) in flipped
    expect(flipped[0][4]).toEqual(p(KING, RED))
  })

  it('flipping twice returns original', () => {
    const board = createInitialBoard()
    const flipped = flipBoard(board)
    const flippedTwice = flipBoard(flipped)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        expect(flippedTwice[r][c]).toEqual(board[r][c])
      }
    }
  })
})
