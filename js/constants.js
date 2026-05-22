// ============================================================
// 象棋 - 常量定义
// ============================================================

// 棋子类型
export const KING    = 'king'
export const ADVISOR = 'advisor'
export const BISHOP  = 'bishop'
export const HORSE   = 'horse'
export const ROOK    = 'rook'
export const CANNON  = 'cannon'
export const PAWN    = 'pawn'

// 颜色阵营
export const RED   = 'red'
export const BLACK = 'black'

// 棋盘尺寸
export const COLS = 9
export const ROWS = 10

// 红方在下方（row 7-9），黑方在上方（row 0-2）
export const RED_PALACE   = { rowMin: 7, rowMax: 9, colMin: 3, colMax: 5 }
export const BLACK_PALACE = { rowMin: 0, rowMax: 2, colMin: 3, colMax: 5 }

// 棋盘渲染常量
export const CELL_SIZE  = 64
export const PADDING    = 55
export const PIECE_RADIUS = 27
export const CANVAS_W = PADDING * 2 + (COLS - 1) * CELL_SIZE  // 622
export const CANVAS_H = PADDING * 2 + (ROWS - 1) * CELL_SIZE  // 686

// 棋子汉字显示
export const PIECE_CHARS = {
  [RED]: {
    [KING]:    '帥',
    [ADVISOR]: '仕',
    [BISHOP]:  '相',
    [HORSE]:   '傌',
    [ROOK]:    '俥',
    [CANNON]:  '炮',
    [PAWN]:    '兵',
  },
  [BLACK]: {
    [KING]:    '將',
    [ADVISOR]: '士',
    [BISHOP]:  '象',
    [HORSE]:   '馬',
    [ROOK]:    '車',
    [CANNON]:  '砲',
    [PAWN]:    '卒',
  },
}

// 棋子基础分值（centipawn）
export const PIECE_VALUES = {
  [KING]:    10000,
  [ROOK]:    600,
  [CANNON]:  285,
  [HORSE]:   270,
  [BISHOP]:  120,
  [ADVISOR]: 120,
  [PAWN]:    30,
}
