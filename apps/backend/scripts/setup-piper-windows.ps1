param(
    [string]$ProjectRoot = ".",
    [string]$Language = "vi"
)

$ErrorActionPreference = "Stop"

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

function Download-ModelWithFallback {
    param(
        [string]$OutFile,
        [string[]]$Urls
    )

    foreach ($url in $Urls) {
        try {
            Write-Host "Trying model URL: $url"
            Invoke-WebRequest -Uri $url -OutFile $OutFile -MaximumRedirection 10 -TimeoutSec 240
            $size = (Get-Item $OutFile).Length
            if ($size -gt 1000000) {
                return
            }
            Remove-Item -Path $OutFile -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Warning "Model download failed from: $url"
        }
    }

    throw "Failed to download Piper model from all fallback URLs."
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

$modelDir = Join-Path $backendDir "piper/models"
New-Item -Path $modelDir -ItemType Directory -Force | Out-Null

$lang = $Language.Trim().ToLower()
if (-not $lang) {
    throw "Language must not be empty."
}

$modelPath = Join-Path $modelDir "$lang.onnx"
if (-not (Test-Path $modelPath) -or (Get-Item $modelPath).Length -lt 1000000) {
    $urls = @(
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/vais1000/medium/vi_VN-vais1000-medium.onnx?download=true",
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/vais1000/medium/vi_VN-vais1000-medium.onnx"
    )

    Download-ModelWithFallback -OutFile $modelPath -Urls $urls
}

$tmpWav = Join-Path ([System.IO.Path]::GetTempPath()) "piper-smoke-$lang.wav"
"Xin chao" | & $piperExe --model $modelPath --output_file $tmpWav
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
Write-Host "Model: $modelPath"
