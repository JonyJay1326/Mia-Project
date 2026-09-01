# pack-and-upload.ps1 - build release tarball, scp upload, remote install
param(
    [string]$SshHost,
    [string]$SshUser,
    [int]$SshPort,
    [string]$DeployPath,
    [string]$WebRoot,
    [switch]$InstallDeps
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $PSScriptRoot '.env.deploy'

# 从 deploy/.env.deploy 读取 SSH 配置
function Import-DeployEnv {
    param(
        [string]$Path
    )
    if (-not (Test-Path $Path)) {
        return
    }
    Get-Content -Path $Path -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq '' -or $line.StartsWith('#')) {
            return
        }
        $eq = $line.IndexOf('=')
        if ($eq -lt 1) {
            return
        }
        $key = $line.Substring(0, $eq).Trim()
        $val = $line.Substring($eq + 1).Trim()
        $val = $val.Trim('"').Trim("'")
        Set-Item -Path "Env:$key" -Value $val
    }
}

# 解析 SSH 与部署路径（参数 > 环境变量 > 默认值）
function Resolve-DeployConfig {
    param(
        [string]$HostName,
        [string]$UserName,
        [int]$Port,
        [string]$Path,
        [string]$Web
    )
    Import-DeployEnv -Path $envFile

    if ([string]::IsNullOrWhiteSpace($HostName)) {
        $HostName = $env:MIA_SSH_HOST
    }
    if ([string]::IsNullOrWhiteSpace($UserName)) {
        $UserName = $env:MIA_SSH_USER
    }
    if ($Port -le 0) {
        if ($env:MIA_SSH_PORT) {
            $Port = [int]$env:MIA_SSH_PORT
        } else {
            $Port = 22
        }
    }
    if ([string]::IsNullOrWhiteSpace($Path)) {
        if ($env:MIA_DEPLOY_PATH) {
            $Path = $env:MIA_DEPLOY_PATH
        } else {
            $Path = '/opt/mia-project'
        }
    }
    if ([string]::IsNullOrWhiteSpace($Web)) {
        if ($env:MIA_WEB_ROOT) {
            $Web = $env:MIA_WEB_ROOT
        } else {
            $Web = '/opt/1panel/www/sites/mia-web/index'
        }
    }

    return @{
        sshHost = $HostName
        sshUser = $UserName
        sshPort = $Port
        deployPath = $Path
        webRoot = $Web
    }
}

# 检查构建 CLI 是否已安装（devDependencies）
function Test-NpmBuildReady {
    param(
        [string]$Dir
    )
    $binDir = Join-Path $Dir 'node_modules\.bin'
    if (-not (Test-Path $binDir)) {
        return $false
    }
    if ($Dir -match '[\\/]server$') {
        return (Test-Path (Join-Path $binDir 'nest.cmd')) -or (Test-Path (Join-Path $binDir 'nest'))
    }
    return (Test-Path (Join-Path $binDir 'vite.cmd')) -or (Test-Path (Join-Path $binDir 'vite'))
}

# 在指定目录构建；默认仅 npm run build，缺 dev 依赖时 npm install 补装
function Invoke-NpmBuild {
    param(
        [string]$Dir,
        [switch]$InstallDeps
    )
    Push-Location $Dir
    try {
        if ($InstallDeps) {
            npm ci
            if ($LASTEXITCODE -ne 0) {
                throw "npm ci failed in $Dir。请先停止本地 dev 服务（Ctrl+C 停 nest / node），再重试；或去掉 -InstallDeps 仅构建。"
            }
        } elseif (-not (Test-NpmBuildReady -Dir $Dir)) {
            Write-Host "    补装构建依赖 (npm install)..."
            npm install
            if ($LASTEXITCODE -ne 0) { throw "npm install failed in $Dir" }
        }
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed in $Dir" }
    } finally {
        Pop-Location
    }
}

# 组装发布目录并打 tar.gz
function New-ReleaseTarball {
    param(
        [string]$ProjectRoot,
        [string]$OutputPath
    )
    $staging = Join-Path $env:TEMP ('mia-staging-' + [Guid]::NewGuid().ToString('N'))
    $webDist = Join-Path $staging 'mia-web\dist'
    $serverDist = Join-Path $staging 'server\dist'
    $deployDir = Join-Path $staging 'deploy'
    $serverDir = Join-Path $staging 'server'

    New-Item -ItemType Directory -Force -Path $webDist, $serverDist, $deployDir, $serverDir | Out-Null

    Copy-Item -Path (Join-Path $ProjectRoot 'mia-web\dist\*') -Destination $webDist -Recurse -Force
    Copy-Item -Path (Join-Path $ProjectRoot 'server\dist\*') -Destination $serverDist -Recurse -Force
    Copy-Item -Path (Join-Path $ProjectRoot 'server\package.json') -Destination $serverDir -Force
    Copy-Item -Path (Join-Path $ProjectRoot 'server\package-lock.json') -Destination $serverDir -Force
    Copy-Item -Path (Join-Path $ProjectRoot 'server\.env.example') -Destination $serverDir -Force
    Copy-Item -Path (Join-Path $ProjectRoot 'deploy\ecosystem.config.cjs') -Destination $deployDir -Force
    Copy-Item -Path (Join-Path $ProjectRoot 'deploy\remote-install.sh') -Destination $deployDir -Force

    $archivePath = Join-Path $ProjectRoot 'Mia档案.md'
    if (Test-Path $archivePath) {
        Copy-Item -Path $archivePath -Destination $staging -Force
    }

    if (Test-Path $OutputPath) {
        Remove-Item -Force $OutputPath
    }
    tar -czf $OutputPath -C $staging .
    if ($LASTEXITCODE -ne 0) { throw 'tar failed' }
    Remove-Item -Recurse -Force $staging
}

$config = Resolve-DeployConfig -HostName $SshHost -UserName $SshUser -Port $SshPort -Path $DeployPath -Web $WebRoot
$SshHost = $config.sshHost
$SshUser = $config.sshUser
$SshPort = $config.sshPort
$DeployPath = $config.deployPath
$WebRoot = $config.webRoot

if ([string]::IsNullOrWhiteSpace($SshHost) -or [string]::IsNullOrWhiteSpace($SshUser)) {
    Write-Error '请配置 deploy/.env.deploy（参考 deploy/.env.deploy.example）'
}

$releaseTar = Join-Path $root 'mia-release.tar.gz'
$remoteTar = '/tmp/mia-release.tar.gz'
$sshTarget = "$SshUser@$SshHost"

Write-Host "==> 目标: $sshTarget"
Write-Host "    后端: $DeployPath"
Write-Host "    前端: $WebRoot"

Write-Host '==> 后端构建'
Invoke-NpmBuild -Dir (Join-Path $root 'server') -InstallDeps:$InstallDeps

Write-Host '==> 前端构建'
Invoke-NpmBuild -Dir (Join-Path $root 'mia-web') -InstallDeps:$InstallDeps

Write-Host '==> 打包发布'
New-ReleaseTarball -ProjectRoot $root -OutputPath $releaseTar
Write-Host "==> 发布包已生成: $releaseTar"

Write-Host '==> 上传发布包'
scp -P $SshPort -o StrictHostKeyChecking=accept-new $releaseTar "${sshTarget}:${remoteTar}"
if ($LASTEXITCODE -ne 0) { throw 'scp failed' }

$remoteScript = @'
set -euo pipefail
DEPLOY_PATH='__DEPLOY_PATH__'
WEB_ROOT='__WEB_ROOT__'
REMOTE_TAR='__REMOTE_TAR__'
mkdir -p "$DEPLOY_PATH/deploy"
# 始终用发布包内脚本，避免服务器旧版踩坑
staging=$(mktemp -d)
tar -xzf "$REMOTE_TAR" -C "$staging"
DEPLOY_PATH="$DEPLOY_PATH" WEB_ROOT="$WEB_ROOT" bash "$staging/deploy/remote-install.sh" "$REMOTE_TAR"
rm -rf "$staging"
rm -f "$REMOTE_TAR"
'@
$remoteScript = $remoteScript.Replace('__DEPLOY_PATH__', $DeployPath).Replace('__WEB_ROOT__', $WebRoot).Replace('__REMOTE_TAR__', $remoteTar)

Write-Host '==> 远程安装'
$remoteScript | ssh -p $SshPort -o StrictHostKeyChecking=accept-new $sshTarget 'bash -s'
if ($LASTEXITCODE -ne 0) { throw 'remote install failed' }

Write-Host '==> 部署完成'
