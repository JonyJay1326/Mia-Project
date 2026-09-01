# Mia 的成长中心

阶段一：记录 + 时间线 + 渺言妙语 + 毯子小精灵。  
阶段二：崩溃统计分析。  
阶段三：相册 + 技能地图 + AI 咨询（DeepSeek + Mia 档案）。

## 目录

```
Mia-Project/
├── mia-web/     # 前端 Vue 3 + Vite + Pinia + Element Plus
├── server/      # 后端 NestJS + FastifyAdapter + SQLite
├── deploy/      # 部署说明与 Nginx 配置
└── …规格与档案
```

## 本地开发

```bash
# 前端（http://localhost:5173）
cd mia-web
npm install
npm run dev

# 后端（http://127.0.0.1:3000/api）
cd server
npm install
npm run start:dev
```

健康检查：`GET http://127.0.0.1:3000/api/health`
