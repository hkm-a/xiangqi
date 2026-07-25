// ============================================================
// 桌面端自动更新（仅 Tauri；浏览器 / 开发环境跳过）
// 检查 GitHub Releases 签名产物，用户确认后下载安装并重启
// ============================================================

/** @returns {boolean} */
export function isTauriShell() {
  return !!(globalThis.__TAURI_INTERNALS__ || globalThis.__TAURI__)
}

/**
 * 在侧栏顶部挂一条更新提示
 * @param {{ version: string, onUpdate: () => void, onDismiss: () => void }} opts
 */
function showUpdateBar({ version, onUpdate, onDismiss }) {
  let bar = document.getElementById('updateBar')
  if (!bar) {
    bar = document.createElement('div')
    bar.id = 'updateBar'
    bar.className = 'update-bar'
    bar.innerHTML = `
      <span class="update-bar-text"></span>
      <button type="button" class="update-bar-btn" id="updateBarGo">更新</button>
      <button type="button" class="update-bar-x" id="updateBarX" title="稍后">×</button>
    `
    const host = document.querySelector('.sidebar') || document.querySelector('.app')
    if (host) host.insertBefore(bar, host.firstChild)
    else document.body.appendChild(bar)
  }
  const text = bar.querySelector('.update-bar-text')
  if (text) text.textContent = `新版本 v${version}`
  bar.hidden = false

  const go = bar.querySelector('#updateBarGo')
  const x = bar.querySelector('#updateBarX')
  const onGo = () => {
    go.disabled = true
    go.textContent = '下载中…'
    onUpdate()
  }
  const onX = () => {
    bar.hidden = true
    onDismiss()
  }
  go?.replaceWith(go.cloneNode(true))
  x?.replaceWith(x.cloneNode(true))
  bar.querySelector('#updateBarGo')?.addEventListener('click', onGo)
  bar.querySelector('#updateBarX')?.addEventListener('click', onX)
}

function setUpdateProgress(label) {
  const go = document.querySelector('#updateBarGo')
  if (go) {
    go.disabled = true
    go.textContent = label
  }
}

/**
 * 启动后延迟检查更新（不阻塞对弈）
 * @param {{ delayMs?: number }} [opts]
 */
export async function initAutoUpdate(opts = {}) {
  if (!isTauriShell()) return
  if (import.meta.env?.DEV) return

  const delayMs = opts.delayMs ?? 2500
  await new Promise((r) => setTimeout(r, delayMs))

  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const { relaunch } = await import('@tauri-apps/plugin-process')

    const update = await check()
    if (!update) return

    const ver = update.version || '?'
    showUpdateBar({
      version: ver,
      onDismiss: () => {},
      onUpdate: async () => {
        try {
          setUpdateProgress('下载中…')
          let downloaded = 0
          let contentLength = 0
          await update.downloadAndInstall((event) => {
            if (event.event === 'Started') {
              contentLength = event.data.contentLength || 0
              setUpdateProgress('下载中…')
            } else if (event.event === 'Progress') {
              downloaded += event.data.chunkLength || 0
              if (contentLength > 0) {
                const pct = Math.min(99, Math.round((downloaded / contentLength) * 100))
                setUpdateProgress(`${pct}%`)
              }
            } else if (event.event === 'Finished') {
              setUpdateProgress('安装…')
            }
          })
          setUpdateProgress('重启…')
          await relaunch()
        } catch (e) {
          console.warn('[更新] 失败:', e)
          setUpdateProgress('失败')
          const go = document.querySelector('#updateBarGo')
          if (go) {
            go.disabled = false
            setTimeout(() => { go.textContent = '重试' }, 800)
          }
        }
      },
    })
  } catch (e) {
    // 无网 / 尚未发版 / 配置缺失：静默忽略
    console.warn('[更新] 检查跳过:', e?.message || e)
  }
}
