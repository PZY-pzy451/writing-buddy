param(
    [string]$OutputPath = "docs/acceptance/storyforge-performance.json"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$manifestPath = Join-Path $repoRoot "apps\desktop\src-tauri\Cargo.toml"
$fixturePath = Join-Path $repoRoot "fixtures\performance\storyforge-large-project\manifest.json"
$resolvedOutput = Join-Path $repoRoot $OutputPath

if (-not (Test-Path -LiteralPath $fixturePath)) {
    throw "StoryForge performance fixture manifest is missing."
}

$fixture = Get-Content -LiteralPath $fixturePath -Raw -Encoding UTF8 | ConvertFrom-Json
$expectedTotal = [int64]$fixture.counts.chapters +
    [int64]$fixture.counts.scenes +
    [int64]$fixture.counts.resources +
    [int64]$fixture.counts.eventsAndStates +
    [int64]$fixture.counts.mentions

$testName = "story::index_tests::large_fixture_meets_storyforge_performance_gates"
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$output = & cargo test `
    --manifest-path $manifestPath `
    --release `
    $testName `
    -- `
    --ignored `
    --exact `
    --nocapture 2>&1 | ForEach-Object { "$_" }
$cargoExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference

if ($cargoExitCode -ne 0) {
    $output | Write-Output
    throw "StoryForge performance gate failed."
}

$payloadLine = $output | Where-Object { $_ -match "STORYFORGE_PERF_JSON:" } | Select-Object -Last 1
if (-not $payloadLine -or $payloadLine -notmatch "STORYFORGE_PERF_JSON:(\{.*\})") {
    $output | Write-Output
    throw "StoryForge performance JSON was not emitted."
}

$payload = $Matches[1] | ConvertFrom-Json
if ([int64]$payload.fixture.indexedRecords -ne $expectedTotal + 1) {
    throw "Indexed record count does not match the deterministic fixture."
}

$report = [ordered]@{
    schemaVersion = 1
    generatedAt = [DateTime]::UtcNow.ToString("o")
    fixture = $fixture
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

$payload.metricsMs | Format-List
Write-Output "Performance report: $resolvedOutput"
