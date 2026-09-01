#!/usr/bin/env bash
# 兼容旧用法：在服务器上对已有发布包执行安装
# 推荐在本机运行 deploy/pack-and-upload.sh 或 deploy/pack-and-upload.ps1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAR="${1:-$ROOT/mia-release.tar.gz}"
DEPLOY_PATH="${DEPLOY_PATH:-$ROOT}"

if [[ ! -f "$TAR" ]]; then
  echo "错误: 发布包不存在: $TAR"
  echo "请在本机执行: bash deploy/pack-and-upload.sh"
  exit 1
fi

bash "$ROOT/deploy/remote-install.sh" "$TAR"
