import { describe, it, expect } from 'vitest'
import { createInitialBoard, cloneBoard } from '../js/pieces.js'
import { KING, ADVISOR, BISHOP, HORSE, ROOK, CANNON, PAWN, RED, BLACK, COLS, ROWS } from '../js/constants.js'
import { boardToFEN, fenToBoard, isValidFEN, START_FEN } from '../js/fen.js'

const p = (type, color) => ({ type, color })
function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

describe('START_FEN', () => {
  it('should equal the standard initial position FEN', () => {
    expect(START_FEN).toBe('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1')
  })
})

describe('boardToFEN()', () => {
  it('should produce correct FEN for initial position', () => {
    const board = createInitialBoard()
    expect(boardToFEN(board, RED)).toBe(START_FEN)
  })

  it('should represent empty squares with numbers', () => {
    const board = emptyBoard()
    board[0][0] = p(ROOK, RED)
    const fen = boardToFEN(board, RED)
    // Row 0: R at col 0, then 8 empties
    const rows = fen.split(' ')[0].split('/')
    expect(rows[0]).toBe('R8')
  })

  it('should encode red pieces in uppercase, black in lowercase', () => {
    const board = emptyBoard()
    board[9][0] = p(ROOK, RED)
    board[0][8] = p(ROOK, BLACK)
    const fen = boardToFEN(board, RED)
    const rows = fen.split(' ')[0].split('/')
    expect(rows[0]).toContain('r') // black rook is lowercase
    // Last row (index 9) has red rook
    expect(rows[9]).toContain('R')
  })

  it('should encode active color correctly', () => {
    const board = createInitialBoard()
    const fenRed = boardToFEN(board, RED)
    expect(fenRed.split(' ')[1]).toBe('w')
    const fenBlack = boardToFEN(board, BLACK)
    expect(fenBlack.split(' ')[1]).toBe('b')
  })

  it('should use correct piece letters', () => {
    const board = emptyBoard()
    board[0][0] = p(KING, RED)
    board[0][1] = p(ADVISOR, RED)
    board[0][2] = p(BISHOP, RED)
    board[0][3] = p(HORSE, RED)
    board[0][4] = p(ROOK, RED)
    board[0][5] = p(CANNON, RED)
    board[0][6] = p(PAWN, RED)
    const fen = boardToFEN(board, RED)
    const row = fen.split(' ')[0].split('/')[0]
    // N = kNight (horse), P = Pawn, then 2 empty squares
    expect(row).toBe('KABNRCP2')
  })
})

describe('fenToBoard()', () => {
  it('should reconstruct initial position from FEN', () => {
    const board = fenToBoard(START_FEN)
    expect(board.length).toBe(10)
    expect(board[0][0].type).toBe(ROOK)
    expect(board[0][0].color).toBe(BLACK)
    expect(board[9][0].type).toBe(ROOK)
    expect(board[9][0].color).toBe(RED)
  })

  it('should return null for invalid FEN', () => {
    expect(fenToBoard('')).toBeNull()
    expect(fenToBoard('invalid')).toBeNull()
  })

  it('should handle empty board FEN', () => {
    // 10 rows of 9 empty squares
    const fen = '9/9/9/9/9/9/9/9/9/9 w - - 0 1'
    const board = fenToBoard(fen)
    expect(board).not.toBeNull()
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        expect(board[r][c]).toBeNull()
      }
    }
  })

  it('should return null for wrong number of rows', () => {
    const fen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9 w - - 0 1'
    expect(fenToBoard(fen)).toBeNull()
  })

  it('should encode active color correctly', () => {
    const board = createInitialBoard()
    const fen = boardToFEN(board, BLACK)
    const board2 = fenToBoard(fen)
    // Verify the boards match
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        expect(board2[r][c]).toEqual(board[r][c])
      }
    }
  })
})

describe('isValidFEN()', () => {
  it('should accept standard start FEN', () => {
    expect(isValidFEN(START_FEN)).toBe(true)
  })

  it('should reject empty string', () => {
    expect(isValidFEN('')).toBe(false)
  })

  it('should reject FEN with wrong row count', () => {
    expect(isValidFEN('rnbakabnr/9/1c5c1 w - - 0 1')).toBe(false)
  })

  it('should reject FEN with invalid characters', () => {
    expect(isValidFEN('9/9/9/9/9/9/9/9/9/X w - - 0 1')).toBe(false)
  })

  it('should reject FEN with wrong column count in a row', () => {
    // Row says 9 but actually 10 columns when expanded
    const fen = 'rrrrrrrrrr/9/9/9/9/9/9/9/9/9 w - - 0 1'
    expect(isValidFEN(fen)).toBe(false)
  })
})

describe('Round-trip FEN conversion', () => {
  it('should preserve board state through FEN round-trip', () => {
    const original = createInitialBoard()
    const fen = boardToFEN(original, RED)
    const restored = fenToBoard(fen)
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        expect(restored[r][c]).toEqual(original[r][c])
      }
    }
  })

  it('should handle custom positions', () => {
    const board = emptyBoard()
    board[0][4] = p(KING, BLACK)
    board[9][4] = p(KING, RED)
    board[5][0] = p(ROOK, RED)
    board[5][8] = p(ROOK, BLACK)
    board[2][4] = p(PAWN, RED)
    board[7][3] = p(ADVISOR, RED)

    const fen = boardToFEN(board, RED)
    const restored = fenToBoard(fen)

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        expect(restored[r][c]).toEqual(board[r][c])
      }
    }
  })
})
