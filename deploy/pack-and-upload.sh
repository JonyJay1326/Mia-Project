#!/usr/bin/env bash
# 本地一键：构建发布包 → scp 上传 → SSH 远程安装（服务器无需 git）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/deploy/.env.deploy"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

sshHost="${MIA_SSH_HOST:-}"
sshUser="${MIA_SSH_USER:-}"
sshPort="${MIA_SSH_PORT:-22}"
deployPath="${MIA_DEPLOY_PATH:-/opt/mia-project}"
webRoot="${MIA_WEB_ROOT:-/opt/1panel/www/sites/mia-web/index}"
releaseTar="$ROOT/mia-release.tar.gz"
remoteTar="/tmp/mia-release.tar.gz"

if [[ -z "$sshHost" || -z "$sshUser" ]]; then
  echo "错误: 请配置 deploy/.env.deploy（参考 deploy/.env.deploy.example）"
  exit 1
fi

sshTarget="${sshUser}@${sshHost}"
sshArgs=(-p "$sshPort" -o "StrictHostKeyChecking=accept-new")

echo "==> 目标: $sshTarget"
echo "    后端: $deployPath"
echo "    前端: $webRoot"

bash "$ROOT/deploy/build-release.sh" "$releaseTar"

echo "==> 上传发布包"
scp "${sshArgs[@]}" "$releaseTar" "${sshTarget}:${remoteTar}"

echo "==> 远程安装"
ssh "${sshArgs[@]}" "$sshTarget" "DEPLOY_PATH='$deployPath' WEB_ROOT='$webRoot' bash -s" <<EOF
set -euo pipefail
mkdir -p '$deployPath/deploy'
# 始终用发布包内脚本，避免服务器旧版踩坑
staging=\$(mktemp -d)
tar -xzf '$remoteTar' -C "\$staging"
DEPLOY_PATH='$deployPath' WEB_ROOT='$webRoot' bash "\$staging/deploy/remote-install.sh" '$remoteTar'
rm -rf "\$staging"
rm -f '$remoteTar'
EOF

echo "==> 部署完成"
