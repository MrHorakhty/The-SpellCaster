# Preview old project log captures; pass -Apply to remove the displayed files.
[CmdletBinding(SupportsShouldProcess)]
param(
    [ValidateRange(1, 3650)][int]$Days = 30,
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$logRoot = Join-Path $PSScriptRoot 'logs'
if (-not (Test-Path -LiteralPath $logRoot)) { Write-Host 'No logs folder.'; return }
if ((Get-Item -LiteralPath $logRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw 'Refusing a linked logs folder.'
}
# Only direct captures are candidates. logs/keep/ is deliberately never traversed.
$candidates = @(Get-ChildItem -LiteralPath $logRoot -File -Force | Where-Object {
    $_.Extension -eq '.log' -and $_.LastWriteTime -lt (Get-Date).AddDays(-$Days) -and
    -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint)
} | Sort-Object Name)
$candidates | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
Write-Host "$($candidates.Count) log(s) older than $Days days. Move unresolved failures/latest verification to logs/keep/ first."
if (-not $Apply) { Write-Host 'Preview only. Run with -Apply to delete these files.'; return }
foreach ($file in $candidates) {
    if ($PSCmdlet.ShouldProcess($file.FullName, 'Delete old log capture')) {
        Remove-Item -LiteralPath $file.FullName -Force
    }
}
