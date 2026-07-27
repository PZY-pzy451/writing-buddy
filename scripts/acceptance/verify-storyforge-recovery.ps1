param(
    [string]$ProjectRoot = "tmp/storyforge-gate-d-project-20260727",
    [string]$OutputPath = "docs/acceptance/storyforge-data-recovery.json"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$manifestPath = Join-Path $repoRoot "apps\desktop\src-tauri\Cargo.toml"
$resolvedProject = Resolve-Path (Join-Path $repoRoot $ProjectRoot)
$resolvedOutput = Join-Path $repoRoot $OutputPath
$testName = "archive::tests::sanitized_real_project_backup_restore_reopens_and_keeps_backlinks"

$env:STORYFORGE_REAL_PROJECT = $resolvedProject
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$output = & cargo test `
    --manifest-path $manifestPath `
    $testName `
    -- `
    --ignored `
    --exact `
    --nocapture 2>&1 | ForEach-Object { "$_" }
$cargoExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
Remove-Item Env:\STORYFORGE_REAL_PROJECT -ErrorAction SilentlyContinue

if ($cargoExitCode -ne 0) {
    $output | Write-Output
    throw "StoryForge recovery acceptance failed."
}

$payloadLine = $output | Where-Object { $_ -match "STORYFORGE_RECOVERY_JSON:" } | Select-Object -Last 1
if (-not $payloadLine -or $payloadLine -notmatch "STORYFORGE_RECOVERY_JSON:(\{.*\})") {
    $output | Write-Output
    throw "StoryForge recovery JSON was not emitted."
}

$payload = $Matches[1] | ConvertFrom-Json
if (-not $payload.secondLaunch -or [int]$payload.unresolvedBacklinks -ne 0) {
    throw "Restored project did not satisfy second-launch and backlink gates."
}

$report = [ordered]@{
    schemaVersion = 1
    generatedAt = [DateTime]::UtcNow.ToString("o")
    source = [ordered]@{
        projectRoot = "sanitized-real-project-copy"
        copyrightedProse = $false
    }
    result = $payload
    toolchain = [ordered]@{
        rustc = (& rustc --version)
        cargo = (& cargo --version)
    }
}

$directory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$json = $report | ConvertTo-Json -Depth 12
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($resolvedOutput, "$json`n", $utf8WithoutBom)

$payload | Format-List
Write-Output "Recovery report: $resolvedOutput"
