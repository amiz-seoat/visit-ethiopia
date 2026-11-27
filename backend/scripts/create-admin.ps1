# Create the platform admin account in a target database (e.g. Neon production).
# Prompts for the connection string and password so they never appear in
# shell history, files, or command-line arguments. Run from the backend folder:
#
#   cd backend
#   powershell -ExecutionPolicy Bypass -File scripts\create-admin.ps1
#
# The seed is additive: if the admin email already exists it is left unchanged
# (the password is NOT updated), and existing demo content is skipped.

$ErrorActionPreference = 'Stop'

function Read-Secret([string]$prompt) {
  $secure = Read-Host -Prompt $prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

# Pasting into a hidden prompt is unreliable in some terminals (e.g. VS Code),
# so the connection string is read from the clipboard and the clipboard is cleared.
Write-Host 'Copy the Neon DIRECT connection string (postgresql://...) to the clipboard.'
$null = Read-Host -Prompt 'Then press Enter here (do not paste)'
$dbUrl = ((Get-Clipboard -Raw) -as [string])
if ($dbUrl) { $dbUrl = $dbUrl.Trim().Trim("'").Trim('"') }
Set-Clipboard -Value ' '
if ($dbUrl -notmatch '^postgres(ql)?://') { throw 'The clipboard does not contain a postgresql:// connection string. Copy it and run the script again.' }
Write-Host "Connection string read from clipboard ($($dbUrl.Length) characters); clipboard cleared."
# Neon free-tier computes suspend when idle; waking can exceed Prisma's 5 s default.
$sep = if ($dbUrl.Contains('?')) { '&' } else { '?' }
if ($dbUrl -notmatch '[?&]sslmode=') { $dbUrl += "${sep}sslmode=require"; $sep = '&' }
if ($dbUrl -notmatch '[?&]connect_timeout=') { $dbUrl += "${sep}connect_timeout=30" }
$dbUrl = $dbUrl -replace '[?&]channel_binding=require', ''

$email = (Read-Host -Prompt 'Admin email').Trim()
if ($email -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { throw 'Invalid email address.' }

Write-Host 'Type the admin password (input is hidden; type it, do not paste).'
$pw1 = Read-Secret 'Admin password (min 12 characters)'
$pw2 = Read-Secret 'Repeat admin password'
if ($pw1 -ne $pw2) { throw 'Passwords do not match.' }
if ($pw1.Length -lt 12) { throw 'Password must be at least 12 characters.' }

$env:DATABASE_URL = $dbUrl
$env:DIRECT_URL = $dbUrl
$env:ADMIN_EMAIL = $email
$env:ADMIN_PASSWORD = $pw1
try {
  node scripts/seedDemoMarketplace.js
  if ($LASTEXITCODE -ne 0) { throw "Seed failed (exit $LASTEXITCODE)" }
  Write-Host "`nDone. Sign in at https://visit-ethiopia-rw9b.vercel.app/login with $email" -ForegroundColor Green
}
finally {
  Remove-Item Env:DATABASE_URL, Env:DIRECT_URL, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
  $pw1 = $null; $pw2 = $null; $dbUrl = $null
}
