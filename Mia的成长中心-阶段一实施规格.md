# Mia 的成长中心 · 实施规格（总册）

> 交付对象：Cursor。这份文档要能达到「照着做就能跑起来」的程度。  
> 文件名仍带「阶段一」，但正文已覆盖阶段二/三落地结果；任务勾选以 `.cursor/rules/40|45|46|47|48` 为准。  
> **修订（2026-09-01）**：事件类型拆分、场景卡 v3、分析砍照护人/按星期、AI 咨询历史、可选应用内登录等已与代码对齐。

## 0. 目标与边界

**已交付（阶段一～三）：**

- 电脑端为主的信息浏览（侧边栏 + 时间线）
- 手机端 10 秒完成一条事件记录
- **渺言妙语：记录她说的话，按月龄分组展示**
- **请求失败时存本地，联网自动补交**（草稿队列，不依赖 Service Worker）
- 崩溃统计分析 `/analysis`（自绘条形图 + 可选 AI 解读）
- 相册 `/album`、技能地图 `/skills`、AI 咨询 `/consult`（DeepSeek + Mia 档案）

**仍不做 / 后置：**

- 语录的搜索 / 标签 / 导出（搜索已实现；标签与导出等攒够量再加）
- **Service Worker** —— 无域名无 HTTPS，见 7.1；IndexedDB 草稿队列照做
- 技能备注编辑 UI、删除自定义技能 API/UI（`PATCH .../note`、`DELETE /api/skills/:id`）
- 常模诊断、倒退预警、判断写回 events/quotes

**鉴权：**

- **Nginx Basic Auth 仍是公网挡扫描的主手段**（见 8.2）
- **可选**应用内登录：配 `MIA_AUTH_USERNAME` / `MIA_AUTH_PASSWORD` / `MIA_AUTH_SECRET` 后启用 Bearer；未配则关闭

**⚠️ 能力缺口（用户决策：不用域名，IP + HTTP 先跑）：**

- **不做 Service Worker** → 断网时页面打不开 → 「断网也能记」能力暂缺
- 原因：Service Worker 强制要求 HTTPS，HTTPS 需要域名，Let's Encrypt 不给裸 IP 签证书
- 影响不大：手机在户外基本都有 4G/5G，真正断网场景少。等买了域名再补（T18/T19）
- 详见 7.1 节

**为什么先做记录：** 系统可以慢慢长，记录习惯得从第一条开始。第一步不做窄，后面全白搭。

---

## 1. 技术栈

| 层   | 选型                          | 理由                                                 |
| --- | --------------------------- | -------------------------------------------------- |
| 前端  | Vue 3 + TypeScript + Vite   | 用户主栈                                               |
| 状态  | Pinia                       | 事件列表、草稿队列                                          |
| UI  | **Element Plus**            | 主要使用场景是电脑，Element Plus 更合适且用户熟悉（Vant 是移动端库，大屏上会很怪） |
| PWA | vite-plugin-pwa             | 手机端录入用，添加到主屏幕。**⚠️ 阶段一先不注册 Service Worker，见 7.1**  |
| 后端  | **NestJS + FastifyAdapter** | 见下方说明                                              |
| 数据库 | **SQLite**（better-sqlite3）  | 零运维，备份即复制文件                                        |

### 1.0 ⚠️ 后端：NestJS 必须配 Fastify 适配器（2026-08-31 用户决策）

用户选了 **NestJS**（不是 Fastify）。但服务器只有 **3.32 GB 内存**，且已跑着「班主任管理平台」一个站点，内存必须省。

**解法：NestJS 默认用 Express，换成 Fastify 当底层适配器即可**，两者都要：

```typescript
// server/src/main.ts
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  )

  app.setGlobalPrefix('api')                    // 所有路由自动加 /api 前缀
  app.enableCors({ origin: true })              // 开发期允许前端跨域

  // ⚠️ 只监听本机！Nginx 反向代理转发 /api/* 过来。
  // 绑 0.0.0.0 会让 3000 端口直接暴露到公网，绕过 Basic Auth。
  await app.listen(3000, '127.0.0.1')
}
bootstrap()
```

|      | NestJS + Express（默认） | **NestJS + Fastify（要用这个）** |
| ---- | -------------------- | -------------------------- |
| 内存占用 | 高                    | **低 100–200 MB**           |
| 性能   | 一般                   | 高 2–3 倍                    |
| 开发体验 | NestJS 全家桶           | **完全一样**                   |

**注意点：**

- 装 `@nestjs/platform-fastify`，别装 `@nestjs/platform-express`
- 中间件写法有差异：Fastify 用 `@fastify/middie` 或直接写 `FastifyMiddleware`
- 上传文件用 `@fastify/multipart`，不是 `multer`
- 依赖注入、装饰器、模块划分 **完全不受影响**，业务代码照常写
- **⭐ 监听 `127.0.0.1` 不是 `0.0.0.0`** —— 见 8.1 部署方案，前端由 Nginx 直接服务静态文件，`/api/*` 反向代理过来。绑 `0.0.0.0` 等于把 3000 端口裸奔在公网且绕过 Basic Auth
- 用了 `setGlobalPrefix('api')`，controller 里就写 `@Controller('events')` 而不是 `@Controller('api/events')`

**不做离线优先框架**（如 Dexie 全家桶）。阶段一只需要一个简单的草稿队列，用原生 IndexedDB + 一个小封装即可。

---

## 1.1 ⚠️ 双端使用场景（决定布局，别搞反了）

| 场景              | 设备     | 频率     | 核心诉求             |
| --------------- | ------ | ------ | ---------------- |
| **查看、浏览、补录、整理** | **电脑** | **主要** | 信息密度高、一屏看多点、键盘操作 |
| **快速记录**（崩溃当下）  | 手机     | 偶尔     | 10 秒完成、单手操作、断网可用 |

**这跟最早定的原则一致：录入（手机、混乱时刻）与消费（电脑、安静时刻）必须分层。**

### 布局策略

**电脑端（≥ 1024 px）—— 主要形态：**

```
┌──────────────┬────────────────────────────────┐
│  侧边栏       │  主内容区                        │
│              │                                │
│  ⚡ 快速记录  │   2026-09-01  周二 · 2岁3个月    │
│  💬 渺言妙语  │   ┌──────────────────────────┐ │
│  📅 时间线    │   │ 05:50  睡眠              │ │
│  📷 相册      │   │ 早醒要喝奶               │ │
│  🌱 技能      │   └──────────────────────────┘ │
│  📊 分析      │   ┌──────────────────────────┐ │
│  🤖 AI 咨询   │   │ 10:00  崩溃  ●●●○○        │ │
│              │   │ 商场要买糖被拒 · 15分钟   │ │
│              │   └──────────────────────────┘ │
└──────────────┴────────────────────────────────┘
```

> **进度（2026-09-01）**：阶段二分析 `/analysis`（自绘条形图 +「生成解读」）；阶段三相册 / 技能 / AI 咨询均已上线。  
> 统计仍 **n&lt;5 不下结论**；AI 判断不写回 events/quotes。

- 侧边栏常驻导航，「快速记录」放最上面（随时可用）
- 内容区宽度上限约 900 px，超过则居中（别让文字拉太长）
- 录入用**抽屉（Drawer）**&#x4ECE;右侧滑出，不跳页，保持上下文

**手机端（< 768 px）—— 录入为主：**

```
┌────────────────────┐
│  ┌──────────────┐  │
│  │  ⚡ 快速记录  │  │  ← 首屏第一眼就是它，大按钮
│  └──────────────┘  │
│  ┌──────────────┐  │
│  │  💬 渺言妙语  │  │  ← 同样是主按钮（她说了话要马上记）
│  └──────────────┘  │
│                    │
│  最近记录           │
│  ├ 05:50 睡眠       │
│  └ 昨天 崩溃 ×2     │
└────────────────────┘
```

- 侧边栏收起，用底部 TabBar 或顶部 Tab（记录 / 语录 / 时间线）
- **首屏两个大按钮**：快速记录 + 渺言妙语。这两个都是"当下就要记"的场景，不能藏在二级菜单里
- 录入页全屏，场景卡片**单列大按钮**，拇指够得着
- 时间线单列滚动，信息精简

### 对组件库的影响

- **Element Plus 在手机上偏重**，但只在录入页暴露，影响可控
- **录入页的关键交互（场景卡片、chips）建议自己写**，不依赖组件库——这两块要极致简化，用组件库的按钮/标签反而臃肿
- 其余页面（时间线、详情页、将来的分析）直接用 Element Plus

### PWA 的定位

**PWA 只为手机录入服务**，不是整个应用的主要形态。

- 电脑端就是普通网页，不需要添加到桌面
- 手机端添加到主屏幕，点开直达录入页（`start_url: '/record'`）

---

## 1.2 ⭐ 视觉风格：可爱化（2026-08-31 用户强调）

> **用户原话：「因为是个 baby 成长记录，所以 UI 需要生动可爱，可以带点卡通风格，不要太死板了。」**

### ⚠️ 为什么要专门写这一节

**Element Plus 的默认风格是后台管理系统**——方角 4px、灰色描边、`#409EFF` 商务蓝、间距紧凑。专业、克制，但**用在 baby 成长记录上不对味，像在填工单**。

这不是换套配色就完事的，需要从圆角、配色、描边、动效四个维度系统改造。

### 四条改造原则（柔和糖果风）

| 维度     | Element Plus 默认  | **改成**                                        |
| ------ | ---------------- | --------------------------------------------- |
| **圆角** | 4px（几乎直角）        | **卡片 14px / 按钮胶囊 999px / chips 胶囊 999px**      |
| **配色** | `#409EFF` 商务蓝    | **四色撞色，但降饱和 15–25%**（见下方 Token）                 |
| **描边** | 1px `#DCDFE6` 灰线 | **2.5px 暖深褐 `#6B5A4E` 粗描边**——糖果风的灵魂          |
| **动效** | 基本没有             | **弹性夸张**：hover 弹起、点击回弹、卡片依次蹦入                 |

**⭐ 核心判断：糖果风的灵魂是「撞色 + 粗描边 + 硬阴影 + 弹性动效」，这四个不能动。**

> **本版是「降饱和优化版」。** 妈妈选了糖果波普，但原版高饱和 + 纯黑描边看久了刺眼。这一版**保留了全部活泼感，只把刺眼的部分降下来**：
>
> | 改了 | 原版 | 优化版 |
> |---|---|---|
> | 描边 | 纯黑 `#2D2D2D` 3px | **暖深褐 `#6B5A4E` 2.5px** |
> | 底色 | 亮黄 `#FFFDE7` | **奶油 `#FFFBF0`** |
> | 饱和度 | 高饱和 | **降 15–25%**，撞色关系保留 |
> | 硬阴影 | 3px 纯黑 | **2.5px 浅褐 `#E0CDB8`** |
>
> **没动的**：撞色搭配、粗描边、大圆角、胶囊 chips、弹性动效。

### 设计 Token（直接写进 `src/styles/tokens.css`）

```css
:root {
  /* 奶油底色 —— 比亮黄柔和，长时间看不累 */
  --c-cream:    #fffbf0;   /* 页面底 */
  --c-cream-2:  #fffdf8;   /* 卡片底 */
  --c-cream-3:  #f5ead6;   /* 次级面 / 分隔区 */

  /* 四色撞色 —— 已降饱和，活泼但不刺眼 */
  --c-coral:    #e8736b;   /* 珊瑚红：主色（按钮/强调）原 #FF6B6B */
  --c-honey:    #f5c45e;   /* 蜜糖黄：点缀          原 #FFD93D */
  --c-mint:     #7fc8a9;   /* 薄荷绿：辅助          原 #6BCB77 */
  --c-sky:      #6ba3d6;   /* 天空蓝：辅助          原 #4D96FF */
  --c-grape:    #a98bc4;   /* 葡萄紫：语录类 */

  /* 墨色 —— 暖深褐，不是纯黑 */
  --c-ink:      #4a3f38;   /* 主文字 */
  --c-ink-2:    #96867a;   /* 次要文字 */
  --c-ink-3:    #b8a99c;   /* 弱化文字 */

  /* 圆角 —— 糖果风偏大，但不失形 */
  --r-sm:   10px;
  --r-md:   12px;
  --r-lg:   14px;    /* 卡片 */
  --r-pill: 999px;   /* 按钮、chips */

  /* ⭐ 描边 —— 糖果风的核心，别省 */
  --stroke-w:      2.5px;
  --stroke:        2.5px solid #6b5a4e;
  --stroke-light:  2px   solid #6b5a4e;

  /* 硬阴影 —— 像剪纸贴上去的，但用浅褐不用纯黑 */
  --shadow-sticker: 2.5px 2.5px 0 #e0cdb8;
  --shadow-pop:     4px 4px 0 #e0cdb8;   /* hover 时 */

  /* 动效 —— 弹性比别的形式更夸张 */
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-soft:   cubic-bezier(0.25, 0.8, 0.25, 1);
  --dur: 0.22s;
}
```

### Element Plus 变量覆写（关键，别漏）

Element Plus 用 CSS 变量，覆写即可全局生效：

```css
/* src/styles/element-override.css */
:root {
  --el-color-primary:            #e8736b;
  --el-color-primary-light-3:    #ef948d;
  --el-color-primary-light-5:    #f4b4af;
  --el-color-primary-light-8:    #fadbd8;
  --el-color-primary-dark-2:     #cc554d;

  --el-border-radius-base:       12px;
  --el-border-radius-small:      10px;
  --el-border-radius-round:      999px;

  --el-text-color-primary:       #4a3f38;
  --el-text-color-regular:       #6f6058;
  --el-text-color-secondary:     #96867a;
  --el-text-color-placeholder:   #b8a99c;

  --el-border-color:             #6b5a4e;   /* ⭐ 描边是暖深褐，不是浅灰 */
  --el-border-color-light:       #96867a;
  --el-fill-color-blank:         #fffdf8;   /* 奶油卡片底 */
  --el-fill-color-light:         #f5ead6;

  --el-font-size-base:          14px;
}
```

### 事件类型配色（时间线用）

| 类型 | 主色（描边/图标） | 浅底（卡片背景） | 图标 |
| --- | --- | --- | -- |
| `meltdown` 崩溃 | `#E8736B` 珊瑚红 | `#FADBD8` | 🍭 |
| `skill` 技能 | `#7FC8A9` 薄荷绿 | `#D6EFE3` | 🌱 |
| `daily` 日常 | `#C4A574` 暖褐 | `#F3EADC` | 📒 |
| `emotion` 情绪 | `#E8A87C` 杏橙 | `#F8E6D8` | 🫧 |
| `sleep` 睡眠 | `#6BA3D6` 天空蓝 | `#DCEAF5` | 🌙（场景卡录入用 😴） |
| `diet` 饮食 | `#D4896A` 陶土 | `#F5E0D6` | 🥣 |
| `social` 社交 | `#7EB8B2` 青绿 | `#DCEEED` | 👋 |
| `medical` 医疗 | `#6B8FD6` 雾蓝 | `#DDE6F5` | 💊 |
| `quote` 语录 | `#A98BC4` 葡萄紫 | `#EDE5F3` | 💬 |

> **Legacy（仅兼容旧数据展示，不可新建）**：`health`（健康）、`question`（想问）。  
> **用 emoji 而不是 Element Plus 的线性图标。** Element Plus 图标是细描边线性风格，偏商务；emoji 饱满有笔触感，跟糖果风一致，且零成本。

### 组件级要求

| 组件        | 要求                                                                            |
| --------- | ----------------------------------------------------------------------------- |
| **卡片**    | 奶油底 `--c-cream-2` + **2.5px 暖深褐描边** + 14px 圆角 + 硬阴影 `--shadow-sticker`        |
| **场景卡片**  | 14px 圆角 + 2.5px 描边 + emoji 放大到 32px + hover 弹起并加大硬阴影。自己写，不用 el-card         |
| **Chips** | 胶囊 999px + **2px 描边** + 水彩底。选中态加深并加硬阴影                                        |
| **按钮**    | 胶囊 999px + **2.5px 描边**。主按钮珊瑚红底白字 + 硬阴影，次按钮奶油底深褐字                            |
| **输入框**   | 12px 圆角 + 2.5px 描边 + 奶油底，聚焦时描边加粗到 3px                                        |
| **空状态**   | 大 emoji + 一句活泼的话，别只写「暂无数据」                                                    |
| **抽屉/弹窗** | 16px 圆角 + 3px 描边                                                              |

### 微动效（弹性要比别的形式更夸张）

```css
.card {
  border: var(--stroke);
  border-radius: var(--r-lg);
  background: var(--c-cream-2);
  box-shadow: var(--shadow-sticker);
  transition: transform var(--dur) var(--ease-bounce),
              box-shadow var(--dur) var(--ease-bounce);
}

/* 卡片 hover —— 斜向弹起，硬阴影加大 */
.card:hover {
  transform: translate(-2px, -3px);
  box-shadow: var(--shadow-pop);
}

/* 按钮点击 —— 回弹 */
.btn:active { transform: scale(0.96); }

/* 卡片入场 —— 依次蹦入（弹性曲线） */
@keyframes cardIn {
  from { opacity: 0; transform: translateY(10px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.card { animation: cardIn 0.34s var(--ease-bounce) both; }

/* 场景卡片选中 —— 弹性放大（幅度可以大一点） */
.scene-card.is-active {
  transform: scale(1.06) rotate(-1deg);
  box-shadow: var(--shadow-pop);
  transition: transform 0.28s var(--ease-bounce);
}
```

### ⚠️ 四个坑（糖果风专属）

1. **描边必须是暖深褐 `#6B5A4E`，不能用纯黑。** 纯黑 + 粗线 = 廉价卡通感，且刺眼
2. **饱和度已经调过了，别再往上加。** 四个主色的 HSL 饱和度都在 55–70% 之间，超过就回到原版的刺眼问题
3. **描边不是所有元素都加。** 卡片、chips、按钮加；正文、分隔线、表格线不加。全加显乱
4. **别堆卡通素材。** 糖果风靠色彩和形状，不是塞满插画贴纸

**另外两条通用约束**：电脑端信息密度不能降（主要使用场景），录入效率不能牺牲（10 秒一条是硬指标，动效 0.2–0.35s）。

---

## 2. 项目初始化

**项目位置建议**：放在用户代码目录下，例如 `D:\Code\ccode\mia-center\`（用户其他项目在 `D:\Code\ccode\` 下）。

```bash
# ===== 前端 =====
npm create vite@latest mia-web -- --template vue-ts
cd mia-web
npm i pinia element-plus @element-plus/icons-vue
npm i -D unplugin-vue-components unplugin-auto-import
npm i -D vite-plugin-pwa

# ===== 后端：NestJS + FastifyAdapter（见 1.0 节，别装成纯 Fastify）=====
cd .. && mkdir server && cd server
npm init -y
npm i @nestjs/core @nestjs/common @nestjs/platform-fastify reflect-metadata rxjs
npm i better-sqlite3
npm i -D @nestjs/cli typescript @types/node @types/better-sqlite3
```

> ⚠️ **后端是 NestJS，不是裸 Fastify。** 装 `@nestjs/platform-fastify` 让 NestJS 跑在 Fastify 之上，
> 既保留 NestJS 的模块化/DI/装饰器，又拿 Fastify 的内存优势。裸 Fastify 写法（路由函数）不要用。

### 目录结构

```
mia-center/                     # 仓库根
├── mia-web/                    # 前端
│   └── src/
│       ├── main.ts
│       ├── App.vue
│       ├── router/
│       ├── stores/
│       │   ├── events.ts       # 事件列表 + 提交状态
│       │   ├── quotes.ts       # 语录
│       │   └── draft.ts        # 离线草稿队列（IndexedDB）
│       ├── api/
│       │   └── client.ts       # fetch 封装，统一错误处理
│       ├── types/
│       │   └── event.ts        # 前后端共用类型
│       ├── views/
│       │   ├── Record.vue      # 录入页（首页）
│       │   ├── Timeline.vue    # 时间线
│       │   ├── Quotes.vue      # 渺言妙语
│       │   ├── Analysis.vue    # 崩溃分析
│       │   ├── Album.vue       # 相册
│       │   ├── Skills.vue      # 技能地图
│       │   └── Consult.vue     # AI 咨询
│       ├── config/
│       │   ├── scenes.ts       # 场景卡 v3（mia-scenes-v3）
│       │   └── chips.ts
│       ├── components/
│       │   ├── SceneCards.vue  # 场景快捷卡片
│       │   ├── ChipGroup.vue   # 短语 chips
│       │   ├── TypeChip.vue    # 类型胶囊（自己写，不用 el-tag）
│       │   ├── EventItem.vue   # 时间线条目
│       │   └── BlanketSprite/  # 毯子精灵（T17）
│       │       ├── BlanketSprite.vue
│       │       ├── SpriteImage.vue
│       │       └── QuoteBubble.vue
│       ├── composables/
│       │   └── useSpriteState.ts
│       ├── styles/
│       │   ├── tokens.css      # 设计变量（1.2 节）
│       │   └── element-override.css
│       ├── assets/sprite/      # 精灵素材（_source.png + 切出的 4 张）
│       └── utils/
│           ├── idb.ts          # IndexedDB 小封装
│           ├── typeChip.ts     # 类型配色
│           └── date.ts         # 月龄计算等
├── server/                     # 后端 NestJS
│   └── src/
│       ├── main.ts             # NestFactory + FastifyAdapter
│       ├── app.module.ts
│       ├── db/
│       │   ├── schema.sql
│       │   └── db.service.ts
│       ├── events/
│       ├── quotes/
│       ├── analytics/
│       ├── photos/
│       ├── skills/
│       ├── ai/                 # 含 ai-chat.store
│       └── auth/
├── server/data/mia.db
└── deploy/
```

---

## 3. 数据库 Schema

权威源：`server/src/db/schema.sql`（启动时 `CREATE TABLE IF NOT EXISTS`）。

```sql
CREATE TABLE events (
  id            TEXT PRIMARY KEY,      -- uuid，客户端生成（离线也要能建）
  happened_at   TEXT NOT NULL,         -- ISO 字符串，事件发生时间
  type          TEXT NOT NULL,         -- meltdown | skill | daily | emotion | sleep | diet | social | medical
                                       -- 历史兼容：health | question（不可新建）；语录见 quotes 表
  summary       TEXT,                  -- 一句话（chips 选的或手输）
  chips         TEXT,                  -- JSON 数组，存原始 chip 值
  location      TEXT,                  -- home | outdoor | mall | grandparents | taoshudi | tongtong | school | other
  trigger       TEXT,                  -- refused | interrupted | order | dressed | food | share | bedtime | unknown
  intensity     INTEGER,               -- 1–5，仅崩溃类
  duration_min  INTEGER,               -- 崩溃时长（分钟），可空
  coping        TEXT,                  -- JSON 数组，应对方式
  outcome       TEXT,                  -- 结果（自由文本，可后补）
  caregiver     TEXT,                  -- 记录人：mom | dad | grandma | grandpa（录入仅 mom/dad；爷奶只读兼容）
  napped        INTEGER,               -- 当日是否午睡：0 | 1 | NULL（Mia 特有，验证睡眠假设）
  month_age     INTEGER,               -- 冗余字段，便于按月龄查询
  created_at    TEXT NOT NULL,
  updated_at    TEXT
);

CREATE INDEX idx_events_time ON events(happened_at DESC);
CREATE INDEX idx_events_type ON events(type);
```

**设计说明：**

- **`id` 由客户端生成**（`createId()`，兼容 HTTP 非 localhost；优先 `crypto.randomUUID`）—— 离线状态下也要能建记录，不能依赖数据库自增
- **`napped` 是 Mia 专用字段**。档案显示她午睡不规律，这个字段用来对比"睡了 vs 没睡"两天的情绪差异
- **`month_age` 冗余但值得**。Mia 出生日期 2024-05-17，写入时算好，查询时省事
- **崩溃详情字段（intensity/duration/coping/outcome）全部可空**，支持"先提交，后补详情"
- **`type` 里没有 `quote`** —— 语录（渺言妙语）单独建 `quotes` 表，**见 4.6.2 节，别漏掉**

### 3.1 其它表（阶段二/三）

```sql
-- quotes：见 4.6.2

CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  taken_at TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  original_name TEXT,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  month_age INTEGER,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  label TEXT NOT NULL,
  emoji TEXT,
  typical_from INTEGER,
  typical_to INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_custom INTEGER NOT NULL DEFAULT 0,
  created_at TEXT
);

CREATE TABLE skill_marks (
  skill_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,           -- emerging | done（无行 = todo 未观察）
  marked_at TEXT NOT NULL,
  note TEXT,
  updated_at TEXT,
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);

CREATE TABLE ai_chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  messages TEXT NOT NULL,          -- JSON：[{ role, content }, ...]
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

> 当前库表：`events` + `quotes` + `photos` + `skills` + `skill_marks` + `ai_chats`。

**初始化方式（T2 做这个）：**

不用迁移工具。把建表 SQL 放在 `server/src/db/schema.sql`，服务启动时用 better-sqlite3 执行
`CREATE TABLE IF NOT EXISTS`，跑完即建好，数据库文件不存在会自动创建。

```typescript
// server/src/db/db.service.ts
import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

@Injectable()
export class DbService {
  readonly db: Database.Database

  constructor() {
    // 确保 data 目录存在
    const dir = join(process.cwd(), 'data')
    mkdirSync(dir, { recursive: true })

    this.db = new Database(join(dir, 'mia.db'))
    this.db.pragma('journal_mode = WAL')           // 并发读写更稳
    this.db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf-8'))
  }
}
```

> `journal_mode = WAL` 建议开：读写并发时不容易锁死，备份时也方便。

---

## 4. 录入页设计（核心，决定系统生死）

### 4.1 页面流程

```
打开 → 8 张场景卡片（崩溃一张总卡 + 各类型入口，不是空表单！）
     ↓ 点一张卡片
     → 默认只预填 type（细节靠 chips；自定义卡可预填更多）
     → 选一句话 chips + 确认记录人（爸/妈）
     ↓ 点「保存」
     → 立即返回首页，显示"已记录"
     → 详情页可稍后补（不阻塞）
```

**目标：3–4 次点击，10–15 秒。**

### 4.2 场景卡片定义

```ts
// mia-web/src/config/scenes.ts
export interface Scene {
  id: string
  label: string
  icon: string          // emoji 字符串（不用 Element Plus 图标名）
  preset: { type: EventType; location?: LocationType; trigger?: TriggerType; caregiver?: CaregiverType }
  order: number
  count: number         // 使用次数，本地持久化后参与排序
  custom?: boolean
}

/** 本地持久化键：mia-scenes-v3（崩溃收成单卡） */
export const DEFAULT_SCENES: Scene[] = [
  { id: 'meltdown',  label: '崩溃',     icon: '🍭', preset: { type: 'meltdown' }, order: 1, count: 0 },
  { id: 'new-skill', label: '新技能',   icon: '🌱', preset: { type: 'skill' },    order: 2, count: 0 },
  { id: 'daily',     label: '日常点滴', icon: '📒', preset: { type: 'daily' },    order: 3, count: 0 },
  { id: 'emotion',   label: '情绪观察', icon: '🫧', preset: { type: 'emotion' },  order: 4, count: 0 },
  { id: 'sleep',     label: '睡眠',     icon: '😴', preset: { type: 'sleep' },    order: 5, count: 0 },
  { id: 'diet',      label: '饮食',     icon: '🥣', preset: { type: 'diet' },     order: 6, count: 0 },
  { id: 'social',    label: '社交分离', icon: '👋', preset: { type: 'social' },   order: 7, count: 0 },
  { id: 'medical',   label: '医疗',     icon: '💊', preset: { type: 'medical' },  order: 8, count: 0 },
]
```

> ⚠️ **卡片必须可增删、可改预填内容、可拖拽排序。** 8 张是类型入口，细节靠 chips，是起点不是定论。  
> 排序：有用户拖拽顺序则优先；否则按使用 `count` 降序。  
> 自定义场景可调 `POST /api/ai/scene-suggest` 预览 emoji（不写库）。

**语录不进场景卡** —— 走独立渺言妙语模块（4.6 节）。  
`trigger` 已含 `bedtime`（睡前）。

### 4.3 Chips 定义（按类型切换）

```ts
// mia-web/src/config/chips.ts
export const CHIPS_BY_TYPE: Record<EventType, string[]> = {
  meltdown: [
    '要买糖/玩具被拒', '不想走，还想玩', '该回家了还不走',
    '没按她的顺序来', '不肯穿这件衣服', '不肯吃饭',
    '不想洗澡/洗手', '不给看手机/iPad', '毯子/安抚物找不到',
    '要妈妈不要别人', '和小朋友抢玩具', '突然换计划',
    '要抱抱', '累了还不自知', '不明原因',
  ],
  skill:   ['自己完成了一件事', '说了新词/新句子', '解锁新动作'],
  daily:   ['今天发生的一件小事', '自己做了…', '出门玩了', '和家人在一起'],
  emotion: ['特别开心', '有点害羞', '很黏人', '突然不高兴', '情绪来得很快'],
  sleep:   ['早醒', '入睡困难', '夜醒', '午睡不好', '睡前折腾'],
  diet:    ['吃得好', '挑食/拒食', '要喝奶', '肚子不舒服', '零食相关'],
  social:  ['见人热情/认生', '分离焦虑', '和小朋友互动', '上幼儿园相关'],
  medical: ['发烧/看病', '疫苗', '吃药', '过敏/皮疹', '体检'],
}

// ⚠️ 没有 quote —— 语录走独立的渺言妙语模块（见 4.6），不用 chips 概括

export const COPING_CHIPS = [
  '抱抱/安抚物', '提前预告', '给两个选项',
  '转移注意力', '冷处理等着', '讲道理', '没管用',
]

export const LOCATION_CHIPS = [
  { value: 'home', label: '家里' },
  { value: 'outdoor', label: '户外' },
  { value: 'mall', label: '商场' },
  { value: 'grandparents', label: '爷奶家' },
  { value: 'taoshudi', label: '桃树地' },
  { value: 'tongtong', label: '彤彤姐家' },
  { value: 'school', label: '学校' },
  { value: 'other', label: '其他' },
]

export const CAREGIVER_CHIPS = [
  { value: 'mom', label: '妈妈' },
  { value: 'dad', label: '爸爸' },
  // grandma / grandpa 仅兼容旧数据展示，录入不提供
]
```

**Chips 的价值不只是省打字**：它让记录天然结构化。「要买糖被拒」和「要买玩具被拒」归到同一 chip，分析时直接统计，不用事后做文本归类。

### 4.4 字段规格

| 字段                                      | 是否必填 | 默认值         | 交互                             |
| --------------------------------------- | ---- | ----------- | ------------------------------ |
| `happened_at`                           | ✅    | 当前时间        | 可改，但默认不让用户操心                   |
| `type`                                  | ✅    | 卡片预填        | 隐藏                             |
| `location`                              | —    | 卡片预填，否则记住上次 | chip 单选                        |
| `trigger`                               | —    | 卡片预填        | chip 单选                        |
| `summary`                               | ✅    | —           | **chips 为主，允许手输**（输入框在下方，不抢焦点） |
| `caregiver`                             | ✅    | **记住上次（仅爸妈）** | chip 单选                        |
| `napped`                                | —    | 空           | 是/否/不清楚                        |
| intensity / duration / coping / outcome | —    | 空           | **折叠在「补充详情」里，默认收起**            |

**两条关键的默认值设计：**

1. **记录人记住上次** —— 仅 `mom` / `dad`；旧 prefs 若是爷奶则回退为妈妈
2. **崩溃详情延后补** —— 孩子在哭的时候不可能填 8 个字段。先存主记录，详情回头补

### 4.5 离线队列（不能省）

```ts
// src/utils/idb.ts — 用原生 IndexedDB，别引框架
// store: 'drafts'，每条存完整的 EventDraft

// 提交逻辑（src/stores/events.ts）
async function submit(draft: EventDraft) {
  try {
    await api.post('/api/events', draft)
  } catch {
    await idb.put('drafts', draft)   // 存本地
    // UI 显示"已存本地，联网后自动同步"
  }
}

// App 启动时 + 网络恢复时重放
async function flushDrafts() {
  const drafts = await idb.getAll('drafts')
  for (const d of drafts) {
    try {
      await api.post('/api/events', d)
      await idb.delete('drafts', d.id)
    } catch { break }   // 失败就停，下次再试
  }
}
```

> 这是自建相对飞书的最大劣势（飞书表单没网也能填），必须补上。**阶段一就要设计进去，后面补很别扭。**

---

## 4.6 渺言妙语（语录模块）

> 名字取自 Mia 本名「朱云渺」+「妙语」谐音。  
> **这是整个系统情感价值最高的模块**，建议进阶段一。

### 4.6.1 四条设计原则

**① 原话逐字记录，一个字都不要加工**

```
❌ "她对声音很好奇"          ← 你的解读，不是她的话
✅ "爸爸，这个声音是什么？"   ← 这才叫渺言妙语
```

这是档案原则（只记可观测事实）的延伸。加工过的就毁了——三年后回看，你想看到的是她当时的措辞。

**② 原话和你的解读分开存**

`content` 是她说的，`note` 是你的感受。展示时视觉上要区分（原话大字号深色，解读小字灰色）。

**③ 月龄必须显示**

同样一句「妈妈生气了」，2 岁 3 个月说和 4 岁说，含义天差地别。**没有月龄，语录就失去了坐标。**

**④ 宁可多记，不要筛选**

录入成本要低到不需要犹豫。现在觉得普通的，一年后可能最珍贵。

### 4.6.2 数据模型

```sql
CREATE TABLE quotes (
  id          TEXT PRIMARY KEY,
  content     TEXT NOT NULL,      -- ⭐ 原话，逐字，不加工
  context     TEXT,               -- 上下文：在哪 / 在干嘛 / 看到什么
  note        TEXT,               -- 我的解读：为什么觉得特别（选填）
  said_at     TEXT NOT NULL,      -- 说这话的时间
  month_age   INTEGER NOT NULL,   -- ⭐ 月龄，分组与展示的核心
  photo_id    TEXT,               -- 关联照片（阶段三，EXIF ±30 分钟匹配）
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);

CREATE INDEX idx_quotes_month ON quotes(month_age DESC, said_at DESC);
```

**为什么单独建表，而不是复用 events 的 quote 类型：**

- `content`（原话长文本）和 `summary`（一句话短语）语义不同
- 需要 `context` / `note` 两个专属字段
- 分组逻辑（按月龄）和展示逻辑完全不一样
- **events 表里删掉 `quote` 类型**，避免两个地方都能记语录、最后不知道记哪

### 4.6.3 录入设计（越简单越好）

场景：她说了句好玩的话，你掏手机，趁还记得赶紧记下来。

```
┌──────────────────────────────────┐
│  渺言妙语                         │
│                                  │
│  ┌────────────────────────────┐  │
│  │ 她说：                      │  │  ← 光标已在这里，键盘已弹出
│  │                            │  │     （textarea，autoFocus）
│  │                            │  │
│  └────────────────────────────┘  │
│                                  │
│  ▸ 上下文和我的解读（选填）        │  ← 默认折叠
│                                  │
│           [ 保存 ⌘↵ ]            │
└──────────────────────────────────┘
```

**关键实现点：**

| 点            | 做法                                                    |
| ------------ | ----------------------------------------------------- |
| **不要场景卡片**   | 那套是为崩溃场景设计的（慌乱中快速定位字段）。语录不需要——你很清楚要记什么                |
| **光标自动聚焦**   | `onMounted` 里 `textarea.focus()`，移动端要配合用户手势触发（iOS 限制） |
| **保存后回到录入态** | 清空输入框、保持聚焦、显示轻提示「已记下」。她说的话经常是连着的                      |
| **上下文折叠**    | `context` / `note` 默认不展开，想补再点开。不阻塞主流程                 |
| **离线同样可用**   | 复用 4.5 的草稿队列                                          |

### 4.6.4 展示设计

#### 语录墙（主视图）—— 按月龄分组

```
┌────────────────────────────────────────┐
│  2 岁 3 个月 · 3 条                     │
│  ┌──────────────────────────────────┐  │
│  │「爸爸，这个声音是什么？」          │  │
│  │  08-24 · 客厅听到警报器            │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │「弟弟哭了，他难过」                │  │
│  │  08-20 · 看到邻居小孩哭            │  │
│  └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│  2 岁 2 个月 · 5 条                     │
│  ...                                   │
└────────────────────────────────────────┘
```

> ⭐ **按月龄排，不按日期排——这是本模块最重要的设计。**  
> 按日期只是流水账；按月龄是**一部认知发展史**。你能清楚看到跃迁：  
> 2 岁 1 个月只会说「不要」→ 2 岁 3 个月追问「这个声音是什么」→ 2 岁 6 个月说「妈妈生气了，因为我把水洒了」。  
> 这种对比，按月龄一目了然，按日期看不出来。

#### 卡片样式

- 原话用**大字号 + 深色 + 中文引号「」**（不用英文引号，中文排版更好看）
- 有 `note` 的，在下面用小字灰色显示，前面加「我的感受：」
- 有 `photo_id` 的（阶段三），卡片顶部配图
- 右下角显示日期（小字）

#### 首页「今日一条」（≥20 条后显示）

每天打开快速记录页展示一条历史语录（东八区按日稳定选取，同一天内不变）。不足 20 条时不显示。

**接口：** `GET /api/quotes?daily=1` → `QuoteRecord | null`

#### 搜索

语录墙顶栏模糊搜索原话 / 上下文 / 感受：`GET /api/quotes?q=关键词` → 扁平列表。

#### 编辑

`PATCH /api/quotes/:id` 可改 `context` / `note` / `saidAt`（原话 `content` 前端只读展示）。语录墙与时间线抽屉均有「编辑 / 补详情」入口。

### 4.6.5 跟其他模块的关系

| 关系           | 说明                                   |
| ------------ | ------------------------------------ |
| **时间线**      | 语录也出现在总时间线里（`type` 显示为「语录」），点进去跳语录详情 |
| **相册（阶段三）**  | 按 `said_at` ±30 分钟匹配照片，自动配图          |
| **将来：导出成册**  | 数据模型已支持，将来能做「渺言妙语」纪念册 PDF            |
| **AI 咨询** | 可结合语录事实回答；判断不写回 quotes                     |

> **标签 / 导出成册** 仍后置；搜索、编辑、今日一句已落地。

---

## 5. 时间线（电脑端为主战场）

既然主要在电脑上看，时间线要**信息密度优先**，别按手机那套精简流来做。

### 5.1 电脑端布局

```
┌────────────┬─────────────────────────────────────┐
│ 月份导航    │  2026-09-01  周二 · 2 岁 3 个月        │
│            │  ┌───────────────────────────────┐  │
│ 2026-09 ▾  │  │ ● 睡眠   05:50                 │  │
│  09-01     │  │   早醒要喝奶                     │  │
│  08-31 (3) │  │   记录人：妈妈 · 午睡：—          │  │
│  08-30 (1) │  └───────────────────────────────┘  │
│  08-29 (2) │  ┌───────────────────────────────┐  │
│            │  │ ● 崩溃   10:00  ●●●○○  15min   │  │
│ 2026-08 ▸  │  │   商场要买糖被拒                │  │
│            │  │   触发：要求被拒 · 应对：抱抱    │  │
│            │  └───────────────────────────────┘  │
└────────────┴─────────────────────────────────────┘
```

- **左侧月份导航**：按月折叠，每天显示条目数。方便快速跳到某一天
- **右侧事件流**：按天分组，每条显示类型、时间、摘要 + 关键字段（记录人、午睡、触发、应对）
- **详情用右侧抽屉**，不跳页——保持时间线上下文，看完关掉继续浏览；条目可删除

### 5.2 交互要点

| 要点  | 做法                                   |
| --- | ------------------------------------ |
| 分页  | 每次加载 50 条，滚动到底自动加载（先不做虚拟滚动，几千条内没必要）  |
| 筛选  | 顶部按类型：全部 / 崩溃 / 语录 / 技能 / 日常 / 情绪 / 睡眠 / 饮食 / 社交 / 医疗 |
| 补录  | 顶部「补录」或快捷键 `B`，默认时间可改（补昨天的事是高频场景）          |
| 编辑  | 点条目 → 右侧抽屉，可改可删可补详情                  |
| 空状态 | 没记录时引导去录入，别显示一片空白                    |

### 5.2.1 键盘快捷键（电脑端）

| 键 | 作用 |
| --- | --- |
| `N` | 快速记录 |
| `B` | 补录（时间默认可改） |
| `Q` | 记语录 |
| `T` | 时间线 |
| `A` | 分析 |
| `P` | 相册 |
| `S` | 技能 |
| `I` | AI 咨询 |
| `Esc` | 关闭帮助等 |
| `Ctrl/Cmd + Enter` | 保存当前编辑（录入/咨询发送等） |
| `?` | 显示快捷键帮助面板 |

**实现要点：**

- 用 `useHotkeys` composable 统一注册
- **输入框聚焦时不触发单键快捷键**；带 Ctrl/Meta/Alt 时不抢系统快捷键
- `?` 的帮助面板用对话框，别做成独立页面

> `Q` 键值得单独给——她说完一句话的瞬间，从掏手机到记下来只有十几秒窗口。

### 5.3 手机端降级

- 左侧月份导航收起，改成顶部的月份下拉
- 每条事件只显示：类型 + 时间 + 摘要（隐藏记录人/午睡等次要字段）
- 详情改成全屏页（手机没有抽屉的空间）

### 5.4 类型配色

> ⚠️ **配色见 1.2 节，与 `mia-web/src/utils/typeChip.ts` 一致。**

| 类型 | 主色 | 浅底 | 图标 |
| --- | --- | --- | -- |
| `meltdown` 崩溃 | `#E8736B` | `#FADBD8` | 🍭 |
| `skill` 技能 | `#7FC8A9` | `#D6EFE3` | 🌱 |
| `daily` 日常 | `#C4A574` | `#F3EADC` | 📒 |
| `emotion` 情绪 | `#E8A87C` | `#F8E6D8` | 🫧 |
| `sleep` 睡眠 | `#6BA3D6` | `#DCEAF5` | 🌙 |
| `diet` 饮食 | `#D4896A` | `#F5E0D6` | 🥣 |
| `social` 社交 | `#7EB8B2` | `#DCEEED` | 👋 |
| `medical` 医疗 | `#6B8FD6` | `#DDE6F5` | 💊 |
| **quote 语录** | `#A98BC4` | `#EDE5F3` | 💬 |
| Legacy `health` / `question` | 仅展示兼容 | | 🌙 / ❓ |

**不要用 `<el-tag type="danger">` 这类默认标签**——方角 + 无描边，跟糖果风冲突。自己写一个 `<TypeChip>`：

```vue
<span class="type-chip" :style="{ background: bg, color: fg }">
  {{ icon }} {{ label }}
</span>
```

```css
.type-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 999px;                 /* 胶囊 */
  border: 2px solid var(--c-ink);       /* ⭐ 糖果风的描边，别省 */
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}
```

> **语录是独立表**，但要在时间线里跟 events 合并显示（按时间混排）。  
> 实现：后端提供一个合并接口，或在前端把两个列表按时间归并。阶段一量小，前端归并就行。
>
> 崩溃强度用 5 个小圆点表示（●●●○○），比数字更直观。

---

## 6. API 设计

```
POST   /api/events            创建（幂等：id 相同则忽略）
GET    /api/events?limit=50&before=<iso>   时间线分页
GET    /api/events/:id
PATCH  /api/events/:id        补充详情
DELETE /api/events/:id

# 语录（渺言妙语）
POST   /api/quotes            创建
GET    /api/quotes            列表（按月龄分组）
GET    /api/quotes?random=1   随机一条（毯子精灵气泡）
GET    /api/quotes?daily=1    今日一句（≥20 条，按东八区日稳定选取）
GET    /api/quotes?q=关键词   搜索（原话/上下文/感受）
GET    /api/quotes/:id
PATCH  /api/quotes/:id        context / note / saidAt
DELETE /api/quotes/:id

GET    /api/health

# 分析（阶段二）
GET    /api/analytics/meltdown?days=60
# 响应字段含：days, sampleSize, canConclude, intensity/duration 统计,
# byWeek, byChip, byTrigger, byLocation, byCoping, byNapped, byHour
# （有意不含 byCaregiver / byWeekday）

# 相册（阶段三）
POST   /api/photos            multipart 字段 file
GET    /api/photos?limit=&before=
GET    /api/photos/:id
GET    /api/photos/:id/file?v=thumb|original
DELETE /api/photos/:id

# 技能（阶段三）
GET    /api/skills
POST   /api/skills            自定义技能（可 AI 分类）
PUT    /api/skills/:id/mark   body: { status: todo|emerging|done, note? }
PATCH  /api/skills/:id/note   body: { note? }
DELETE /api/skills/:id        仅自定义技能

# AI（阶段三）
GET    /api/ai/status
POST   /api/ai/chat           { messages, days?, includeStats?, chatId? } → { reply, model, chatId? }
GET    /api/ai/chats
GET    /api/ai/chats/:id
DELETE /api/ai/chats/:id
POST   /api/ai/insight        分析页一键解读（默认不入库）
POST   /api/ai/skill-suggest  { label } → 预览 emoji/领域（不写库）
POST   /api/ai/scene-suggest  { label } → 预览 emoji（不写库）

# 可选应用内登录（未配 MIA_AUTH_* 则关闭）
GET    /api/auth/status
POST   /api/auth/login
GET    /api/auth/me
```

**要点：**

- **POST 必须幂等**。离线重放可能重复提交，用客户端生成的 `id` 做主键，`INSERT OR IGNORE`
- 统一响应格式 `{ ok: boolean, data?: T, error?: string }`
- **公网主挡：Nginx Basic Auth**（见 8.2）；**可选**应用内 Bearer（`MIA_AUTH_*`）
- 场景卡片阶段一～三仍读前端 `config/scenes.ts`（localStorage `mia-scenes-v3`），不强制服务端同步
- **`DELETE` / 无 body 的请求不要默认带 `Content-Type: application/json`**（Fastify 空 body 会 400）

### 6.0 阶段二/三页面摘要

| 路由 | 说明 |
| --- | --- |
| `/analysis` | 概览 + 按周 + 高发时段 / chips / 触发 / 地点 / 应对 / 午睡；「生成解读」走 AI |
| `/album` | 照片网格 + 上传；语录 ±30 分钟挂图 |
| `/skills` | 按领域；三态 todo / emerging / done；可 `POST` 自定义 |
| `/consult` | 多轮咨询 + 历史抽屉；会话入 `ai_chats`；思考中有动效 |

`byHour` 槽：`dawn` 0–6 / `morning` 6–11 / `noon` 11–14 / `afternoon` 14–17 / `evening` 17–20 / `night` 20–24。

### 6.1 ⚠️ 环境变量与 API 地址（别硬编码）

**开发和生产的 API 地址不同**，必须走环境变量，否则本地能跑、部署后全 404。

```bash
# mia-web/.env.development
VITE_API_BASE=http://localhost:3000/api
VITE_ENABLE_SW=false

# mia-web/.env.production
VITE_API_BASE=/api              # ⭐ 相对路径，由 Nginx 反向代理转发
VITE_ENABLE_SW=false            # 买了域名上 HTTPS 后改 true（见 8.3）
```

```typescript
// mia-web/src/api/client.ts（摘要）
const BASE = import.meta.env.VITE_API_BASE ?? '/api'

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers: Record<string, string> = { ...getAuthHeaders() }
  // 仅在有 JSON body 时设置 Content-Type，避免空 DELETE 被 Fastify 拒
  if (init?.body != null && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init?.headers as object) } })
  // ...统一解包 { ok, data }
}
```

**启动脚本：**

```jsonc
// mia-web/package.json
"scripts": {
  "dev": "vite",                    // 前端 5173（冲突可换）
  "build": "vue-tsc -b && vite build",
  "preview": "vite preview"
}

// server/package.json
"scripts": {
  "dev": "nest start --watch",      // 后端 127.0.0.1:3000（冲突可换 3001）
  "build": "nest build",
  "start": "node dist/main"
}
```

> ⚠️ **端口提醒**：服务器上已跑着「班主任管理平台」，配反向代理前先确认 3000 端口没被占用
> （`ss -tlnp | grep 3000`），冲突就换一个（如 3001），前后端对上即可。本地开发常用 `MIA_PORT=3001`。

---

## 7. PWA 配置

### 7.1 ⚠️ 阶段一先不注册 Service Worker（2026-08-31 用户决策）

**背景：用户选择「不用域名，先按 IP + HTTP 跑起来，域名后补」。**

这带来一条硬约束链：

```
PWA 离线记录
  ↓ 依赖
Service Worker（缓存页面，断网也能打开）
  ↓ 浏览器强制要求
HTTPS（除 localhost 外，HTTP 下一律拒绝注册 SW）
  ↓ 需要
域名（Let's Encrypt 不给裸 IP 签证书）
```

**所以阶段一：Service Worker 不注册，离线记录能力暂缺。**

**但这不等于离线队列不做了。** 区分清楚两件事：

| 能力                      | 阶段一做不做            | 说明                                  |
| ----------------------- | ----------------- | ----------------------------------- |
| **IndexedDB 草稿队列**      | ✅ **照做**（见 4.5 节） | 处理「页面已打开但请求失败」的情况。网络抖动、切后台、请求超时时会触发 |
| **Service Worker 离线缓存** | ❌ 阶段一不做           | 断网时页面本身打不开，需要 HTTPS                 |

**实际影响评估（不大）：**

- 手机在户外记录（商场、公园、车上）基本都有 4G/5G 信号，**真正断网场景占比很低**
- 草稿队列仍能覆盖「请求失败」这类更常见的情况
- 等买了域名再补 Service Worker，改动很小

**代码上怎么处理：** `vite-plugin-pwa` 仍然装上、配置仍然写好，但**用环境变量控制是否注册**：

```ts
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  disable: process.env.VITE_ENABLE_SW !== 'true',  // ⭐ 默认关，有域名后开
  // ...其余配置照常
})
```

```ts
// src/main.ts
if (import.meta.env.VITE_ENABLE_SW === 'true') {
  registerSW({ immediate: true })
}
```

**买了域名之后要做的事**（记一下，别忘）：

1. 域名解析到服务器 IP
2. 1Panel 申请 Let's Encrypt 证书（自动续期）
3. `VITE_ENABLE_SW=true` 重新构建
4. 手机端「添加到主屏幕」，验证离线能打开

### 7.2 Manifest 与图标（照做，不依赖 SW）

> **PWA 只为手机录入服务。**&#x4E3B;要场景是电脑浏览器，不需要添加到桌面；手机端添加到主屏幕后，点开应直达录入页。

```ts
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  disable: process.env.VITE_ENABLE_SW !== 'true',
  manifest: {
    name: 'Mia 的成长中心',
    short_name: 'Mia',
    description: '记录 Mia 的每一天',
    theme_color: '#e8736b',           // 糖果风珊瑚红，见 1.2 节 Token
    background_color: '#fffbf0',      // 奶油底
    display: 'standalone',
    orientation: 'any',          // 别锁 portrait，电脑端添加后会很怪
    start_url: '/record',        // ⭐ 手机点开直达录入页，不经过时间线
    icons: [ /* 192x192, 512x512，需 maskable */ ],
  },
  workbox: {
    runtimeCaching: [
      {
        // API 请求走 network-first，保证录入及时
        urlPattern: /\/api\/.*/i,
        handler: 'NetworkFirst',
        options: { cacheName: 'api', networkTimeoutSeconds: 3 },
      },
    ],
  },
})
```

> **图标必须准备 192×192 和 512×512 两档**，否则添加到主屏幕后图标是模糊的或默认的。

---

## 8. 部署（1Panel）

### 8.1 ⚠️ 阶段一：IP + HTTP + Basic Auth（无域名）

1. **构建前端**：`npm run build` → `dist/`
2. **1Panel 静态站点**：新建站点，根目录指向 `dist/`，**站点域名填服务器 IP**（如 `115.159.190.215`）
3. **Node 项目**：跑 NestJS（监听 `127.0.0.1:3000`，**不要绑 0.0.0.0**）
4. **反向代理**：把 `/api/*` 代理到 `http://127.0.0.1:3000`
5. **⭐ Basic Auth（必做）**：见下方

### 8.2 ⭐ Basic Auth 配置（必做，别跳过）

**为什么必须做：** 裸 IP + 无认证 = Mia 的所有照片和成长记录在公网裸奔。不是怕被黑客盯上，是**自动扫描机器人会扫到**。

1Panel 中配置（Nginx 层，5 分钟）：

```
网站 → 对应站点 → 伪静态/配置文件，在 server 块里加：

location / {
    auth_basic "Mia";
    auth_basic_user_file /etc/nginx/.htpasswd;
    try_files $uri $uri/ /index.html;
}
```

生成密码文件（服务器上执行）：

```bash
# 装工具（Debian/Ubuntu）
apt-get install -y apache2-utils

# 生成账号（会提示输入密码）
htpasswd -c /etc/nginx/.htpasswd mia

# 验证
cat /etc/nginx/.htpasswd
```

**注意：**

- `auth_basic_user_file` 路径要放在 Nginx 能读到的位置
- 加完重载 Nginx：`nginx -s reload` 或在 1Panel 点重启
- **Basic Auth 在 HTTP 下是明文传输密码的**。等有域名上 HTTPS 之后才真正安全。现阶段的作用是挡住自动扫描，不是防窃听
- **可选第二道**：服务端配 `MIA_AUTH_USERNAME` / `MIA_AUTH_PASSWORD` / `MIA_AUTH_SECRET` 启用应用内 Bearer 登录（`/login`）；未配则关闭，仅依赖 Nginx

### 8.3 以后买了域名再补

1. 域名解析到服务器 IP
2. 1Panel → 网站 → 申请 Let's Encrypt 证书（自动续期）
3. 开启强制 HTTPS
4. `VITE_ENABLE_SW=true` 重新构建前端
5. Service Worker 生效 → 离线记录能力可用 → 手机可「添加到主屏幕」

**数据库文件位置**：`server/data/mia.db`，记得加进备份计划（复制文件即可）。

---

## 9. 实施任务拆分（按顺序给 Cursor）

- [x] **T1** 初始化 Vite + Vue3 + TS 项目，配好 Pinia、Element Plus 按需引入
- [x] **T1.5** ⭐ **视觉风格基建**（见 1.2 节）：`tokens.css` 设计变量 + `element-override.css` 覆写 + `<TypeChip>` 组件 + 卡片/按钮/输入框基础样式。**这一步不做，后面所有页面都会长成后台管理系统**
- [x] **T2** 后端 **NestJS + FastifyAdapter** + better-sqlite3，建表 + 健康检查接口（见 1.0 节）
- [x] **T3** 定义 `types/event.ts` 前后端共用类型（含新类型枚举与 Legacy）
- [x] **T4** 后端 CRUD 接口（POST 幂等 + GET 分页）
- [x] **T5** 响应式骨架：电脑端侧边栏 + 手机端 TabBar，断点 ≥1024 / <768
- [x] **T6** 录入页：场景卡片 v3（类型入口 + emoji；`mia-scenes-v3`）**—— 糖果风：14px 圆角 + 2.5px 描边 + 大 emoji + hover 弹起，不用 el-card**
- [x] **T7** 录入页：chips + 字段表单 + 记住上次记录人（仅爸妈）/ 地点
- [x] **T8** 离线队列：IndexedDB 封装 + 提交失败存本地 + 启动时重放
- [x] **T9** 时间线页：月份导航 + 事件流 + 类型筛选 + 右侧抽屉详情（可删）
- [x] **T10** PWA manifest + 图标（192/512）；**Service Worker 配置写好但默认关闭**，见 7.1
- [ ] **T11** 部署到 1Panel（**IP + HTTP + Basic Auth**，见 8.1/8.2），电脑端实测浏览 + 手机端实测录入耗时

> 阶段二/三见规格 §6.0 与 `.cursor/rules/45|46|47|48`。

**渺言妙语（语录模块，见 4.6 节）：**

- [x] **T12** 建 `quotes` 表 + CRUD 接口（GET 按月龄分组返回）
- [x] **T13** 录入页：输入框自动聚焦 + 上下文折叠区 + 保存后回到录入态 + 离线队列复用
- [x] **T14** 语录墙：按月龄分组 + 卡片样式（**原话大字号、中文引号「」、葡萄紫 `#EDE5F3` 描边款、解读小字灰色**）
- [x] **T15** 时间线合并显示语录（前端按时间归并两个列表）
- [x] **T16** 快捷键 `Q` 直达语录录入 + `?` 帮助面板

**互动形象（排在语录之后，气泡内容依赖 quotes 表）：**

- [x] **T17** 毯子小精灵（混合方案，见 9.1 节）
  - **T17.1** 先用 9.1.1 的脚本从 `_source.png` 切出 4 张透明图 + 统一画布底部对齐
  - **T17.2** `useSpriteState()` composable + `BlanketSprite.vue` / `SpriteImage.vue` / `QuoteBubble.vue`
  - ⚠️ 语录没数据时气泡是空的，可在 `quotes` 为空时隐藏气泡只留精灵

**以后买了域名再补（不是现在做）：**

- [ ] **T18** 域名解析 + Let's Encrypt 证书 + 强制 HTTPS
- [ ] **T19** `VITE_ENABLE_SW=true` 重新构建，开启 Service Worker，验证离线记录

**验收标准**：

- 手机端从打开到保存不超过 15 秒
- 请求失败时数据存本地，联网后自动补交（草稿队列，不依赖 Service Worker）
- **⭐ 视觉验收：打开页面第一眼感觉是「活泼糖果」，不是「后台管理系统」**
  - 卡片、chips、按钮都有 **2–2.5px 暖深褐描边**（`#6B5A4E`），不是 1px 灰线
  - 所有按钮、chips 是胶囊形（999px），卡片圆角 14px
  - 底色是奶油 `#FFFBF0`，不是纯白
  - 四色撞色可见（珊瑚红 / 蜜糖黄 / 薄荷绿 / 天蓝），但**不刺眼**
  - hover 有弹起 + 硬阴影、点击有回弹、列表有蹦入动画
- ⚠️ 阶段一**不验证**「断网能打开页面」（无域名无 HTTPS，能力暂缺）

---

## 9.1 毯子小精灵（✅ 混合方案，可开发）

> **2026-08-31 更新：形象已定稿（四状态设计稿），采用混合方案实施。**
>
> **技术方案：静态状态切图 + CSS 微动效 + 状态机 composable（三层分离）**
>
> **⚠️ 素材需自行处理：原图在 `assets/sprite/_source.png`（1536×1024，四状态横向排列）。**
> 请打开原图目视校准边界后，用 9.1.1 的脚本切出 4 张透明图（不要直接用预切图，自动检测边界会串入相邻状态）。

**是什么：** 基于 Mia 的阿贝贝（安抚毯）的互动精灵，固定在页面右下角。点击后弹出随机语录气泡。

**为什么做：** 语录模块的「情感锚点」——让冷冰冰的数据列表有一个有温度的入口。也是 Mia 成长中心的品牌符号。

**设计原则（已确认有效）：**

- ❌ **不加眼睛** —— 毯子上已有兔子脸花纹，加眼睛会视觉冲突
- ❌ **不做「穿毯子的小人」** —— 阿贝贝本身就是角色，不是 costume
- ✅ **生命感来自形态与动作**（漂浮、卷边、扇动），不是来自五官
- ✅ 形象方向：魔毯/飞毯那种「物体本身活着」的感觉
- ✅ **零依赖**：纯 CSS 动画，不用 Live2D/Lottie/Rive（服务器内存只有 3.32GB）

### 9.1.1 四个状态

| 状态 | 描述 | 触发 | 表现 |
|---|---|---|---|
| **IDLE** | 平躺待机 | 默认态 | 轻微上下浮动 + 呼吸缩放（循环） |
| **WAVE** | 翘起挥手 | 鼠标 hover | 尖端左右摇摆（rotate） |
| **SLEEP** | 蜷缩睡觉 | 无操作 5 秒后 | 缓慢起伏（模拟呼吸） |
| **FOLD** | 折叠收纳 | 页面隐藏/离开 | 静止无动画 |

**⭐ 素材处理：需要 Cursor 从原图精确截取**

原图已放在项目里，**不要直接用预切图**（自动检测的边界不准，相邻状态会互相串入）：

```
assets/sprite/_source.png      ← 四状态设计稿原图，1536 × 1024
```

原图中四个状态**横向排列**，从左到右依次是 IDLE → WAVE → SLEEP → FOLD。

**⚠️ 截取注意事项（别踩这些坑）：**

1. **四个状态挨得近，自动检测边界会串** —— 必须打开原图目视确认每个状态的左右边界再切
2. **下方有 `IDLE`/`WAVE`/`SLEEP`/`FOLD` 文字标签** —— y 上限取 640 以上会切到文字，需要避开
3. **文字标签位置与图形不完全对齐** —— 别用标签位置反推图形边界，要直接看图形
4. **背景是灰色 `#DBDBDB`**（不是白色）—— 抠图时用这个色值做 alpha 判定

**坐标参考（自动检测的粗略结果，仅供参考起点，务必目视校准）：**

| 状态 | 参考 x 范围 | 参考 y 范围 |
|---|---|---|
| IDLE | 25 – 440 | 240 – 640 |
| WAVE | 455 – 920 | 240 – 640 |
| SLEEP | 935 – 1240 | 240 – 640 |
| FOLD | 1265 – 1500 | 240 – 640 |

**抠图脚本（Pillow，Cursor 可直接跑，改坐标即可）：**

```python
from PIL import Image
import os

src = 'assets/sprite/_source.png'
im = Image.open(src).convert('RGB')
px = im.load()
BG = (219, 219, 219)   # 灰底 #DBDBDB

def d_bg(c):
    return abs(c[0]-BG[0]) + abs(c[1]-BG[1]) + abs(c[2]-BG[2])

# ⚠️ 坐标需目视校准后再跑
states = {
    'idle':  (25, 440),
    'wave':  (455, 920),
    'sleep': (935, 1240),
    'fold':  (1265, 1500),
}
Y_MAX = 640   # 避开底部文字标签

for name, (x0, x1) in states.items():
    ys = [y for y in range(240, Y_MAX)
          for xx in range(x0, x1+1, 3) if d_bg(px[xx, y]) > 20]
    if not ys:
        continue
    y0, y1 = max(min(ys)-2, 0), min(max(ys)+2, Y_MAX)

    crop = im.crop((x0, y0, x1+1, y1+1)).convert('RGBA')
    cp = crop.load()
    W, H = crop.size

    # 1) 按与背景色的距离生成 alpha（保留 1px 软边，抗锯齿）
    for yy in range(H):
        for xx in range(W):
            r, g, b, a = cp[xx, yy]
            d = d_bg((r, g, b))
            na = 0 if d <= 18 else (255 if d >= 60 else int((d-18)/42*255))
            cp[xx, yy] = (r, g, b, na)

    # 2) 反色补偿：半透明边缘原本混了灰底，需还原真实颜色
    op = crop.load()
    for yy in range(H):
        for xx in range(W):
            r, g, b, a = op[xx, yy]
            if 0 < a < 255:
                al = a / 255.0
                nr = int((r - (1-al)*BG[0]) / al)
                ng = int((g - (1-al)*BG[1]) / al)
                nb = int((b - (1-al)*BG[2]) / al)
                op[xx, yy] = (max(0,min(255,nr)), max(0,min(255,ng)), max(0,min(255,nb)), a)
    crop.save(f'assets/sprite/{name}.png', optimize=True)
```

**切完还需要一步：统一画布 + 底部对齐**

四个状态切出来尺寸不同（比如 IDLE 是扁的、SLEEP 是方的），直接切换会上下跳动。需要统一到同一画布并**底部对齐**（毯子要"站"在同一地面上，居中会导致切换时上下跳）：

```python
from PIL import Image

names = ['idle', 'wave', 'sleep', 'fold']
imgs = {n: Image.open(f'assets/sprite/{n}.png').convert('RGBA') for n in names}

W = max(i.size[0] for i in imgs.values())   # 统一画布
H = max(i.size[1] for i in imgs.values())

for n, im in imgs.items():
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x = (W - im.size[0]) // 2   # 水平居中
    y = H - im.size[1]          # ⭐ 底部对齐（关键）
    canvas.paste(im, (x, y), im)
    canvas.save(f'assets/sprite/{n}.png', optimize=True)
    canvas.save(f'assets/sprite/{n}.webp', 'WEBP', quality=92, method=6)
```

**产出目标：**

| 文件 | 说明 |
|---|---|
| `idle.png` / `idle.webp` | 平躺待机 |
| `wave.png` / `wave.webp` | 翘起挥手 |
| `sleep.png` / `sleep.webp` | 蜷缩睡觉 |
| `fold.png` / `fold.webp` | 折叠收纳 |

- 四张**统一画布尺寸、底部对齐**（切换不跳动）
- 背景透明，WebP 优先（比 PNG 小 75%），PNG 作 fallback
- 源图 400+ px，网页显示 96–128px 时有 3–4x Retina 余量

### 9.1.2 技术方案：三层混合架构

```
┌─────────────────────────────────────────────┐
│  第一层：静态状态切图（4 张 PNG/WebP）        │
│  idle.svg → wave.svg → sleep.svg → fold.svg │
│  切换方式 = opacity crossfade 200ms          │
├─────────────────────────────────────────────┤
│  第二层：单态内微动效（CSS @keyframes）        │
│  IDLE: 轻微浮动 + 呼吸缩放                    │
│  WAVE: 尖端左右摇摆 rotate                    │
│  SLEEP: 缓慢起伏（模拟呼吸）                  │
│  FOLD: 无动画                                │
├─────────────────────────────────────────────┤
│  第三层：状态机驱动（Vue composable）          │
│  useSpriteState() → 返回 { currentState }    │
│  hover→WAVE | timeout(5s)→SLEEP | hide→FOLD  │
└─────────────────────────────────────────────┘
```

**为什么不用纯 SVG 变形（Morphing）：**

- IDLE ↔ WAVE 拓扑相同，变形可行
- 但 SLEEP（团块）/ FOLD（叠层）拓扑完全不同，变形会像融化的蜡一样乱扭
- GSAP MorphSVG 能解决但引入额外依赖，现阶段不值得

**为什么不用帧精灵图（Sprite Sheet）：**

- 表现力最强，但需要每个状态画 2–3 帧（美术成本）
- 当前 4 张静态图 + CSS 动画已经足够覆盖需求
- 将来如果要做更丰富的帧动画（如 WAVE 的连续挥动），升级为 sprite sheet 即可，接口不变

### 9.1.3 CSS 微动效代码

```css
/* ===== 统一画布容器 ===== */
.sprite-character {
  width: 96px;           /* 显示尺寸，源图 416px 提供 4.3x Retina 余量 */
  height: auto;
  position: fixed;       /* 或 absolute */
  bottom: 24px;
  right: 24px;
  z-index: 100;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

/* ===== 第一层：状态切换 crossfade ===== */
.sprite-image {
  position: absolute;
  width: 100%;
  height: auto;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.sprite-image.active {
  opacity: 1;
}

/* ===== 第二层：单态内微动效 ===== */

/* IDLE: 轻微上下浮动 + 呼吸缩放 — 3s 循环 */
.s-idle .sprite-image {
  animation: sprite-idle 3s ease-in-out infinite;
}
@keyframes sprite-idle {
  0%, 100% { transform: translateY(0) scale(1); }
  50%      { transform: translateY(-3px) scale(1.02); }
}

/* WAVE: 尖端左右摇摆 — 1.5s 循环，hover 时触发 */
.s-wave .sprite-image {
  animation: sprite-wave 1.5s ease-in-out infinite;
  transform-origin: center bottom; /* 从底部旋转 */
}
@keyframes sprite-wave {
  0%, 100% { transform: rotate(-3deg); }
  50%      { transform: rotate(5deg); }
}

/* SLEEP: 缓慢起伏模拟呼吸 — 4s 循环 */
.s-sleep .sprite-image {
  animation: sprite-sleep 4s ease-in-out infinite;
}
@keyframes sprite-sleep {
  0%, 100% { transform: translateY(0) scale(0.98); }
  50%      { transform: translateY(2px) scale(1); }
}

/* FOLD: 无动画（静止） */
.s-fold .sprite-image {
  /* 无 animation */
}
```

### 9.1.4 ⭐ 状态机（Vue Composable）

```typescript
// src/composables/useSpriteState.ts
import { ref, onMounted, onUnmounted } from 'vue'

export type SpriteState = 'idle' | 'wave' | 'sleep' | 'fold'

export function useSpriteState() {
  const state = ref<SpriteState>('idle')
  let sleepTimer: ReturnType<typeof setTimeout> | null = null
  let sleepTimeout = 5000 // 5秒无操作进入睡眠

  const enterIdle = () => {
    clearSleepTimer()
    state.value = 'idle'
    resetSleepTimer()
  }

  const enterWave = () => {
    if (state.value === 'fold') return // FOLD 不响应 hover
    clearSleepTimer()
    state.value = 'wave'
  }

  const leaveWave = () => {
    if (state.value === 'wave') enterIdle()
  }

  const enterSleep = () => {
    state.value = 'sleep'
  }

  const enterFold = () => {
    clearSleepTimer()
    state.value = 'fold'
  }

  const wakeFromFold = () => {
    enterIdle()
  }

  // 内部工具
  const clearSleepTimer = () => {
    if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null }
  }
  const resetSleepTimer = () => {
    clearSleepTimer()
    sleepTimer = setTimeout(enterSleep, sleepTimeout)
  }

  // 用户交互时重置睡眠计时器
  const onUserActivity = () => {
    if (state.value !== 'fold') resetSleepTimer()
  }

  onMounted(() => {
    window.addEventListener('mousemove', onUserActivity)
    window.addEventListener('click', onUserActivity)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) enterFold()
      else wakeFromFold()
    })
    resetSleepTimer()
  })

  onUnmounted(() => {
    clearSleepTimer()
    window.removeEventListener('mousemove', onUserActivity)
    window.removeEventListener('click', onUserActivity)
  })

  return { state, enterIdle, enterWave, leaveWave, enterFold, wakeFromFold }
}
```

**状态流转图：**

```
     [IDLE] ←── 用户回来 ─── [FOLD] ←── 页面隐藏
       │                     ↑
       │  5s 无操作          │
       ↓                     │
    [SLEEP] ─── 点击/移动 ──┘
       ↑
       │  mouseleave
       ↓
    [WAVE] ←── mouseenter ←── [IDLE]
```

### 9.1.5 交互流程（点击弹出语录气泡）

```
待机(IDLE) → float(浮动) 自动循环
    ↓ [mouseenter]
悬浮抬起 → 进入 WAVE 态（摇摆动画）
    ↓ [mouseleave]
回 IDLE
    ↓ [click]
气泡弹出 → fadeInUp 从上方淡入
  ├─ 内容：quotes 表随机一条（content + month_age + said_at）
  ├─ 样式：白底卡片 + 圆角 12px + 小三角箭头 + 硬阴影
  └─ 自动消失：4 秒后淡出（鼠标悬停在气泡上时不消失）
    ↓ [再次点击]
换一条 → 不重复上一条（lastIdx 去重）
```

### 9.1.6 接口需求

```
GET /api/quotes?random=1
→ 返回一条随机语录 { id, content, month_age, said_at }
→ 用于精灵气泡填充
```

前端可预取 5 条缓存在 store 里，点击时直接换（省掉等待）。这个接口在 T12 的 CRUD 基础上加一个 `random` 查询参数即可。

### 9.1.7 Vue 组件结构

```
src/components/
  BlanketSprite.vue        ← 主组件（fixed 定位 + useSpriteState + 事件绑定）
    ├── SpriteImage.vue     ← 精灵图渲染（4张图 + crossfade 切换 + 动画 class）
    └── QuoteBubble.vue     ← 语录气泡（显示/隐藏 + 淡入动画 + 自动关闭）

src/composables/
  useSpriteState.ts         ← 状态机：idle / wave / sleep / fold

src/assets/sprite/
  _source.png               ← 原图（1536×1024），保留别删
  idle.png / idle.webp      ← 平躺待机（由 9.1.1 脚本切出）
  wave.png / wave.webp      ← 翘起挥手
  sleep.png / sleep.webp    ← 蜷缩睡觉
  fold.png / fold.webp      ← 折叠收纳
```

> 四张切图统一画布 + 底部对齐，具体尺寸取决于切图时的目视校准结果（参考值 416×238）。

**实现要点：**

- 用 `ref<SpriteState>('idle')` 单一状态源，class 绑定 `s-${state}`
- 切换状态时先移除 class → `void el.offsetWidth`（强制重排）→ 再加新 class，否则同名动画不会重播
- 图片用 `<img :src="currentSrc">` 动态切换，配合 CSS `opacity` 过渡
- 移动端收起为小圆按钮（避免遮挡录入区），点击展开完整精灵
- WebP 优先：`<source type="image/webp">` + `<img>` fallback

### 9.1.8 ⚠️ 与旧版 6 状态机的差异

旧版（探索期）：idle / wave / thinking / talk / happy / sleep（6 态，含眨眼/嘴巴张合等细节表情）
新版（定稿后）：**IDLE / WAVE / SLEEP / FOLD（4 态，纯形态变化，无五官）**

原因：
- ❌ 不加眼睛 → 眨眼动画不需要了
- ❌ 不做穿毯子的小人 → 挥手/思考/说话的表情差异不存在了
- ✅ 纯形态变化已经足够传达「活着」的感觉
- ✅ 4 态更简单、更可靠、更容易维护

**将来如果升级为 Rive/Live2D（形象更丰富后），接口不变——`useSpriteState()` 的返回值照样驱动 Rive 的状态机输入。**

---

## 10. 容易踩的坑（提前说）

| 坑                          | 说明                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------ |
| **时间戳**                    | 统一用 ISO 字符串存，别用 SQLite 的 DATETIME（时区会坑）                                              |
| **月龄计算**                   | 按完整月算，不是天数除 30。2024-05-17 出生                                                         |
| **Element Plus 按需引入**      | 全量引入体积大，用 `unplugin-vue-components` + `unplugin-auto-import`                         |
| **断点设计**                   | 别用组件库的默认断点，自己定义：`≥1024` 电脑布局，`768–1024` 平板，`<768` 手机。用 CSS 变量统一管理                    |
| **电脑端别忘了也测**               | 主要使用场景是电脑，别只在手机模拟器里看就交付                                                              |
| **iOS Safari 的 IndexedDB** | 隐私模式下不可用，做好降级（提示用户）                                                                  |
| **Service Worker 缓存**      | 更新后可能看到旧页面，`registerType: 'autoUpdate'` + 提示刷新                                       |
| **POST 幂等**                | 离线重放必然遇到，一定要 `INSERT OR IGNORE`                                                      |
| **空 DELETE 别带 JSON Content-Type** | Fastify 会因空 body 报 400；`client.ts` 仅在有 body 时设置该头 |
| **分析别加回照护人/按星期** | 已有意从 analytics 去掉，勿再加 |
| **⭐ 别长成后台管理系统**            | Element Plus 默认是后台风（方角、灰描边、商务蓝）。**必须按 1.2 节做可爱化改造**，并在 T1.5 一次性建好 token，不然后面每个页面都要返工 |
| **别用 `<el-tag>`**          | 方角 + 无描边，跟糖果风冲突。自己写 `<TypeChip>`（胶囊形 + 2px 描边）                                       |
| **图标用 emoji**              | Element Plus 图标是细描边线性风格，偏商务。emoji 饱满有笔触感且零成本                                          |
| **描边用暖深褐不是纯黑**            | `#6B5A4E` 而不是 `#2D2D2D`。纯黑 + 粗线 = 廉价卡通感且刺眼                                        |
| **饱和度别回调**                 | 四个主色已降 15–25%，是妈妈觉得「原版太亮」后的优化结果。别往上加                                            |
| **描边不是处处加**                | 卡片、chips、按钮加；正文、分隔线、表格线不加。全加显乱                                                 |
