# 为中國象棋桌面端创建 Windows 桌面快捷方式
# 用法：powershell -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1
# 可选参数：-ExePath <路径>  指定 exe；默认使用 release 构建产物

param(
  [string]$ExePath = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not $ExePath) {
  $candidates = @(
    (Join-Path $Root "src-tauri\target\release\xiangqi.exe"),
    (Join-Path $Root "src-tauri\target\debug\xiangqi.exe")
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { $ExePath = $c; break }
  }
}

if (-not $ExePath -or -not (Test-Path $ExePath)) {
  Write-Host "未找到 xiangqi.exe。请先运行：npm run desktop:build" -ForegroundColor Yellow
  exit 1
}

$ExePath = (Resolve-Path $ExePath).Path
$WorkDir = Split-Path -Parent $ExePath

# 优先用包内 ico，否则用 exe 自带图标
$IconPath = Join-Path $Root "src-tauri\icons\icon.ico"
if (-not (Test-Path $IconPath)) { $IconPath = $ExePath }

$Desktop = [Environment]::GetFolderPath("Desktop")
$LinkPath = Join-Path $Desktop "中國象棋.lnk"

$Wsh = New-Object -ComObject WScript.Shell
$Sc = $Wsh.CreateShortcut($LinkPath)
$Sc.TargetPath = $ExePath
$Sc.WorkingDirectory = $WorkDir
$Sc.IconLocation = "$IconPath,0"
$Sc.Description = "中国象棋 · 小而美 · 本地对弈"
$Sc.WindowStyle = 1
$Sc.Save()

# 同步到「公共桌面」失败时忽略（无权限时）
try {
  $PublicDesktop = [Environment]::GetFolderPath("CommonDesktopDirectory")
  if ($PublicDesktop -and (Test-Path $PublicDesktop)) {
    # 仅当前用户桌面即可，不写公共桌面
  }
} catch { }

Write-Host "已创建桌面快捷方式：" -ForegroundColor Green
Write-Host "  $LinkPath"
Write-Host "目标："
Write-Host "  $ExePath"
