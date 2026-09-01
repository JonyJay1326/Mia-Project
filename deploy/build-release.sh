#!/usr/bin/env bash
# 本地或 CI 构建发布包：编译前后端 → 打 tar.gz（不含 node_modules）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT="${1:-$ROOT/mia-release.tar.gz}"
INSTALL_DEPS="${INSTALL_DEPS:-0}"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

# 构建子项目：默认仅 npm run build；缺 dev 依赖或 INSTALL_DEPS=1 时安装
run_npm_build() {
  local dir="$1"
  cd "$dir"
  local bin_dir="$dir/node_modules/.bin"
  local need_install=0

  if [[ "$INSTALL_DEPS" == "1" ]]; then
    npm ci
  else
    if [[ "$dir" == *"/server" ]]; then
      [[ -x "$bin_dir/nest" ]] || need_install=1
    else
      [[ -x "$bin_dir/vite" ]] || need_install=1
    fi
    if [[ ! -d node_modules ]] || [[ "$need_install" == "1" ]]; then
      echo "    补装构建依赖 (npm install)..."
      npm install
    fi
  fi
  npm run build
}

echo "==> 构建 Mia 发布包"
echo "    项目: $ROOT"
echo "    输出: $OUTPUT"

echo "==> 后端构建"
run_npm_build "$ROOT/server"

echo "==> 前端构建"
run_npm_build "$ROOT/mia-web"

echo "==> 组装发布目录"
mkdir -p "$STAGING/mia-web/dist" "$STAGING/server/dist" "$STAGING/deploy"
cp -a "$ROOT/mia-web/dist/." "$STAGING/mia-web/dist/"
cp -a "$ROOT/server/dist/." "$STAGING/server/dist/"
cp "$ROOT/server/package.json" "$ROOT/server/package-lock.json" "$STAGING/server/"
cp "$ROOT/server/.env.example" "$STAGING/server/"
cp "$ROOT/deploy/ecosystem.config.cjs" "$ROOT/deploy/remote-install.sh" "$STAGING/deploy/"

if [[ -f "$ROOT/Mia档案.md" ]]; then
  cp "$ROOT/Mia档案.md" "$STAGING/"
fi

tar -czf "$OUTPUT" -C "$STAGING" .
echo "==> 发布包已生成: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
