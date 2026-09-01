# 部署说明（1Panel · IP + HTTP · 应用登录）

推送到 GitHub `main` 分支后，Actions 会 SSH 到服务器执行 `deploy/deploy.sh` 自动构建并重启。

## 架构

```
浏览器 → Nginx (80) → 静态 dist/
                  └→ /api → 127.0.0.1:MIA_PORT (PM2 mia-api)
```

- 后端**只监听** `127.0.0.1`（默认端口 `3000`，可用 `MIA_PORT` 改）
- **前端生产环境不占端口**：由 Nginx 直接托管 `dist/`，走 80/443
- 应用内登录：`server/.env` 配置 `MIA_AUTH_*`
- 可选 Nginx Basic Auth 额外挡扫描（见 `nginx.mia.conf.example`）

---

## 一、服务器首次初始化（只做一次）

### 1. 依赖

```bash
# Node 20+（1Panel 应用商店或 nvm）
node -v
npm -v

# PM2
npm install -g pm2

# 构建 native 模块（better-sqlite3 / sharp）
# Debian/Ubuntu:
sudo apt-get update
sudo apt-get install -y git build-essential python3
```

### 2. 克隆代码

```bash
sudo mkdir -p /opt/mia-project
sudo chown "$USER":"$USER" /opt/mia-project
git clone https://github.com/你的用户名/Mia-Project.git /opt/mia-project
cd /opt/mia-project
```

### 3. 配置环境变量（不提交 Git）

```bash
cp server/.env.example server/.env
nano server/.env
```

至少填写：

```bash
# AI 咨询
MIA_AI_API_KEY=sk-...

# 应用内登录（必填，否则不会跳转登录页）
MIA_AUTH_USERNAME=mia
MIA_AUTH_PASSWORD=强密码
MIA_AUTH_SECRET=随机长字符串
MIA_AUTH_TOKEN_DAYS=30
```

确认 `Mia档案.md` 在项目根目录（AI 咨询会读）。

### 4. 确认端口（与已有服务错开）

```bash
ss -tlnp | grep -E ':3000|:3001'
```

若 **3000 已被占用**（如班主任管理平台），在 `server/.env` 改用其他端口：

```bash
MIA_PORT=3001
```

Nginx 反代也要改成同一端口：

```nginx
proxy_pass http://127.0.0.1:3001/api/;
```

本地开发端口（`5173` / `3000`）与服务器无关，不用改。

### 5. 数据库目录

```bash
mkdir -p server/data
# 若从本机迁移，把 mia.db 拷到 server/data/
```

### 6. 首次构建与启动

```bash
chmod +x deploy/deploy.sh
bash deploy/deploy.sh

# 开机自启
pm2 startup
pm2 save
```

### 7. 确认 API 存活

```bash
# 按 .env 里的 MIA_PORT 检查，默认 3000
curl -s http://127.0.0.1:3001/api/health
```

---

## 二、1Panel / Nginx 静态站点

1. 新建网站，根目录：`/opt/mia-project/mia-web/dist`
2. 站点域名填**服务器 IP**
3. 反向代理：`/api` → `http://127.0.0.1:3001`（与 `MIA_PORT` 一致）
4. 参考 `deploy/nginx.mia.conf.example`

SPA 需要：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## 三、GitHub 自动部署

### 1. 服务器 SSH 密钥

在**服务器**生成专用于部署的密钥对（或使用已有）：

```bash
ssh-keygen -t ed25519 -C "github-deploy-mia" -f ~/.ssh/github_deploy_mia -N ""
cat ~/.ssh/github_deploy_mia.pub >> ~/.ssh/authorized_keys
```

把**私钥**内容复制出来，待会填到 GitHub Secret。

### 2. GitHub Secrets

仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret | 说明 |
|--------|------|
| `SSH_HOST` | 服务器 IP |
| `SSH_USER` | SSH 用户名（如 `root` 或面板用户） |
| `SSH_PRIVATE_KEY` | 私钥全文（`github_deploy_mia`） |
| `SSH_PORT` | 可选，默认 22 |
| `DEPLOY_PATH` | 可选，默认 `/opt/mia-project` |

### 3. 触发方式

- 推送到 `main` 分支自动部署
- 或 Actions 页手动 **Run workflow**

### 4. 查看日志

GitHub → Actions → 最新 Deploy to Server 运行记录。

---

## 四、手动部署（不用 Actions 时）

```bash
cd /opt/mia-project
bash deploy/deploy.sh
```

---

## 五、本地构建（可选）

```bash
cd mia-web && npm ci && npm run build
cd ../server && npm ci && npm run build
```

产物：`mia-web/dist/`、`server/dist/`

---

## 六、验收清单

- [ ] `http://IP` 打开 → 应用登录页
- [ ] 登录后能看时间线、快速记录
- [ ] 手机同一地址录入一条 ≤ 15 秒
- [ ] AI 咨询能回复（需 `MIA_AI_API_KEY`）
- [ ] 推送到 `main` 后 Actions 绿勾，页面更新生效

---

## 七、以后有域名

1. DNS A 记录指向服务器
2. 1Panel 申请 Let's Encrypt，强制 HTTPS
3. `mia-web/.env.production` 设 `VITE_ENABLE_SW=true` 后重新部署
