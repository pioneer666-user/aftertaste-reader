[CmdletBinding()]
param([Parameter(Mandatory)][string] $ProjectPath)

$ErrorActionPreference = 'Stop'
$repository = 'https://github.com/apache/answer.git'
$commit = '3f1ed50f6776452c11b6ffdbdc767cd1887d629b'
$project = (New-Item -ItemType Directory -Path $ProjectPath).FullName

git init --quiet $project
if ($LASTEXITCODE) { throw 'git init 失败' }
git -C $project remote add origin $repository
if ($LASTEXITCODE) { throw '设置上游地址失败' }
git -C $project fetch --quiet --depth=1 origin $commit
if ($LASTEXITCODE) { throw '获取固定提交失败' }
git -C $project checkout --quiet --detach FETCH_HEAD
if ($LASTEXITCODE) { throw '检出固定提交失败' }
$head = git -C $project rev-parse HEAD
if ($LASTEXITCODE -or $head -ne $commit) { throw '检出版本不符' }
if (Test-Path -LiteralPath (Join-Path $project 'docs/aftertaste')) { throw '目标已含回味资料' }

[pscustomobject]@{ project = $project; repository = $repository; commit = $head; hasAftertaste = $false }
