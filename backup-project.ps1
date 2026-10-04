# backup-project.ps1 - create a verified backup of the project
#
# Replaces the manual robocopy incantation in AGENTS.md. The important part is
# the VERIFY step at the end, not the copy.
#
# WHY VERIFY: Bitdefender quarantines e2e\e2e-full.ps1 on sight. It was found
# 2026-09-30 eating git objects, and again 2026-10-04 eating the backup copy.
# Trigger is the `Remove-Item -Recurse` on line 92 of that script, but only in
# combination with the rest of the file (verified by controlled test - see
# opencode-summary.md). The repo copy is safe because the user excluded
# c:\users\emire\projects\ttrpg-soundboard\e2e\ from scanning; the OneDrive
# backup folder is NOT excluded, so the copy gets eaten there.
#
# Consequence: a backup that silently lost a file looks identical to a good one.
# This script compares source and destination and repairs what is missing.

[CmdletBinding()]
param(
  # Restore any file missing from the backup instead of only reporting it.
  # On by default - a backup you have to inspect manually is a backup you skip.
  [switch]$NoRepair,

  # Fail if the backup exceeds this many MB. Guards against an exclusion that
  # silently stopped working (the 31 GB incident).
  [int]$MaxMB = 150
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ---- 0. What gets excluded, and the expected result ----
# Everything needed is backed up: source, docs, tests, and public/assets (the
# audio). public/assets is ~29 MB of mp3 and everything else is ~10 MB, so a
# full backup lands around 40 MB. The user chose complete-by-default rather
# than a 10 MB tier - the difference is not worth the risk of omitting assets.
#
# Only regenerable/derived content is excluded. These are the folders that get
# rebuilt by `npm install`, `npm run build` and the Rust/Android toolchain:
#   node_modules - npm install
#   dist         - npm run build
#   .git         - git clone / already in the object store
#   target       - cargo build  (~25 GB!)
#   gen          - tauri android init (generated Android project)
#
# CRITICAL: /XD takes BARE directory names. Passing `src-tauri\target` is
# silently ignored by robocopy, which then copies ~31 GB. That happened once.
# Keep this list and the $excludes variable below in sync - they must match.
$excludes = @('node_modules', 'dist', '.git', 'target', 'gen')

# Sanity ceiling. A correct backup of this project is roughly 40 MB. If a
# result is far larger, an exclusion silently failed - which is exactly the
# failure mode that is invisible unless you check. Override with -MaxMB if the
# project legitimately grows. (The value lives in the param block above - do
# NOT re-assign it here, that shadows the caller's -MaxMB and silently ignores it.)

Write-Host "excluded   : $($excludes -join ', ')  (regenerable build/dep output)"
Write-Host "included   : everything else, including public/assets audio (~40 MB total)"
Write-Host ""

# ---- 1. Build the destination path WITHOUT typing the accented characters ----
# 'Masaustu' is 'Masa' + u-umlaut + 'st' + u-umlaut. Typing the literal has
# produced a wrongly-named folder twice (UTF-8-as-Latin-1, then a bad char-code
# sequence). Build it from code points and assert before copying.
$desk = 'C:\Users\emire\OneDrive\Masa' + [char]0x00FC + 'st' + [char]0x00FC
$expectedCodes = '77,97,115,97,252,115,116,252'
$actualCodes = ((Split-Path -Leaf $desk).ToCharArray() | ForEach-Object { [int]$_ }) -join ','
if ($actualCodes -ne $expectedCodes) {
  throw "Destination folder name is wrong. Expected char codes $expectedCodes, got $actualCodes. Aborting - a backup in a misspelled folder is worse than no backup."
}

$src = $PSScriptRoot
if (-not $src) { $src = (Get-Location).Path }
$dst = Join-Path $desk ("ttrpg-soundboard-backup-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))

Write-Host "source     : $src"
Write-Host "destination: $dst"

# ---- 2. Copy ----
robocopy $src $dst /E /XD $excludes /NFL /NDL /NJH /NJS /NP | Out-Null
$rc = $LASTEXITCODE
if ($rc -ge 8) { throw "robocopy failed with exit code $rc" }
Write-Host "copied     : robocopy exit $rc (0-7 = success)"
# robocopy's exit code lingers in $LASTEXITCODE and would otherwise become this
# script's own exit code (1 = "files copied"), so callers checking $LASTEXITCODE
# would misread a successful backup as a failure.
$global:LASTEXITCODE = 0

# ---- 3. VERIFY every source file exists in the backup ----
# Enumerate source the same way robocopy did, so the two sides are comparable.
$srcFiles = Get-ChildItem -LiteralPath $src -Recurse -File -Force |
  Where-Object {
    $f = $_
    -not ($excludes | Where-Object { $f.FullName -match "[\\/]$_([\\/]|$)" })
  }

$missing = @()
foreach ($f in $srcFiles) {
  $rel = $f.FullName.Substring($src.Length).TrimStart('\')
  $target = Join-Path $dst $rel
  if (-not (Test-Path -LiteralPath $target)) { $missing += $rel }
}

$dstFiles = Get-ChildItem -LiteralPath $dst -Recurse -File -Force
$dstMB = [math]::Round((($dstFiles | Measure-Object Length -Sum).Sum) / 1MB, 1)

Write-Host ""
Write-Host "source files: $($srcFiles.Count)"
Write-Host "backup files: $($dstFiles.Count)"
Write-Host "backup size : $dstMB MB  (ceiling $MaxMB MB)"

# ---- 3a. Size sanity check ----
# A correct backup is ~40 MB. Anything far above that means an exclusion was
# ignored, which is otherwise completely invisible - robocopy still reports
# success. Fail loudly and clean up rather than leave a 31 GB folder behind.
if ($dstMB -gt $MaxMB) {
  Write-Host ""
  Write-Host "ABORT: backup is $dstMB MB, over the $MaxMB MB ceiling." -ForegroundColor Red
  Write-Host "An exclusion almost certainly stopped working. Expected exclusions:" -ForegroundColor Red
  Write-Host "  $($excludes -join ', ')" -ForegroundColor Red
  Write-Host "Check they are passed to robocopy as BARE names, not paths." -ForegroundColor Red
  Write-Host "Deleting the oversized backup. Re-run with -MaxMB <n> if this is legitimate." -ForegroundColor Red
  Remove-Item -LiteralPath $dst -Recurse -Force
  exit 1
}

if ($missing.Count -eq 0) {
  Write-Host ""
  Write-Host "VERIFY OK - all $($srcFiles.Count) files present ($dstMB MB)." -ForegroundColor Green
  Write-Host "Backup: $dst"
  exit 0
}

# ---- 4. Something was eaten. Report it loudly, then repair if allowed. ----
Write-Host ""
Write-Host "VERIFY FAILED - $($missing.Count) file(s) missing from the backup:" -ForegroundColor Red
foreach ($m in $missing) { Write-Host "  MISSING  $m" -ForegroundColor Red }

Write-Host ""
Write-Host "Likely cause: antivirus quarantined them. To confirm, check for a new"
Write-Host "entry in Bitdefender's quarantine folder and compare its recorded path:"
Write-Host "  (Get-Item `"$env:ProgramData\Bitdefender\Desktop\Quarantine\cache.db`").LastWriteTime"

if ($NoRepair) {
  Write-Host ""
  Write-Host "-NoRepair given, so nothing was restored. Back up by hand or re-run without it."
  exit 1
}

Write-Host ""
Write-Host "Repairing from git (the repo copy is excluded from scanning, so it survives)..."

$repo = $src
Push-Location $repo
try {
  foreach ($m in $missing) {
    $gitPath = $m -replace '\\', '/'

    # Prefer the WORKING TREE copy when it differs from HEAD. If the file had
    # uncommitted edits, `git show HEAD:` would silently restore the older
    # committed version and lose the work - which is exactly when a backup
    # matters most.
    $isDirty = $false
    git diff --quiet -- $gitPath 2>$null
    if ($LASTEXITCODE -ne 0) { $isDirty = $true }

    $restored = $false
    if ($isDirty -and (Test-Path -LiteralPath (Join-Path $repo $m))) {
      Write-Host "  restoring (working tree - has uncommitted edits): $m"
      Copy-Item -LiteralPath (Join-Path $repo $m) -Destination (Join-Path $dst $m) -Force
      $restored = $true
    }
    else {
      $content = git show "HEAD:$gitPath" 2>$null
      if ($LASTEXITCODE -eq 0 -and $null -ne $content) {
        Write-Host "  restoring (from HEAD): $m"
        Set-Content -LiteralPath (Join-Path $dst $m) -Value $content -NoNewline
        $restored = $true
      }
    }

    if (-not $restored) {
      Write-Host "  FAILED to restore: $m" -ForegroundColor Red
      Write-Host "    Not in the working tree and not in HEAD. It may be untracked -" -ForegroundColor Red
      Write-Host "    check `git status` for it and copy it manually." -ForegroundColor Red
    }
  }
}
finally { Pop-Location }

# ---- 5. Re-verify ----
$stillMissing = @()
foreach ($m in $missing) {
  if (-not (Test-Path -LiteralPath (Join-Path $dst $m))) { $stillMissing += $m }
}

Write-Host ""
if ($stillMissing.Count -eq 0) {
  Write-Host "REPAIRED - all $($srcFiles.Count) files now present in the backup ($dstMB MB)." -ForegroundColor Green
  Write-Host "Backup: $dst"
  Write-Host ""
  Write-Host "Note: e2e-full.ps1 was quarantined again. It will be eaten again on" -ForegroundColor Yellow
  Write-Host "every future backup until either the file changes or the backup" -ForegroundColor Yellow
  Write-Host "folder is excluded from scanning. This script repairs the backup but" -ForegroundColor Yellow
  Write-Host "does not prevent the quarantine."
  exit 0
}
else {
  Write-Host "STILL BROKEN - $($stillMissing.Count) file(s) could not be restored:" -ForegroundColor Red
  foreach ($s in $stillMissing) { Write-Host "  $s" -ForegroundColor Red }
  Write-Host "Do not trust this backup."
  exit 1
}