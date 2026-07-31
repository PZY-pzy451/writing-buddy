param(
	[Parameter(Mandatory = $true)]
	[string]$OutputDirectory,
	[int]$Rate = 1,
	[int]$Volume = 96
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Speech

$resolvedOutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($resolvedOutputDirectory) | Out-Null

function Decode-Text {
	param([string]$Value)

	return [System.Text.Encoding]::UTF8.GetString(
		[System.Convert]::FromBase64String($Value)
	)
}

# Keep the source ASCII-only so Windows PowerShell 5.1 reads it consistently.
$segments = @(
	@{
		Name = '01-result'
		Text = Decode-Text '5LuO5LiA5Liq5oOz5rOV77yM5Yiw5LiJ56ug44CB5YWt5Liq5Zy65pmv5ZKM5a6M5pW057uT5bGA44CC'
	},
	@{
		Name = '02-project'
		Text = Decode-Text '5LuO56m655m96aG555uu5byA5aeL77yM6YCJ5oup6aKY5p2Q5Yib5L2c6Lev57q/44CC5omA5pyJ5YaF5a656YO95YaZ5YWl5pys5Zyw6aG555uu44CC'
	},
	@{
		Name = '03-premise'
		Text = Decode-Text '6L6T5YWl6aKY5p2Q44CB5qC45b+D5YmN5o+Q5ZKM5Yib5L2c6L6555WM77yM5Lq65bel5pm66IO95YWI55Sf5oiQ5Y+v5Lul57un57ut57yW6L6R55qE5aSn57qy5YCZ6YCJ44CC'
	},
	@{
		Name = '04-outline'
		Text = Decode-Text '5L2c6ICF6YCQ57qn56Gu6K6k5LiA5Y2344CB5LiJ56ug5ZKM5YWt5Liq5Zy65pmv44CC5LiN5ruh5oSP77yM5Y+v5Lul6ZqP5pe26L+U5Zue6LCD5pW044CC'
	},
	@{
		Name = '05-materialize'
		Text = Decode-Text '56Gu6K6k5ZCO77yM5aSn57qy5Y+Y5oiQ55yf5q2j5Y+v5YaZ55qE56ug6IqC5LiO5Zy65pmv44CC'
	},
	@{
		Name = '06-first-draft'
		Text = Decode-Text '5L2c6ICF5Y+v5Lul5YWI5YaZ5LiA5Y+l77yM5YaN6K6p5Lq65bel5pm66IO95L6d5o2u5bey56Gu6K6k55qE6LWE5paZ6KGl5YWo56ug6IqC44CC'
	},
	@{
		Name = '07-opening-draft'
		Text = Decode-Text '5paw56ug6IqC6L+Y5rKh5pyJ5q2j5paH5pe277yMV3JpdGluZyBCdWRkeSDkvJrku47pppbkuKrlnLrmma/lvIDlp4votbfojYnjgILnlJ/miJDlj6rkuqfnlJ/kuLTml7bojYnnqL/vvIzkuI3kvJrnm7TmjqXopobnm5bmraPmlofjgII='
	},
	@{
		Name = '08-confirm'
		Text = Decode-Text '5L2c6ICF5Y+v5Lul5Y6f5Zyw5L+u5pS577yM56Gu6K6k5ZCO5omN5YaZ5YWl5q2j5paH77yM5bm26Ieq5Yqo5Yib5bu65a6J5YWo5b+r54Wn44CC'
	},
	@{
		Name = '09-dashboard'
		Text = Decode-Text '5LiJ56ug5YaZ5a6M77yM5a2X5pWw44CB6L+b5bqm5ZKM5a6h5qCh54q25oCB5LiA55uu5LqG54S244CC'
	},
	@{
		Name = '10-outro'
		Text = Decode-Text 'V3JpdGluZyBCdWRkeeOAguS6uuW3peaZuuiDveaPkOS+m+WAmemAie+8jOS9nOiAheaLpeacieacgOWQjuWGs+Wumuadg+OAgg=='
	}
)

$synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
	$chineseVoice = $synthesizer.GetInstalledVoices() |
		ForEach-Object { $_.VoiceInfo } |
		Where-Object { $_.Culture.Name -eq 'zh-CN' } |
		Select-Object -First 1

	if ($null -eq $chineseVoice) {
		throw 'No zh-CN Windows speech voice is installed.'
	}

	$synthesizer.SelectVoice($chineseVoice.Name)
	$synthesizer.Rate = $Rate
	$synthesizer.Volume = $Volume

	$manifest = foreach ($segment in $segments) {
		$fileName = "$($segment.Name).wav"
		$outputPath = [System.IO.Path]::Combine($resolvedOutputDirectory, $fileName)
		$synthesizer.SetOutputToWaveFile($outputPath)
		$synthesizer.Speak([string]$segment.Text)
		$synthesizer.SetOutputToNull()

		[PSCustomObject]@{
			name = $segment.Name
			fileName = $fileName
			text = $segment.Text
			voice = $chineseVoice.Name
			rate = $Rate
			volume = $Volume
		}
	}

	$manifestPath = [System.IO.Path]::Combine($resolvedOutputDirectory, 'voiceover-manifest.json')
	$manifest |
		ConvertTo-Json -Depth 4 |
		Set-Content -LiteralPath $manifestPath -Encoding utf8

	[PSCustomObject]@{
		status = 'complete'
		outputDirectory = $resolvedOutputDirectory
		voice = $chineseVoice.Name
		segmentCount = $segments.Count
		manifestPath = $manifestPath
	} | ConvertTo-Json -Depth 3
}
finally {
	$synthesizer.Dispose()
}
