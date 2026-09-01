#!/usr/bin/env bash
# 服务器上一键部署：拉代码 → 构建前后端 → 重启 PM2
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${DEPLOY_BRANCH:-main}"

echo "==> Mia 部署开始 ($(date -Iseconds))"
echo "    目录: $ROOT"
echo "    分支: $BRANCH"

if [[ ! -f server/.env ]]; then
  echo "错误: server/.env 不存在。请先复制 server/.env.example 并填写密钥与登录密码。"
  exit 1
fi

echo "==> 拉取最新代码"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> 后端依赖与构建"
cd server
npm ci
npm run build
npm prune --omit=dev
cd "$ROOT"

echo "==> 前端依赖与构建"
cd mia-web
npm ci
npm run build
cd "$ROOT"

echo "==> 重启 API (PM2)"
if pm2 describe mia-api >/dev/null 2>&1; then
  pm2 reload "$ROOT/deploy/ecosystem.config.cjs" --update-env
else
  pm2 start "$ROOT/deploy/ecosystem.config.cjs"
fi
pm2 save

echo "==> 部署完成"
pm2 status mia-api
