/**
 * 用 node-edge-tts（edge-tts 生态）预生成离线中文语音。
 * 目标：自然、不「人机」——生成阶段仅微加速，运行时不再叠倍速。
 *
 * 用法: node scripts/generate-tts.mjs
 * 强制重生成: node scripts/generate-tts.mjs --force
 */
import { EdgeTTS } from 'node-edge-tts'
import { mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '../public/tts')

/**
 * 音色：云希（男声）比晓晓更像棋评，少客服感
 * 可选备胎：zh-CN-XiaoxiaoNeural / zh-CN-YunjianNeural
 */
const VOICE = 'zh-CN-YunxiNeural'

/** @type {Record<string, string>} 文件名 → 播报文本 */
const CLIPS = {
  // 棋子：加轻语气词边界，单字更稳
  'p-che': '车',
  'p-ma': '马',
  'p-pao': '炮',
  'p-bing': '兵',
  'p-zu': '卒',
  'p-jiang': '将',
  'p-shuai': '帅',
  'p-shi': '士',
  'p-xiang': '象',
  // 数字
  'n-1': '一',
  'n-2': '二',
  'n-3': '三',
  'n-4': '四',
  'n-5': '五',
  'n-6': '六',
  'n-7': '七',
  'n-8': '八',
  'n-9': '九',
  // 走法
  'v-jin': '进',
  'v-tui': '退',
  'v-ping': '平',
  // 事件：完整短句，语调更自然
  'e-jiangjun': '将军！',
  'e-buneng': '不能走。',
  'e-heqi': '和棋。',
  'e-xinju': '新的一局。',
  'e-hongsheng': '红方胜。',
  'e-heisheng': '黑方胜。',
  'e-niying': '你赢了。',
  'e-nishu': '你输了。',
  'e-chi': '吃',
  'e-zou': '走',
}

const tts = new EdgeTTS({
  voice: VOICE,
  lang: 'zh-CN',
  // 稍高码率，齿音更干净
  outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
  // 仅微加速；勿再叠运行时倍速（否则易「人机」）
  rate: '+8%',
  // 略降调，更沉稳
  pitch: '-4Hz',
  volume: '+0%',
  timeout: 30000,
})

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function generateOne(key, text, force = false) {
  const file = path.join(OUT, `${key}.mp3`)
  if (!force && (await exists(file))) {
    console.log(`  skip  ${key}.mp3  (${text})`)
    return
  }
  process.stdout.write(`  gen   ${key}.mp3  (${text}) ... `)
  await tts.ttsPromise(text, file)
  console.log('ok')
}

async function main() {
  const force = process.argv.includes('--force')
  await mkdir(OUT, { recursive: true })
  console.log(`输出目录: ${OUT}`)
  console.log(`音色: ${VOICE}  |  语速 +8%  |  音高 -4Hz  |  片段 ${Object.keys(CLIPS).length}`)

  for (const [key, text] of Object.entries(CLIPS)) {
    try {
      await generateOne(key, text, force)
      // 略放宽间隔，降低 edge 限流与截断概率
      await new Promise((r) => setTimeout(r, 200))
    } catch (e) {
      console.error(`\n失败: ${key} — ${e.message}`)
      process.exitCode = 1
    }
  }

  await writeFile(
    path.join(OUT, 'manifest.json'),
    JSON.stringify({
      voice: VOICE,
      engine: 'edge-tts',
      rate: '+8%',
      pitch: '-4Hz',
      note: '运行时 playbackRate≈1.0，勿再大幅加速',
      clips: CLIPS,
    }, null, 2),
    'utf8',
  )
  console.log('完成。manifest.json 已写入。')
}

main()
