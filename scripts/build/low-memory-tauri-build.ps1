[CmdletBinding()]
param(
	[double]$MinimumStartCommitFreeGB = 3.0,
	[double]$AbortCommitFreeGB = 1.25
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$logRoot = Join-Path $repoRoot 'build-logs'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdout = Join-Path $logRoot "tauri-build-$stamp.stdout.log"
$stderr = Join-Path $logRoot "tauri-build-$stamp.stderr.log"
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

function Get-CommitFreeGB {
	$os = Get-CimInstance Win32_OperatingSystem
	return [math]::Round($os.FreeVirtualMemory / 1MB, 2)
}

$startFree = Get-CommitFreeGB
if ($startFree -lt $MinimumStartCommitFreeGB) {
	throw "Low-memory Tauri build blocked: $startFree GB commit space is free; $MinimumStartCommitFreeGB GB is required."
}

$env:NODE_OPTIONS = '--max-old-space-size=1024'
$env:CARGO_BUILD_JOBS = '1'
fnm env --use-on-cd | Out-String | Invoke-Expression
fnm use | Out-Null

$process = Start-Process `
	-FilePath 'pnpm.cmd' `
	-ArgumentList 'tauri:build' `
	-WorkingDirectory $repoRoot `
	-WindowStyle Hidden `
	-RedirectStandardOutput $stdout `
	-RedirectStandardError $stderr `
	-PassThru
$process.PriorityClass = 'BelowNormal'

$lowestFree = $startFree
$aborted = $false
while (-not $process.HasExited) {
	Start-Sleep -Seconds 2
	$free = Get-CommitFreeGB
	$lowestFree = [math]::Min($lowestFree, $free)
	if ($free -lt $AbortCommitFreeGB) {
		$aborted = $true
		& taskkill.exe /PID $process.Id /T /F | Out-Null
		break
	}
	$process.Refresh()
}

$process.WaitForExit()
[pscustomobject]@{
	ExitCode = $process.ExitCode
	StartCommitFreeGB = $startFree
	LowestCommitFreeGB = $lowestFree
	AbortedForMemory = $aborted
	Stdout = $stdout
	Stderr = $stderr
}

if ($aborted) {
	throw "Tauri build was stopped safely when free commit space fell below $AbortCommitFreeGB GB."
}
if ($process.ExitCode -ne 0) {
	Get-Content -LiteralPath $stderr -Tail 80
	throw "Tauri build failed with exit code $($process.ExitCode)."
}
