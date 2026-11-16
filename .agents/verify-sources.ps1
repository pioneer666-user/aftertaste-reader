# 核对固定来源字节；不执行导入技能或下载依赖。
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskManifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'sources.json') -Raw | ConvertFrom-Json
$taskExpected = @{}
foreach ($taskEntry in $taskManifest.files) {
    $taskPath = Join-Path $taskRoot $taskEntry.path
    if (-not (Test-Path -LiteralPath $taskPath -PathType Leaf)) { throw "Missing: $($taskEntry.path)" }
    $taskHash = (Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($taskHash -ne $taskEntry.sha256 -or (Get-Item -LiteralPath $taskPath).Length -ne $taskEntry.bytes) {
        throw "Changed: $($taskEntry.path)"
    }
    if ($taskExpected.ContainsKey($taskEntry.path)) { throw "Duplicate: $($taskEntry.path)" }
    $taskExpected[$taskEntry.path] = $true
}
$taskManagedCount = 0
$taskCodexManifest = Join-Path $taskRoot '.specify/integrations/codex.manifest.json'
if (Test-Path -LiteralPath $taskCodexManifest) {
    $taskOfficial = Get-Content -LiteralPath $taskCodexManifest -Raw | ConvertFrom-Json
    foreach ($taskProperty in $taskOfficial.files.PSObject.Properties) {
        $taskRelative = $taskProperty.Name
        if ($taskRelative -notmatch '^\.agents/skills/speckit-[a-z-]+/SKILL\.md$') { throw "Unexpected managed path: $taskRelative" }
        $taskHash = (Get-FileHash -LiteralPath (Join-Path $taskRoot $taskRelative) -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($taskHash -ne $taskProperty.Value) { throw "Changed managed skill: $taskRelative" }
        $taskExpected[$taskRelative] = $true
        $taskManagedCount++
    }
}
foreach ($taskDir in @('skills', 'vendor')) {
    foreach ($taskFile in Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot $taskDir) -Recurse -File -Force) {
        $taskRelative = [IO.Path]::GetRelativePath($taskRoot, $taskFile.FullName).Replace('\', '/')
        if (-not $taskExpected.ContainsKey($taskRelative)) { throw "Unexpected: $taskRelative" }
    }
}
Write-Output "Verified $($taskManifest.files.Count) imported files and $taskManagedCount official Spec Kit skills."
