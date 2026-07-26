[CmdletBinding()]
param(
	[string]$Executable = 'D:\develop_tool\writing-buddy-next\apps\desktop\src-tauri\target\release\writing-buddy-next.exe',
	[int]$Port = 9223,
	[string]$UserDataFolder = 'D:\develop_tool\writing-buddy-next\tmp\webview-debug'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) {
	throw "Writing Buddy executable not found: $Executable"
}

$previousArguments = $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
$previousUserDataFolder = $env:WEBVIEW2_USER_DATA_FOLDER

try {
	New-Item -ItemType Directory -Path $UserDataFolder -Force | Out-Null
	$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$Port"
	$env:WEBVIEW2_USER_DATA_FOLDER = $UserDataFolder
	$process = Start-Process -FilePath $Executable -PassThru
	Start-Sleep -Seconds 3

	[pscustomobject]@{
		ProcessId = $process.Id
		Endpoint = "http://127.0.0.1:$Port/json"
	}

	Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json" |
		ConvertTo-Json -Depth 8
} finally {
	$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $previousArguments
	$env:WEBVIEW2_USER_DATA_FOLDER = $previousUserDataFolder
}
