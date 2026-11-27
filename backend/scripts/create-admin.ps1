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

$dbUrl = (Read-Secret 'Neon DIRECT connection string (postgresql://...)').Trim().Trim("'").Trim('"')
if ($dbUrl -notmatch '^postgres(ql)?://') { throw 'That does not look like a postgresql:// connection string.' }

$email = (Read-Host -Prompt 'Admin email').Trim()
if ($email -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { throw 'Invalid email address.' }

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
