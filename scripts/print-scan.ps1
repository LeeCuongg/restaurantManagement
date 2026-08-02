# scripts/print-scan.ps1 — Dò máy in ESC/POS + in phiếu thử, KHÔNG cần cài gì.
#
# Dùng khi lắp máy in tại quán: laptop của quán thường không có Node/repo, chỉ có Windows sẵn.
# File này chạy bằng PowerShell có sẵn trong Windows — copy 1 file sang laptop quán là đủ.
#
# Dò máy in trên mọi dải mạng đang nối:
#   powershell -ExecutionPolicy Bypass -File print-scan.ps1
#
# Dò 1 dải chỉ định (khi laptop nối nhiều mạng):
#   powershell -ExecutionPolicy Bypass -File print-scan.ps1 -Subnet 192.168.1
#
# In phiếu thử để xác nhận đúng máy in (giấy phải ra và tự cắt):
#   powershell -ExecutionPolicy Bypass -File print-scan.ps1 -TestPrint 192.168.1.87

param(
  [string]$Subnet,
  [string]$TestPrint,
  [int]$Port = 9100,
  # Chi in ra danh sach IP tim duoc, moi dong mot IP — de print-setup.ps1 goi lai va doc ket qua.
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

# ── In phiếu thử ───────────────────────────────────────────────────────────────
# Gửi raw ESC/POS thẳng vào cổng 9100 — đúng thứ cầu in sẽ làm, nên giấy ra ở đây
# nghĩa là cầu in cũng sẽ in được.
if ($TestPrint) {
  Write-Host "Gui phieu thu toi $TestPrint`:$Port ..."
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $ok = $client.BeginConnect($TestPrint, $Port, $null, $null).AsyncWaitHandle.WaitOne(5000)
    if (-not $ok -or -not $client.Connected) {
      $client.Close()
      Write-Host "KHONG KET NOI DUOC. May in khac dai mang, sai IP, hoac khong mo cong $Port." -ForegroundColor Red
      exit 1
    }
    $stream = $client.GetStream()

    $bytes = New-Object System.Collections.Generic.List[byte]
    $add = { param($arr) foreach ($b in $arr) { $bytes.Add($b) } }
    $text = { param($s) & $add ([System.Text.Encoding]::ASCII.GetBytes("$s`n")) }

    & $add @(0x1B, 0x40)              # init
    & $add @(0x1B, 0x61, 0x01)        # can giua
    & $add @(0x1B, 0x45, 0x01)        # dam
    & $text "PHIEU THU CAU IN"
    & $add @(0x1B, 0x45, 0x00)
    & $add @(0x1B, 0x61, 0x00)        # can trai
    & $text ("-" * 48)
    & $text "May in: $TestPrint`:$Port"
    & $text ("Luc: " + (Get-Date -Format "HH:mm dd/MM/yyyy"))
    & $text ("-" * 48)
    & $text "Neu ban doc duoc dong nay, may in da san sang."
    & $text ""
    & $text ""
    & $add @(0x1D, 0x56, 0x42, 0x00)  # cat giay

    $out = $bytes.ToArray()
    $stream.Write($out, 0, $out.Length)
    $stream.Flush()
    Start-Sleep -Milliseconds 500
    $client.Close()

    Write-Host "Da gui xong. Kiem tra giay ra o may in." -ForegroundColor Green
    Write-Host "Giay ra -> dien vao .env.local:  PRINTER_HOST=$TestPrint"
    exit 0
  } catch {
    Write-Host ("Loi gui may in: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
  }
}

# ── Dò máy in ──────────────────────────────────────────────────────────────────
if ($Subnet) {
  # Nhan ca "192.168.1" lan "192.168.1.87" -> deu lay 3 octet dau.
  $parts = $Subnet -split '\.'
  if ($parts.Count -lt 3) {
    Write-Host "Subnet phai co it nhat 3 so, vd: -Subnet 192.168.1" -ForegroundColor Red
    exit 1
  }
  $prefixes = @(($parts[0..2] -join '.'))
} else {
  $prefixes = @()
  foreach ($ip in (Get-NetIPAddress -AddressFamily IPv4).IPAddress) {
    if ($ip -like '127.*' -or $ip -like '169.254.*') { continue }
    $p = ($ip -split '\.')[0..2] -join '.'
    if ($prefixes -notcontains $p) { $prefixes += $p }
  }
}

if ($prefixes.Count -eq 0) {
  Write-Host "Laptop nay khong noi mang LAN nao. Cam day / bat Wi-Fi roi chay lai." -ForegroundColor Red
  exit 1
}

if (-not $Quiet) {
  Write-Host ("Quet cong $Port tren: " + (($prefixes | ForEach-Object { "$_.x" }) -join ", "))
  Write-Host ""
}

$found = @()
foreach ($prefix in $prefixes) {
  # Mo tat ca ket noi cung luc roi cho 1 nhip — quet tuan tu 254 IP se mat hang phut.
  $pending = @()
  foreach ($i in 1..254) {
    $client = New-Object System.Net.Sockets.TcpClient
    $pending += [pscustomobject]@{
      Host   = "$prefix.$i"
      Client = $client
      Async  = $client.BeginConnect("$prefix.$i", $Port, $null, $null)
    }
  }
  Start-Sleep -Milliseconds 1500
  foreach ($p in $pending) {
    if ($p.Client.Connected) { $found += $p.Host }
    $p.Client.Close()
  }
  if (-not $Quiet) { Write-Host "  $prefix.x - xong" }
}

if ($Quiet) {
  foreach ($h in $found) { Write-Output $h }
  if ($found.Count -eq 0) { exit 1 }
  exit 0
}

Write-Host ""
if ($found.Count -eq 0) {
  Write-Host "Khong tim thay may in nao mo cong $Port." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Kiem tra theo thu tu:"
  Write-Host "  1. May in da cam day LAN vao CUNG router voi laptop chua (khong phai Wi-Fi khach)"
  Write-Host "  2. Giu nut FEED roi bat nguon -> may in tu in phieu self-test, xem dong IP Address"
  Write-Host "  3. IP tren phieu co cung dai voi laptop khong? Xprinter mac dinh 192.168.1.87,"
  Write-Host "     neu router quan phat dai khac (vd 192.168.0.x) thi hai ben KHONG thay nhau."
  Write-Host "     Sua bang: cam USB -> chay Printer Test Tool cua Xprinter -> tab Ethernet -> DHCP"
  Write-Host "  4. Laptop co dang bat VPN khong (VPN cat duong den LAN)"
  exit 1
}

Write-Host ("Tim thay " + $found.Count + " thiet bi mo cong $Port`:") -ForegroundColor Green
foreach ($h in $found) { Write-Host "  $h" }
Write-Host ""
Write-Host "In phieu thu de xac nhan dung may in:"
Write-Host ("  powershell -ExecutionPolicy Bypass -File print-scan.ps1 -TestPrint " + $found[0])
