param([string]$JsonPath, [string]$OutDir, [string]$Voice = "", [int]$Rate = 1)
# Renders each narration line in the JSON array to seg-<i>.wav using Windows TTS.
# $Voice: installed voice name (e.g. "Microsoft David Desktop"); empty = default (Zira if present).
# $Rate: -10 (slowest) .. 10 (fastest); 1 is the tool's default pacing.
$steps = Get-Content $JsonPath -Raw | ConvertFrom-Json
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = [Math]::Max(-10, [Math]::Min(10, $Rate))
if ($Voice) { $synth.SelectVoice($Voice) }  # let a bad name fail loudly rather than silently fall back
else { try { $synth.SelectVoice("Microsoft Zira Desktop") } catch {} }
for ($i = 0; $i -lt $steps.Count; $i++) {
  $synth.SetOutputToWaveFile((Join-Path $OutDir ("seg-$i.wav")))
  $synth.Speak([string]$steps[$i])
}
$synth.SetOutputToNull()
$synth.Dispose()
