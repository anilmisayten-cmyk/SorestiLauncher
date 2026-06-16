$gameVersion = "1.21.4"
$baseDir = "$PSScriptRoot\..\assets\fabric-setup"

Write-Host "Fetching Fabric loader metadata for $gameVersion..."
$loaders = Invoke-RestMethod "https://meta.fabricmc.net/v2/versions/loader/$gameVersion"
$loader = $loaders[0]
$loaderVersion = $loader.loader.version
Write-Host "Latest loader: $loaderVersion"

$profile = Invoke-RestMethod "https://meta.fabricmc.net/v2/versions/loader/$gameVersion/$loaderVersion/profile/json"
$profile | ConvertTo-Json -Depth 10 | Set-Content "$baseDir\profile.json"

$libsDir = "$baseDir\libraries"
New-Item -ItemType Directory -Path $libsDir -Force | Out-Null

$done = 0
$total = $profile.libraries.Count
foreach ($lib in $profile.libraries) {
    $done++
    Write-Host "[$done/$total] $($lib.name)"
    $parts = $lib.name -split ':'
    $group = $parts[0]
    $artifact = $parts[1]
    $version = $parts[2]
    $groupPath = $group -replace '\.', '/'
    $jarName = "$artifact-$version.jar"

    if ($lib.url) {
        $url = "$($lib.url)$groupPath/$artifact/$version/$jarName"
    } elseif ($lib.downloads.artifact.url) {
        $url = $lib.downloads.artifact.url
    } else {
        continue
    }

    $dest = "$libsDir\$groupPath\$artifact\$version\$jarName"
    New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null
    try {
        Invoke-WebRequest -Uri $url -OutFile $dest -ErrorAction Stop
        Write-Host "  OK"
    } catch {
        Write-Host "  FAILED: $url"
    }
}

$modSrc = "$PSScriptRoot\..\assets\sorestioverlay.jar"
$modsDir = "$baseDir\mods"
New-Item -ItemType Directory -Path $modsDir -Force | Out-Null
if (Test-Path $modSrc) {
    Copy-Item $modSrc "$modsDir\sorestioverlay.jar" -Force
    Write-Host "Mod JAR copied"
}

Write-Host "Done! Fabric $loaderVersion for $gameVersion downloaded to $baseDir"
