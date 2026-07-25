/**
 * 用流行开源客户端 node-edge-tts（edge-tts 生态）预生成离线中文语音片段。
 * 运行时零联网，仅播放本地 mp3。
 *
 * 用法: node scripts/generate-tts.mjs
 * 需网络（仅生成阶段）
 */
import { EdgeTTS } from 'node-edge-tts'
import { mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '../public/tts')

/** @type {Record<string, string>} 文件名 → 播报文本 */
const CLIPS = {
  // 棋子口语名
  'p-che': '车',
  'p-ma': '马',
  'p-pao': '炮',
  'p-bing': '兵',
  'p-zu': '卒',
  'p-jiang': '将',
  'p-shuai': '帅',
  'p-shi': '士',
  'p-xiang': '象',
  // 数字（红黑着法共用口语）
  'n-1': '一',
  'n-2': '二',
  'n-3': '三',
  'n-4': '四',
  'n-5': '五',
  'n-6': '六',
  'n-7': '七',
  'n-8': '八',
  'n-9': '九',
  // 走法动词
  'v-jin': '进',
  'v-tui': '退',
  'v-ping': '平',
  // 事件整句（音质更好）
  'e-jiangjun': '将军',
  'e-buneng': '不能走',
  'e-heqi': '和棋',
  'e-xinju': '新局',
  'e-hongsheng': '红方胜',
  'e-heisheng': '黑方胜',
  'e-niying': '你赢了',
  'e-nishu': '你输了',
  'e-chi': '吃',
  'e-zou': '走',
}

const tts = new EdgeTTS({
  voice: 'zh-CN-XiaoxiaoNeural',
  lang: 'zh-CN',
  outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
  // 语速偏快：短音节拼接着法时更干脆（运行时还有 1.35x）
  rate: '+45%',
  volume: '+0%',
  timeout: 20000,
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
  console.log(`音色: zh-CN-XiaoxiaoNeural  |  片段数: ${Object.keys(CLIPS).length}`)

  // 顺序生成，避免服务限流
  for (const [key, text] of Object.entries(CLIPS)) {
    try {
      await generateOne(key, text, force)
      await new Promise((r) => setTimeout(r, 120))
    } catch (e) {
      console.error(`\n失败: ${key} — ${e.message}`)
      process.exitCode = 1
    }
  }

  // 清单，便于调试与缓存校验
  await writeFile(
    path.join(OUT, 'manifest.json'),
    JSON.stringify({ voice: 'zh-CN-XiaoxiaoNeural', engine: 'edge-tts', clips: CLIPS }, null, 2),
    'utf8',
  )
  console.log('完成。manifest.json 已写入。')
}

main()
