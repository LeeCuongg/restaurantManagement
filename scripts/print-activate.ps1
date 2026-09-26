# scripts/print-activate.ps1 - Doi MA KICH HOAT lay cau hinh cau in (PRINT-11, QD-019 D6).
#
# Bo cai cau in giong nhau cho moi quan, KHONG mang mat khau nao. Luc cai, nguoi lap go ma 8 ky tu
# (super-admin tao o /super -> "Ma cai cau in"). Script doi ma lay: tai khoan `printer` cua DUNG
# quan, khoa CONG KHAI cua Supabase, dia chi POS - roi ghi .env.local canh cau in.
#
# Tach rieng khoi print-setup.ps1 de chay thu duoc ma khong phai cai ca bo (bo cai doi cau hinh may:
# tac vu nen, nguon dien, may in mac dinh).
#
# Chay:
#   powershell -ExecutionPolicy Bypass -File print-activate.ps1 -ApiBase https://ten-mien -EnvFile C:\cau-in\.env.local
#   ... -Code ABCD-EFGH      (bo qua thi hoi)
#
# Ma thoat: 0 = da ghi .env.local; 1 = khong kich hoat duoc.
# CHI dung ky tu ASCII trong file nay: PowerShell 5.1 doc .ps1 UTF-8 khong BOM theo bang ma ANSI.

param(
  [Parameter(Mandatory = $true)][string]$ApiBase,
  [Parameter(Mandatory = $true)][string]$EnvFile,
  [string]$Code,
  [int]$Chars = 48
)

$ErrorActionPreference = "Stop"

# Windows 10 cu: PowerShell 5.1 mac dinh chua bat TLS 1.2 -> Vercel tu choi ket noi.
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$url = $ApiBase.TrimEnd("/") + "/api/bridge/activate"
$kq = $null

for ($lan = 1; $lan -le 3 -and -not $kq; $lan++) {
  if (-not $Code) {
    $Code = (Read-Host "      Nhap MA KICH HOAT (8 ky tu, vd ABCD-EFGH)").Trim()
  }
  try {
    $body = @{ code = $Code } | ConvertTo-Json -Compress
    $kq = Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body $body -TimeoutSec 30
  } catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    # Thong bao ASCII theo ma trang thai: chu co dau tu server hien sai tren console PowerShell 5.1.
    if ($status -eq 400) { Write-Host "      ! Ma khong hop le hoac da het han (ma dung mot lan, song 30 phut)." -ForegroundColor Yellow }
    elseif ($status -eq 429) { Write-Host "      ! Nhap sai qua nhieu lan. Doi 10 phut roi thu lai." -ForegroundColor Yellow; break }
    else { Write-Host ("      ! Khong ket noi duoc may chu (" + $_.Exception.Message + "). Kiem tra mang Internet.") -ForegroundColor Yellow }
    $Code = $null
    $kq = $null
  }
}

if (-not $kq -or -not $kq.email -or -not $kq.password) { exit 1 }

# Giu cac dong da co (PRINTER_HOST do lan cai truoc, ...) - chi thay cac khoa do kich hoat quyet dinh.
$moi = [ordered]@{
  NEXT_PUBLIC_SUPABASE_URL      = $kq.supabaseUrl
  NEXT_PUBLIC_SUPABASE_ANON_KEY = $kq.anonKey
  PRINT_BRIDGE_EMAIL            = $kq.email
  PRINT_BRIDGE_PASSWORD         = $kq.password
  POS_URL                       = $kq.appUrl
}
$macDinh = [ordered]@{
  PRINTER_PORT    = "9100"
  PRINTER_CHARS   = "$Chars"
  POLL_MS         = "2000"
  MAX_JOB_AGE_MIN = "30"
}

$cu = @()
if (Test-Path $EnvFile) { $cu = @(Get-Content $EnvFile) }
$giu = @()
$daCo = @{}
foreach ($dong in $cu) {
  $m = [regex]::Match($dong, '^\s*([A-Z0-9_]+)\s*=')
  if ($m.Success) {
    $k = $m.Groups[1].Value
    if ($moi.Contains($k)) { continue }
    $daCo[$k] = $true
  } elseif ($dong -match '^\s*#') {
    continue
  }
  $giu += $dong
}

$ra = @(
  "# Cau hinh cau in - quan $($kq.slug). Do print-activate.ps1 sinh ra. KHONG gui cho nguoi ngoai.",
  "# Tai khoan duoi day chi la vai tro printer cua DUNG quan nay (QD-012): khong mo duoc /admin, /pos, /kds."
)
foreach ($k in $moi.Keys) { $ra += "$k=$($moi[$k])" }
foreach ($k in $macDinh.Keys) { if (-not $daCo.ContainsKey($k)) { $ra += "$k=$($macDinh[$k])" } }
$ra += ($giu | Where-Object { $_.Trim() -ne "" })

$thuMuc = Split-Path -Parent $EnvFile
if ($thuMuc -and -not (Test-Path $thuMuc)) { New-Item -ItemType Directory -Force -Path $thuMuc | Out-Null }
# UTF-8 KHONG BOM, CRLF.
[IO.File]::WriteAllText($EnvFile, (($ra -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))

Write-Host ("      OK - Da kich hoat cau in cho quan " + $kq.slug) -ForegroundColor Green
exit 0
