$tmp = Join-Path $env:TEMP 'wb-github-sync'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
git clone https://github.com/PZY-pzy451/writing-buddy.git $tmp 2>&1 | Select-Object -Last 2
Set-Location $tmp
robocopy 'd:\develop_tool\writing-buddy' $tmp /MIR /XD .git node_modules out .build build-logs .vscode-test .superpowers /XF *.log /NFL /NDL /NJH /NJS /NP | Out-Null
git add -A
git commit -m 'Phase 0.3 completion: removed AI/decorations/stubs, added static chapter metadata, unified word counts, hot-exit restore, GUI 11/11' 2>&1 | Select-Object -Last 2
git push origin main 2>&1 | Select-Object -Last 2
Set-Location d:\develop_tool\writing-buddy
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'Sync complete'
