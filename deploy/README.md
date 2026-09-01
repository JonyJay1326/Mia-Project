# 部署说明（1Panel · IP + HTTP · 打包上传）

**不在服务器克隆 Git。** 在本机或 GitHub Actions 构建发布包，scp 上传到服务器后解压安装。

## 架构

```
本机 / Actions → 构建 dist → tar.gz → scp → 服务器解压 + npm ci → PM2

浏览器 → Nginx (:8080) → 静态 /opt/1panel/www/sites/mia-web/index/
                      └→ /api → 127.0.0.1:MIA_PORT (PM2 mia-api @ /opt/mia-project)

```

- 后端**只监听** `127.0.0.1`（默认 `3000`，可用 `MIA_PORT` 改，建议 `3001` 避开已有服务）
- **前端生产不占端口**：Nginx 托管 `dist/`
- `better-sqlite3` / `sharp` 在**服务器**上 `npm ci --omit=dev` 编译（勿从 Windows 拷 node_modules）

---

## 一、本机一键部署（推荐）

### 1. 配置 SSH（只做一次）

```powershell
# 复制并编辑（不提交 Git）
copy deploy\.env.deploy.example deploy\.env.deploy
```

```bash
# deploy/.env.deploy
MIA_SSH_HOST=你的服务器IP
MIA_SSH_USER=root
MIA_SSH_PORT=22
MIA_DEPLOY_PATH=/opt/mia-project
MIA_WEB_ROOT=/opt/1panel/www/sites/mia-web/index
```

本机需已安装 **OpenSSH**（Windows 10+ 自带 `ssh` / `scp`）和 **Node 20+**。

### 2. 执行

**Windows（PowerShell）：**

```powershell
.\deploy\pack-and-upload.ps1
```

**Git Bash / WSL / macOS / Linux：**

```bash
chmod +x deploy/pack-and-upload.sh deploy/build-release.sh deploy/remote-install.sh
bash deploy/pack-and-upload.sh
```

脚本会：构建前后端 → 生成 `mia-release.tar.gz` → 上传 → 远程安装并重启 PM2。

**默认只执行 `npm run build`**，不会 `npm ci`（避免 dev 服务占用 `better-sqlite3` 导致 EPERM）。依赖有变时加 `-InstallDeps`，且需先停本地 nest 进程：

```powershell
.\deploy\pack-and-upload.ps1 -InstallDeps
```

### 3. 仅打发布包（不上传）

```bash
bash deploy/build-release.sh
# 产物：项目根目录 mia-release.tar.gz
```

---

## 二、服务器首次初始化（只做一次）

服务器**不需要 git**，只需 Node、PM2、构建工具。

### 1. 依赖

```bash
# 必须 Node 20+（旧版会报 Cannot find module 'node:path'，Nest 也无法运行）
node -v
npm -v
# 若仍是 v12/v14，用 nvm 或 1Panel 应用商店装 Node 20，再：
# npm install -g pm2

npm install -g pm2

# native 模块编译（Debian/Ubuntu）
sudo apt-get update
sudo apt-get install -y build-essential python3 rsync
```

### 2. 目录

```bash
sudo mkdir -p /opt/mia-project
sudo chown "$USER":"$USER" /opt/mia-project
```

### 3. 首次部署

在本机执行 `pack-and-upload`；若服务器尚无 `server/.env`，脚本会从 `.env.example` 生成并**退出**，提示你先编辑：

```bash
nano /opt/mia-project/server/.env
```

至少填写：

```bash
MIA_AI_API_KEY=sk-...
MIA_AUTH_USERNAME=mia
MIA_AUTH_PASSWORD=强密码
MIA_AUTH_SECRET=随机长字符串
MIA_AUTH_TOKEN_DAYS=30
MIA_PORT=3001
```

确认 `Mia档案.md` 会随发布包同步到 `/opt/mia-project/`（AI 咨询读取）。

### 4. 确认端口

```bash
ss -tlnp | grep -E ':3000|:3001'
```

若 3000 已被占用（如班主任管理平台），`.env` 设 `MIA_PORT=3001`，Nginx 反代同步改端口。

### 5. 数据库

```bash
mkdir -p /opt/mia-project/server/data
# 若从本机迁移，把 mia.db 拷到 server/data/
```

### 6. 再次部署 + PM2 开机自启

本机再跑一次 `pack-and-upload`，然后在服务器：

```bash
pm2 startup
pm2 save
curl -s http://127.0.0.1:3001/api/health
```

若 `pm2 logs` 出现 `Unexpected token '?'`，说明应用被系统旧 Node 启动了。用 **nvm 的 Node 20+** 执行：

```bash
which node   # 应类似 /root/.nvm/versions/node/v24.x.x/bin/node
pm2 delete mia-api
pm2 start /opt/mia-project/deploy/ecosystem.config.cjs
pm2 save
```

---

## 三、1Panel / Nginx 静态站点（与 classpilot 共用机：方案 A）

classpilot 继续用 **80**；Mia 新建站监听 **8080**。

1. 网站 → 创建网站 → 静态网站；主域名填服务器 IP；HTTP 端口填 **8080**
2. 网站目录 root 使用 1Panel 默认：`/opt/1panel/www/sites/mia-web/index`（部署脚本会直接同步到此目录）
3. 反向代理：代理路径 `/api` → `http://127.0.0.1:3001`（与 `MIA_PORT` 一致）
4. 伪静态：`try_files $uri $uri/ /index.html;`
5. 云服务器安全组 / 防火墙放行 **8080**
6. 浏览器访问：`http://服务器IP:8080`

参考 `deploy/nginx.mia.conf.example`。

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## 四、GitHub Actions 自动部署

CI 在 Ubuntu 上构建发布包，scp 到服务器，执行 `remote-install.sh`。

### Secrets

| Secret | 说明 |
|--------|------|
| `SSH_HOST` | 服务器 IP |
| `SSH_USER` | SSH 用户名 |
| `SSH_PRIVATE_KEY` | 私钥全文 |
| `SSH_PORT` | 可选，默认 22 |
| `DEPLOY_PATH` | 可选，默认 `/opt/mia-project`（后端） |
| `WEB_ROOT` | 可选，默认 `/opt/1panel/www/sites/mia-web/index`（前端） |

### 触发

- 推送到 `main` 或 `develop`
- 或 Actions 页手动 **Run workflow**

---

## 五、发布包内容

| 包含 | 不包含（留在服务器） |
|------|---------------------|
| 前端 dist → `WEB_ROOT`（1Panel `mia-web/index`） | `server/.env` |
| `server/dist/` → `DEPLOY_PATH` | `server/data/` |
| `server/package.json` + lock | `node_modules/`（服务器重装） |
| `deploy/ecosystem.config.cjs` | |
| `Mia档案.md` | |
| `deploy/remote-install.sh` | |

---

## 六、验收清单

- [ ] `http://IP` → 应用登录页
- [ ] 登录后时间线、快速记录正常
- [ ] 手机录入一条 ≤ 15 秒
- [ ] AI 咨询能回复（需 `MIA_AI_API_KEY`）
- [ ] 本机 `pack-and-upload` 或 Actions 绿勾后页面更新

---

## 七、以后有域名

1. DNS A 记录指向服务器
2. 1Panel 申请 Let's Encrypt，强制 HTTPS
3. `mia-web/.env.production` 设 `VITE_ENABLE_SW=true` 后重新部署
