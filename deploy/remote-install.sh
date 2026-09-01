#!/usr/bin/env bash
# 服务器端：解压发布包 → 保留 .env / data → 安装生产依赖 → 重启 PM2
# 前端同步到 1Panel 站点目录；后端仍在 DEPLOY_PATH
set -euo pipefail

TAR="${1:?用法: remote-install.sh <mia-release.tar.gz>}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/mia-project}"
WEB_ROOT="${WEB_ROOT:-/opt/1panel/www/sites/mia-web/index}"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

echo "==> Mia 远程安装开始 ($(date -Iseconds))"
echo "    发布包: $TAR"
echo "    后端:   $DEPLOY_PATH"
echo "    前端:   $WEB_ROOT"

if [[ ! -f "$TAR" ]]; then
  echo "错误: 发布包不存在: $TAR"
  exit 1
fi

tar -xzf "$TAR" -C "$STAGING"

mkdir -p \
  "$WEB_ROOT" \
  "$DEPLOY_PATH/server/dist" \
  "$DEPLOY_PATH/server/data" \
  "$DEPLOY_PATH/deploy"

if [[ ! -f "$DEPLOY_PATH/server/.env" ]]; then
  if [[ -f "$STAGING/server/.env.example" ]]; then
    cp "$STAGING/server/.env.example" "$DEPLOY_PATH/server/.env"
    echo "警告: 已从 .env.example 生成 server/.env，请编辑后再部署一次:"
    echo "       $DEPLOY_PATH/server/.env"
    exit 1
  fi
  echo "错误: $DEPLOY_PATH/server/.env 不存在，请先配置环境变量。"
  exit 1
fi

echo "==> 同步前端到 1Panel 站点目录"
rsync -a --delete "$STAGING/mia-web/dist/" "$WEB_ROOT/"

echo "==> 同步后端产物"
rsync -a --delete "$STAGING/server/dist/" "$DEPLOY_PATH/server/dist/"
cp "$STAGING/server/package.json" "$STAGING/server/package-lock.json" "$DEPLOY_PATH/server/"
cp "$STAGING/deploy/ecosystem.config.cjs" "$STAGING/deploy/remote-install.sh" "$DEPLOY_PATH/deploy/"
chmod +x "$DEPLOY_PATH/deploy/remote-install.sh"
# 去掉可能从 Windows 带入的 CRLF
sed -i 's/\r$//' "$DEPLOY_PATH/deploy/remote-install.sh" || true

if [[ -f "$STAGING/Mia档案.md" ]]; then
  cp "$STAGING/Mia档案.md" "$DEPLOY_PATH/"
fi

echo "==> 安装生产依赖（native 模块须与运行 Node 一致）"
# 先加载 nvm，再 npm（避免用系统旧 Node 装出不兼容的 sharp）
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi
echo "    node: $(command -v node) ($(node -v 2>/dev/null || echo unknown))"

cd "$DEPLOY_PATH/server"
rm -rf node_modules/sharp node_modules/@img
npm ci --omit=dev --include=optional
npm rebuild sharp better-sqlite3
# 仍失败时按当前平台强制重装
npm install --omit=dev --os=linux --cpu=x64 sharp@^0.35.4

echo "==> 重启 API (PM2)"
if pm2 describe mia-api >/dev/null 2>&1; then
  pm2 delete mia-api || true
fi
pm2 start "$DEPLOY_PATH/deploy/ecosystem.config.cjs"
pm2 save

echo "==> 安装完成"
pm2 status mia-api
