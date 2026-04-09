param(
    [string]$ProjectRoot = ".",
    [string]$Languages = ""
)

$ErrorActionPreference = "Stop"

$DefaultSupportedLanguages = @(
    "vi",
    "en",
    "fr",
    "de",
    "es",
    "pt",
    "ru",
    "zh",
    "id",
    "hi",
    "ar",
    "tr"
)

$PreferredVoiceKeys = @{
    ar = @("ar_JO-kareem-medium", "ar_JO-kareem-low")
    de = @("de_DE-thorsten-medium", "de_DE-thorsten-low", "de_DE-karlsson-low", "de_DE-kerstin-low")
    en = @("en_US-lessac-medium", "en_GB-alan-medium", "en_US-amy-medium", "en_GB-cori-medium")
    es = @("es_ES-sharvard-medium", "es_ES-davefx-medium", "es_MX-ald-medium")
    fr = @("fr_FR-upmc-medium", "fr_FR-siwis-medium", "fr_FR-mls-medium")
    hi = @("hi_IN-pratham-medium", "hi_IN-priyamvada-medium", "hi_IN-rohan-medium")
    id = @("id_ID-news_tts-medium")
    pt = @("pt_BR-cadu-medium", "pt_PT-tugão-medium", "pt_BR-jeff-medium")
    ru = @("ru_RU-denis-medium", "ru_RU-dmitri-medium", "ru_RU-irina-medium", "ru_RU-ruslan-medium")
    tr = @("tr_TR-dfki-medium")
    vi = @("vi_VN-vais1000-medium", "vi_VN-25hours_single-low", "vi_VN-vivos-x_low")
    zh = @("zh_CN-huayan-medium", "zh_CN-xiao_ya-medium", "zh_CN-chaowen-medium")
}

$QualityRank = @{
    medium = 0
    high = 1
    low = 2
    x_low = 3
}

function Set-Or-AppendEnvValue {
    param(
        [string]$FilePath,
        [string]$Key,
        [string]$Value
    )

    $escapedKey = [regex]::Escape($Key)
    $line = "$Key=\"$Value\""

    if (-not (Test-Path $FilePath)) {
        Set-Content -Path $FilePath -Value $line
        return
    }

    $content = Get-Content -Path $FilePath -Raw
    if ($content -match "(?m)^$escapedKey=") {
        $updated = [regex]::Replace($content, "(?m)^$escapedKey=.*$", $line)
        Set-Content -Path $FilePath -Value $updated
        return
    }

    if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) {
        $content += "`r`n"
    }

    $content += "$line`r`n"
    Set-Content -Path $FilePath -Value $content
}

function Get-EnvValueFromFile {
    param(
        [string]$FilePath,
        [string]$Key
    )

    if (-not (Test-Path $FilePath)) {
        return $null
    }

    $pattern = "(?m)^$([regex]::Escape($Key))=(.*)$"
    $content = Get-Content -Path $FilePath -Raw
    if ($content -notmatch $pattern) {
        return $null
    }

    $value = $Matches[1].Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"') -and $value.Length -ge 2) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    return $value
}

function Split-LanguageList {
    param(
        [string]$RawValue
    )

    if ([string]::IsNullOrWhiteSpace($RawValue)) {
        return @()
    }

    $items = $RawValue -split '[,;\s]+'
    $normalized = New-Object System.Collections.Generic.List[string]

    foreach ($item in $items) {
        $candidate = $item.Trim().Trim('"').ToLower()
        if ($candidate) {
            $normalized.Add($candidate)
        }
    }

    return $normalized.ToArray() | Select-Object -Unique
}

function Get-SupportedLanguages {
    param(
        [string]$BackendDir,
        [string]$OverrideLanguages
    )

    if (-not [string]::IsNullOrWhiteSpace($OverrideLanguages)) {
        return Split-LanguageList -RawValue $OverrideLanguages
    }

    foreach ($candidatePath in @(
        (Join-Path $BackendDir ".env")
    )) {
        $value = Get-EnvValueFromFile -FilePath $candidatePath -Key "TTS_SUPPORTED_LANGUAGES"
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return Split-LanguageList -RawValue $value
        }
    }

    return $DefaultSupportedLanguages
}

function Resolve-PiperExecutable {
    try {
        $command = Get-Command piper -ErrorAction Stop
        if ($command.Source -and (Test-Path $command.Source)) {
            return (Resolve-Path $command.Source).Path
        }
    } catch {
    }

    $candidates = New-Object System.Collections.Generic.List[string]

    try {
        $userBase = (& py -c "import site; print(site.getuserbase())").Trim()
        if ($LASTEXITCODE -eq 0 -and $userBase) {
            $candidates.Add((Join-Path $userBase "Scripts\piper.exe"))
        }
    } catch {
    }

    try {
        $pythonExeDir = (& py -c "import os, sys; print(os.path.dirname(sys.executable))").Trim()
        if ($LASTEXITCODE -eq 0 -and $pythonExeDir) {
            $candidates.Add((Join-Path $pythonExeDir "Scripts\piper.exe"))
            $candidates.Add((Join-Path (Split-Path $pythonExeDir -Parent) "Scripts\piper.exe"))
        }
    } catch {
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return (Resolve-Path $candidate).Path
        }
    }

    throw "Cannot locate piper.exe. Verify Python launcher 'py' and package piper-tts are installed."
}

function Get-VoiceCatalog {
    $catalogUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/main/voices.json?download=true"
    Write-Host "Fetching Piper voice catalog from Hugging Face..."
    $response = Invoke-WebRequest -Uri $catalogUrl -MaximumRedirection 10 -TimeoutSec 120
    return $response.Content | ConvertFrom-Json
}

function Select-VoiceForLanguage {
    param(
        [string]$LanguageCode,
        $VoiceCatalog
    )

    $normalizedLanguage = $LanguageCode.Trim().ToLower()
    if (-not $normalizedLanguage) {
        throw "Language code must not be empty."
    }

    $preferredKeys = $PreferredVoiceKeys[$normalizedLanguage]
    if ($preferredKeys) {
        foreach ($preferredKey in $preferredKeys) {
            if ($VoiceCatalog.PSObject.Properties.Name -contains $preferredKey) {
                return $VoiceCatalog.$preferredKey
            }
        }
    }

    $matchedVoices = New-Object System.Collections.Generic.List[object]
    foreach ($entry in $VoiceCatalog.PSObject.Properties) {
        $voice = $entry.Value
        $family = $voice.language.family
        $regionCode = $voice.language.code

        if ($family -eq $normalizedLanguage -or $regionCode -like "$normalizedLanguage`_*") {
            $matchedVoices.Add($voice)
        }
    }

    if ($matchedVoices.Count -eq 0) {
        throw "No Piper voice found for language '$normalizedLanguage'."
    }

    $selected = $matchedVoices | Sort-Object `
        @{ Expression = { $QualityRank[$_.quality] }; Ascending = $true }, `
        @{ Expression = { $_.key }; Ascending = $true } | Select-Object -First 1

    if (-not $selected) {
        throw "Unable to select a Piper voice for language '$normalizedLanguage'."
    }

    return $selected
}

function Get-VoiceDownloadInfo {
    param(
        [string]$LanguageCode,
        $VoiceCatalog
    )

    $voice = Select-VoiceForLanguage -LanguageCode $LanguageCode -VoiceCatalog $VoiceCatalog
    $onnxFile = $voice.files.PSObject.Properties |
        Where-Object { $_.Name -like "*.onnx" } |
        Select-Object -First 1

    if (-not $onnxFile) {
        throw "Selected Piper voice '$($voice.key)' does not expose an .onnx file."
    }

    $relativePath = $onnxFile.Name
    $downloadUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/main/$relativePath?download=true"

    return [pscustomobject]@{
        LanguageCode = $LanguageCode
        VoiceKey = $voice.key
        DownloadUrl = $downloadUrl
        RelativePath = $relativePath
    }
}

function Download-Model {
    param(
        [string]$OutFile,
        [string]$Url,
        [string]$VoiceKey
    )

    $maxAttempts = 3
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            Write-Host "Downloading $VoiceKey ($attempt/$maxAttempts)..."
            Invoke-WebRequest -Uri $Url -OutFile $OutFile -MaximumRedirection 10 -TimeoutSec 600
            $size = (Get-Item $OutFile).Length
            if ($size -gt 1000000) {
                return
            }

            Remove-Item -Path $OutFile -Force -ErrorAction SilentlyContinue
            throw "Downloaded file is too small."
        } catch {
            if ($attempt -eq $maxAttempts) {
                throw "Failed to download Piper model '$VoiceKey' from $Url."
            }
        }
    }
}

$projectRootResolved = (Resolve-Path $ProjectRoot).Path
$backendDir = Join-Path $projectRootResolved "apps/backend"
if (-not (Test-Path $backendDir)) {
    throw "Cannot find backend directory at: $backendDir"
}

$envPath = Join-Path $backendDir ".env"
$envExamplePath = Join-Path $backendDir ".env.example"
if (-not (Test-Path $envPath)) {
    if (-not (Test-Path $envExamplePath)) {
        throw "Cannot find .env or .env.example in backend directory."
    }
    Copy-Item -Path $envExamplePath -Destination $envPath
}

Write-Host "Installing Piper via pip..."
& py -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) {
    throw "Failed to upgrade pip."
}

& py -m pip install --upgrade piper-tts
if ($LASTEXITCODE -ne 0) {
    throw "Failed to install piper-tts."
}

$piperExe = Resolve-PiperExecutable
Write-Host "Resolved Piper executable: $piperExe"

$supportedLanguages = Get-SupportedLanguages -BackendDir $backendDir -OverrideLanguages $Languages
if ($supportedLanguages.Count -eq 0) {
    throw "No TTS languages were configured."
}

$voiceCatalog = Get-VoiceCatalog

$modelDir = Join-Path $backendDir "piper/models"
New-Item -Path $modelDir -ItemType Directory -Force | Out-Null

$downloadedLanguages = New-Object System.Collections.Generic.List[string]
foreach ($lang in $supportedLanguages) {
    $downloadInfo = Get-VoiceDownloadInfo -LanguageCode $lang -VoiceCatalog $voiceCatalog
    $modelPath = Join-Path $modelDir "$($downloadInfo.LanguageCode).onnx"

    if ((Test-Path $modelPath) -and ((Get-Item $modelPath).Length -gt 1000000)) {
        Write-Host "Skipping $($downloadInfo.LanguageCode): model already exists."
        $downloadedLanguages.Add($downloadInfo.LanguageCode)
        continue
    }

    Download-Model -OutFile $modelPath -Url $downloadInfo.DownloadUrl -VoiceKey $downloadInfo.VoiceKey
    $downloadedLanguages.Add($downloadInfo.LanguageCode)
}

if ($supportedLanguages -contains "vi") {
    $smokeLanguage = "vi"
} else {
    $smokeLanguage = $supportedLanguages[0]
}

$smokeModelPath = Join-Path $modelDir "$smokeLanguage.onnx"
$tmpWav = Join-Path ([System.IO.Path]::GetTempPath()) "piper-smoke-$smokeLanguage.wav"
if ($smokeLanguage -eq "vi") {
    $smokeText = "Xin chao"
} else {
    $smokeText = "Hello"
}

$smokeText | & $piperExe --model $smokeModelPath --output_file $tmpWav
if ($LASTEXITCODE -ne 0) {
    throw "Piper smoke test failed to execute."
}
if (-not (Test-Path $tmpWav) -or (Get-Item $tmpWav).Length -lt 500) {
    throw "Piper smoke test did not produce valid WAV output."
}
Remove-Item -Path $tmpWav -Force -ErrorAction SilentlyContinue

$piperExeNormalized = $piperExe -replace "\\", "/"
Set-Or-AppendEnvValue -FilePath $envPath -Key "PIPER_BIN" -Value $piperExeNormalized
Set-Or-AppendEnvValue -FilePath $envPath -Key "PIPER_MODEL_DIR" -Value "./piper/models"
Set-Or-AppendEnvValue -FilePath $envPath -Key "PIPER_MODEL_MAP" -Value ""

Write-Host "Piper setup completed successfully."
Write-Host "Updated: $envPath"
Write-Host "Downloaded languages: $($downloadedLanguages -join ', ')"
