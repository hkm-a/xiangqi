// ============================================================
// 象棋 - 传统中文着法记谱（车五进一）
// 红方路数自右向左 一二三…；黑方自左向右 一二三…
// ============================================================
import {
  RED, BLACK, KING, ADVISOR, BISHOP, HORSE, ROOK, CANNON, PAWN, PIECE_CHARS,
} from './constants.js'

/** 口语棋子名（TTS / 播报） */
const SPOKEN_PIECE = {
  [KING]: { [RED]: 'p-shuai', [BLACK]: 'p-jiang' },
  [ADVISOR]: { [RED]: 'p-shi', [BLACK]: 'p-shi' },
  [BISHOP]: { [RED]: 'p-xiang', [BLACK]: 'p-xiang' },
  [HORSE]: { [RED]: 'p-ma', [BLACK]: 'p-ma' },
  [ROOK]: { [RED]: 'p-che', [BLACK]: 'p-che' },
  [CANNON]: { [RED]: 'p-pao', [BLACK]: 'p-pao' },
  [PAWN]: { [RED]: 'p-bing', [BLACK]: 'p-zu' },
}

/** 斜行子：进退后写落点路数，而非步数 */
const DIAGONAL = new Set([HORSE, ADVISOR, BISHOP])

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九']

/**
 * 路数：红右→左为 1…9；黑左→右为 1…9
 * @param {string} color
 * @param {number} col
 */
export function fileNumber(color, col) {
  return color === RED ? 9 - col : col + 1
}

/**
 * @param {number} n 1..9
 * @returns {string}
 */
export function cnDigit(n) {
  return CN_NUM[n - 1] || String(n)
}

/**
 * 棋子口语 token（对应 public/tts/*.mp3）
 * @param {{ type: string, color: string }} piece
 */
export function spokenPieceToken(piece) {
  if (!piece?.type) return null
  const map = SPOKEN_PIECE[piece.type]
  if (!map) return null
  return map[piece.color] || map[RED]
}

/**
 * 棋子口语汉字
 * @param {{ type: string, color: string }} piece
 */
export function spokenPieceName(piece) {
  const token = spokenPieceToken(piece)
  const names = {
    'p-che': '车', 'p-ma': '马', 'p-pao': '炮', 'p-bing': '兵', 'p-zu': '卒',
    'p-jiang': '将', 'p-shuai': '帅', 'p-shi': '士', 'p-xiang': '象',
  }
  return names[token] || PIECE_CHARS[piece.color]?.[piece.type] || ''
}

/**
 * 将一步棋转为传统中文记谱 + TTS token 序列
 * @param {{ piece: {type:string,color:string}, from:{row:number,col:number}, to:{row:number,col:number}, captured?: object|null }} move
 * @returns {{ text: string, tokens: string[], displayChar: string }}
 */
export function formatChineseMove(move) {
  const piece = move.piece
  const from = move.from
  const to = move.to
  const color = piece.color
  const displayChar = PIECE_CHARS[color][piece.type]
  const spoken = spokenPieceName(piece)
  const pieceTok = spokenPieceToken(piece)

  const fromFile = fileNumber(color, from.col)
  const toFile = fileNumber(color, to.col)
  const fromNum = cnDigit(fromFile)
  const tokens = []
  if (pieceTok) tokens.push(pieceTok)
  tokens.push(`n-${fromFile}`)

  let verb
  let destNum
  let destTok

  if (from.col === to.col) {
    // 同路：进 / 退
    const forward = color === RED ? to.row < from.row : to.row > from.row
    verb = forward ? '进' : '退'
    tokens.push(forward ? 'v-jin' : 'v-tui')
    if (DIAGONAL.has(piece.type)) {
      destNum = cnDigit(toFile)
      destTok = `n-${toFile}`
    } else {
      const steps = Math.abs(to.row - from.row)
      destNum = cnDigit(steps)
      destTok = `n-${steps}`
    }
  } else if (from.row === to.row) {
    // 同行：平
    verb = '平'
    tokens.push('v-ping')
    destNum = cnDigit(toFile)
    destTok = `n-${toFile}`
  } else {
    // 马/象/士等斜行
    const forward = color === RED ? to.row < from.row : to.row > from.row
    verb = forward ? '进' : '退'
    tokens.push(forward ? 'v-jin' : 'v-tui')
    destNum = cnDigit(toFile)
    destTok = `n-${toFile}`
  }

  tokens.push(destTok)
  const text = `${spoken}${fromNum}${verb}${destNum}`
  return { text, tokens, displayChar }
}

/**
 * 界面显示用短记谱：棋子汉字 + 路数动词
 * 例：俥五进一
 */
export function formatDisplayMove(move) {
  const { text, displayChar } = formatChineseMove(move)
  // 用盘面汉字替换口语首字
  return displayChar + text.slice(spokenPieceName(move.piece).length)
}

/**
 * 整局记谱文本（复制导出）
 * @param {Array<object>} history
 * @param {(m: object) => string} [formatMove]
 */
export function formatHistoryText(history, formatMove = formatDisplayMove) {
  if (!history?.length) return ''
  return history.map((m, i) => `${i + 1}.${formatMove(m)}`).join(' ')
}
