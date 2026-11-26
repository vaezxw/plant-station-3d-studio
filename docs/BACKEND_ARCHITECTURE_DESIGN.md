# 智孪 3D Studio 后端架构与接口设计方案

> **技术栈定型**：`NestJS 10+`（工程架构） + `@nestjs/platform-fastify`（高性能引擎） + `Drizzle ORM` + `PostgreSQL 15+` + `@nestjs/platform-ws` + `mqtt.js`（搭配 `Mosquitto` Broker）  
> **核心目标**：低内存轻量化（单服务运行内存约 `75MB ~ 110MB`）、无 C++/Rust 原生编译依赖（Jenkins Linux 零报错打包）、与现有前端预留适配器及 Schema **1:1 严丝合缝对接**。

---

## 一、总体架构与数据流向

```text
                       ┌───────────────────────────────────────────────┐
                       │          外部接入层 (浏览器 / SCADA)           │
                       │  • 管理控制台 / 3D 编辑器 (HTTP + WS)          │
                       │  • SCADA iframe 预览 (#/preview/:sceneId)      │
                       └───────────┬──────────────────────────┬────────┘
                                   │ REST API (Fastify)       │ WebSocket (/ws/telemetry)
                                   ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                 NestJS + FastifyAdapter 单体轻量服务 (~85MB RAM)                  │
│                                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Auth & RBAC │  │ ScenePublish │  │ Project/Asset│  │  TelemetryBridge     │  │
│  │  JWT + Guard │  │ 短链发布/校验 │  │ 工程/模板/GLB │  │  MQTT订阅->内存快照  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │  + WS房间分发 + 批量写│  │
│         │                 │                 │          └───────┬──────┬───────┘  │
└─────────┼─────────────────┼─────────────────┼──────────────────┼──────┼──────────┘
          │                 │                 │                  │      │
          ▼                 ▼                 ▼                  ▼      │ MQTT Sub
   ┌───────────────────────────────────────────────────────────────┐    │
   │                  PostgreSQL 15+ (现有测试库)                   │    ▼
   │  • JSONB 存工程/发布快照/模板   • 关系表存用户/角色/资产       │ ┌─────────┐
   │  • 时序表批量写历史曲线 (每 2~5s 批量 INSERT)                  │ │Mosquitto│
   └───────────────────────────────────────────────────────────────┘ │ (~10MB) │
                                                                     └────▲────┘
                                                                          │ Pub
                                                             [PLC / 采集网关 / SCADA]
```

### 设计原则
1. **业务读写与高频采集解耦**：MQTT 消息进来后先更新**服务端内存最新快照**并立即向订阅了对应 `stationCode` 的 WebSocket 客户端节流推流（毫秒级实时性），同时在缓冲区攒够 **2~5 秒**做一次批量 `INSERT` 落入 PostgreSQL，避免单点高频写入拖垮数据库。
2. **前后端零原生编译摩擦**：使用纯 TypeScript 的 `Drizzle ORM + postgres` 驱动替代 Prisma，避免在 Jenkins Docker 构建机上出现 Rust 二进制下载慢或 Alpine Linux OpenSSL 版本兼容报错。
3. **100% 兼容前端现有适配器**：前端 `src/api/authClient.ts`、`src/api/scenePublishClient.ts`、`src/engine/DataSourceManager.ts` 无需大改，切为 `remote-api` 模式即可直接联调。

---

## 二、推荐后端目录结构

建议新建独立仓库（如 `plant-station-3d-server`），目录清晰贴合 NestJS 规范：

```text
plant-station-3d-server/
├── src/
│   ├── main.ts                         # FastifyAdapter + Multipart + Static + CORS + WS 启动入口
│   ├── app.module.ts
│   ├── config/
│   │   └── env.ts                      # Zod 校验环境变量 (PORT, PG_URL, JWT_SECRET, MQTT_URL)
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts     # @Public() 放行公开接口（如登录、SCADA公开拉取场景）
│   │   │   └── perms.decorator.ts      # @RequirePerms('scene:publish')
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts       # 全局 JWT 校验守卫
│   │   │   └── perms.guard.ts          # 权限码比对守卫（对接前端 23 个 PermissionCode）
│   │   └── interceptors/
│   │       └── response.interceptor.ts # 统一封装 { code: 200, data, msg: 'ok' }
│   ├── db/
│   │   ├── drizzle.module.ts           # 全局 Drizzle + postgres.js 连接池模块
│   │   ├── schema.ts                   # PG 全量表结构定义（Drizzle Schema）
│   │   └── seed.ts                     # 初始化超级管理员/内置角色/默认系统设置
│   └── modules/
│       ├── auth/                       # 登录、SCADA SSO 换票、/profile、登出
│       ├── rbac/                       # 用户管理、角色权限矩阵、系统全局配置
│       ├── project/                    # 3D 厂站工程草稿 CRUD + 复合缩略图更新
│       ├── scene-publish/              # 大屏发布、版本自增、公开防盗链拉取、下架
│       ├── card-template/              # 2D 卡片模板 CRUD + 导入导出
│       ├── asset/                      # 自定义 .glb 模型流式上传 + 静态下载
│       └── telemetry/                  # MqttBridgeService + TelemetryWsGateway + 历史曲线查询
├── uploads/                            # 运行期存储的 .glb 模型与封面（Docker 挂载持久化卷）
├── drizzle.config.ts
├── Dockerfile                          # 多阶段构建（node:20-alpine 轻量镜像）
├── docker-compose.yml                  # 服务端 + Mosquitto + PostgreSQL 编排
├── Jenkinsfile                         # Jenkins 自动化流水线脚本
├── package.json
└── tsconfig.json
```

---

## 三、PostgreSQL 数据库表设计（Drizzle ORM）

> 以下表结构可直接用 `npx drizzle-kit push` 一键同步到你现有的 PostgreSQL 测试库。

```ts
// src/db/schema.ts (核心设计示意)
import {
  pgTable, varchar, text, boolean, integer, bigint,
  jsonb, timestamp, doublePrecision, index, serial,
} from 'drizzle-orm/pg-core';

// 1. 角色与权限矩阵（对接 frontend BUILTIN_ROLES & PermissionCode）
export const sysRoles = pgTable('sys_roles', {
  id: varchar('id', { length: 32 }).primaryKey(), // 'admin' | 'designer' | 'viewer' | 自定义ID
  name: varchar('name', { length: 64 }).notNull(),
  badgeColor: varchar('badge_color', { length: 24 }).default('#38bdf8').notNull(),
  description: text('description').default('').notNull(),
  permissions: jsonb('permissions').$type<string[]>().notNull(), // 存 PermissionCode[]
  isBuiltin: boolean('is_builtin').default(false).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. 用户表（对接 UserProfile & allowedStationCodes 数据域隔离）
export const sysUsers = pgTable('sys_users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  username: varchar('username', { length: 64 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(), // bcryptjs 加密存储
  displayName: varchar('display_name', { length: 64 }).notNull(),
  roleId: varchar('role_id', { length: 32 }).references(() => sysRoles.id).notNull(),
  department: varchar('department', { length: 64 }).default('默认部门').notNull(),
  tenantId: varchar('tenant_id', { length: 64 }),
  allowedStationCodes: jsonb('allowed_station_codes').$type<string[]>().default([]).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. 系统配置表（品牌名、副标题、预览安全策略）
export const sysSettings = pgTable('sys_settings', {
  key: varchar('key', { length: 64 }).primaryKey(), // 固定 'global'
  brandName: varchar('brand_name', { length: 64 }).default('智孪 3D Studio').notNull(),
  brandSubtitle: varchar('brand_subtitle', { length: 128 }).default('工业数字孪生低代码平台').notNull(),
  allowDemoQuickLogin: boolean('allow_demo_quick_login').default(false).notNull(),
  defaultRequireShareToken: boolean('default_require_share_token').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. 3D 厂站工程草稿表（替代前端 IndexedDB plant-studio:lib:*）
export const studioProjects = pgTable('studio_projects', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  industry: varchar('industry', { length: 32 }).default('custom').notNull(),
  stationCode: varchar('station_code', { length: 64 }),
  publishedSceneId: varchar('published_scene_id', { length: 64 }),
  nodeCount: integer('node_count').default(0).notNull(),
  widgetCount: integer('widget_count').default(0).notNull(),
  thumbnailDataUrl: text('thumbnail_data_url'),
  schema: jsonb('schema').notNull(), // 完整 ProjectSchema
  ownerId: varchar('owner_id', { length: 64 }),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, (t) => [
  index('idx_projects_station').on(t.stationCode),
  index('idx_projects_updated').on(t.updatedAt),
]);

// 5. 已发布 3D 工艺大屏主表（对接 scenePublishClient.ts）
export const publishedScenes = pgTable('published_scenes', {
  sceneId: varchar('scene_id', { length: 64 }).primaryKey(),
  revision: integer('revision').default(1).notNull(),
  stationCode: varchar('station_code', { length: 64 }),
  title: varchar('title', { length: 128 }).notNull(),
  shareToken: varchar('share_token', { length: 128 }).notNull(),
  requireToken: boolean('require_token').default(true).notNull(),
  embedDefaultDataMode: varchar('embed_default_data_mode', { length: 16 }).default('bridge').notNull(),
  nodeCount: integer('node_count').default(0).notNull(),
  widgetCount: integer('widget_count').default(0).notNull(),
  thumbnailDataUrl: text('thumbnail_data_url'),
  schema: jsonb('schema').notNull(), // 冻结的完整 ProjectSchema 快照
  publishedBy: varchar('published_by', { length: 64 }),
  publishedAt: bigint('published_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, (t) => [
  index('idx_pub_station').on(t.stationCode),
]);

// 6. 发布版本历史快照表（支持一键回滚历史版本）
export const publishedSceneRevisions = pgTable('published_scene_revisions', {
  id: serial('id').primaryKey(),
  sceneId: varchar('scene_id', { length: 64 }).notNull(),
  revision: integer('revision').notNull(),
  schema: jsonb('schema').notNull(),
  publishedBy: varchar('published_by', { length: 64 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, (t) => [
  index('idx_rev_scene').on(t.sceneId, t.revision),
]);

// 7. 2D 组态卡片模板库（替代前端 IndexedDB plant-studio:card-tpl:*）
export const cardTemplates = pgTable('card_templates', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  category: varchar('category', { length: 24 }).notNull(),
  description: text('description'),
  bindCatalogKind: varchar('bind_catalog_kind', { length: 48 }),
  defaultSize: jsonb('default_size').$type<{ w: number; h: number }>().notNull(),
  cardStyle: jsonb('card_style'),
  elements: jsonb('elements').notNull(),
  createdBy: varchar('created_by', { length: 64 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

// 8. 自定义 .glb 3D 模型资产表
export const modelAssets = pgTable('model_assets', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  category: varchar('category', { length: 32 }).default('custom').notNull(),
  fileUrl: text('file_url').notNull(),     // 例如 /uploads/models/xxx.glb
  fileSizeBytes: integer('file_size_bytes').notNull(),
  uploadedBy: varchar('uploaded_by', { length: 64 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

// 9. MQTT 采集数据源配置表（服务端代理订阅规则）
export const telemetryMqttRules = pgTable('telemetry_mqtt_rules', {
  id: varchar('id', { length: 64 }).primaryKey(),
  stationCode: varchar('station_code', { length: 64 }).notNull(),
  topicPattern: varchar('topic_pattern', { length: 256 }).notNull(), // 如 'scada/stations/STATION_201/+'
  payloadMode: varchar('payload_mode', { length: 24 }).default('array').notNull(), // 'array' | 'key-value'
  persistHistory: boolean('persist_history').default(true).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
});

// 10. 遥测历史数据表（定时批量写入；数据量大时可转为 PG 分区表或 TimescaleDB Hypertable）
export const telemetryHistory = pgTable('telemetry_history', {
  id: serial('id').primaryKey(),
  stationCode: varchar('station_code', { length: 64 }).notNull(),
  pointId: varchar('point_id', { length: 128 }).notNull(),
  value: doublePrecision('value'),
  quality: varchar('quality', { length: 16 }).default('GOOD').notNull(),
  ts: timestamp('ts', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_hist_point_ts').on(t.stationCode, t.pointId, t.ts),
]);
```

---

## 四、核心 REST API 契约（与前端 1:1 对齐）

> 所有接口建议配置全局 `ResponseInterceptor`，返回格式统一为 `{ code: 200, data: ..., msg: 'ok' }`（前端 `scenePublishClient.ts` 中的 `unwrapBackendResponse` 与 `authClient.ts` 均原生兼容此结构）。

### 4.1 鉴权接口（对接 `src/api/authClient.ts`，默认前缀 `/api/auth`）

| 方法 & 路径 | 权限 | 入参 (Body / Header) | 返回 `data` 结构 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/auth/login` | `@Public()` | `{ username, password }` | `{ token, refreshToken?, expiresAt, user, authMode: 'remote-api' }` | 验证 `enabled` 与密码，签发 JWT（`expiresAt` 传毫秒时间戳） |
| `POST /api/auth/sso` | `@Public()` | `{ ssoToken }` | 同上 `AuthSession` | 校验来自 SCADA 宿主系统的免密票据，换取本平台 JWT |
| `GET /api/auth/profile` | 登录态 | Header: `Authorization: Bearer <token>` | `UserProfile`（含 `permissions[]`、`allowedStationCodes`） | 前端刷新页面恢复会话时实时同步最新权限 |
| `POST /api/auth/logout` | 登录态 | Header: `Authorization: Bearer <token>` | `{ ok: true }` | 可选加入 Redis/内存黑名单失效当前 Token |

### 4.2 3D 场景发布与 SCADA 嵌入接口（对接 `src/api/scenePublishClient.ts`，默认前缀 `/api/scene3d`）

| 方法 & 路径 | 权限 | 入参 (Body / Query) | 返回 `data` 结构 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/scene3d/publish` | `scene:publish` | `PublishSceneInput` (`{ sceneId?, stationCode?, title, shareToken, requireToken, embedDefaultDataMode, schema, thumbnailDataUrl? }`) | `PublishedSceneRecord` | 若 `sceneId` 已存在则 `revision + 1` 更新并往快照表插一条历史；不存在则生成新 ID |
| `GET /api/scene3d/public/:sceneId` | `@Public()` | Query: `?token=<shareToken>` | `PublishedSceneRecord` | **核心免登录入口**：供 SCADA `iframe` 打开预览链接调用；若 `requireToken=true` 且校验失败必须返回 **HTTP 401/403**，不存在返回 **HTTP 404** |
| `GET /api/scene3d/list` | `menu:releases` | 可选 `?stationCode=...` | `PublishedSceneSummary[]` | 剔除大字段 `schema`，按 `updatedAt` 倒序返回 |
| `DELETE /api/scene3d/:sceneId` | `scene:unpublish` | — | `{ ok: true }` | 删除发布记录，SCADA 嵌入页立即失效 |

### 4.3 工程草稿、卡片模板、3D 资产与 RBAC 接口

| 模块 | 方法 & 路径 | 权限码 | 说明 |
| :--- | :--- | :--- | :--- |
| **工程草稿** | `GET /api/projects` | `menu:projects` | 按当前用户 `allowedStationCodes` 过滤返回工程摘要列表 |
| | `GET /api/projects/:id` | `menu:projects` | 获取单个工程完整 `ProjectSchema` |
| | `PUT /api/projects/:id` | `project:edit` / `project:create` | 保存/更新工程草稿及缩略图 (`upsert`) |
| | `DELETE /api/projects/:id` | `project:delete` | 删除工程 |
| **卡片模板** | `GET /api/card-templates` | `menu:card-templates` | 获取云端自定义卡片模板列表 |
| | `POST /api/card-templates/batch` | `card_template:manage` | 批量保存/导入卡片模板 |
| | `DELETE /api/card-templates/:id` | `card_template:manage` | 删除自定义模板 |
| **3D 模型资产** | `POST /api/assets/glb` | `asset:upload` | `@fastify/multipart` 流式上传 `.glb/.gltf` 文件，写入磁盘返回 `{ id, name, fileUrl }` |
| | `GET /api/assets/glb` | `menu:assets` | 列出已上传模型元数据 |
| **系统 RBAC** | `GET/POST/PATCH/DELETE /api/rbac/users` | `menu:system:users` / `system:user:write` | 用户列表、新建、启用/禁用、分配角色与厂站域 |
| | `GET/POST/PATCH /api/rbac/roles` | `menu:system:roles` / `system:role:write` | 角色列表与权限码矩阵保存 |
| | `GET/PUT /api/rbac/settings` | `menu:system:settings` / `system:setting:write` | 全局品牌名称与默认发布策略读写 |

---

## 五、MQTT 数据采集 + WebSocket 实时推送网关设计

对接前端 `src/engine/DataSourceManager.ts` 中的 `websocket` 数据源，只需把后端 WS 地址填入前端数据源配置即可开箱即用。

### 5.1 核心处理链路
1. **MQTT 订阅服务 (`MqttBridgeService`)**：
   - 使用 `mqtt.connect(process.env.MQTT_URL)` 连接 **Mosquitto**；
   - 按 `telemetry_mqtt_rules` 订阅主题（例如 `scada/stations/+/telemetry`）；
   - 收到 `Buffer` 报文并解析为标准数组 `[{ id, name?, unit?, value, quality, ts }]`（与 `DataSourceManager.ts` 的 `ParsedTelemetryItem` 结构完全一致）；
   - **同时干两件事**：
     1. 写入服务端**内存最新快照** `Map<stationCode, Map<pointId, PointItem>>`，并丢进待推送队列（每 `200ms` 节流合并打包通过 WebSocket 推给客户端，防止设备高频抖动打爆浏览器渲染）；
     2. 追加进异步落库缓冲数组 `historyBuffer`，后台每 `3000ms` 执行一次 `db.insert(telemetryHistory).values(chunk)` 批量写入 PG。
2. **WebSocket 推流网关 (`TelemetryWsGateway`，路径 `/ws/telemetry`)**：
   - 使用 `@nestjs/platform-ws`；
   - 前端连入：`ws://服务器:3000/ws/telemetry?stationCode=STATION_201`（或 `?sceneId=st-xxx`）；
   - 连接成功瞬间，**立即推送一次该厂站的内存最新快照全量包**（保证大屏一打开 0.1 秒出数字，不用等下一次 MQTT 上报）；
   - 推送报文格式（直接被前端默认 `array` 解析器识别）：
     ```json
     {
       "stationCode": "STATION_201",
       "ts": "2026-11-26T08:00:00.000Z",
       "items": [
         { "id": "HG-UF-101.pressure", "value": 4672.5, "quality": "GOOD" },
         { "id": "HG-UF-101.flowWork", "value": 124.8, "quality": "GOOD" }
       ]
     }
     ```
3. **历史曲线查询接口**：
   - `GET /api/telemetry/history?stationCode=STATION_201&pointIds=a,b&minutes=60`：供大屏初始化折线图回填最近 1 小时曲线。

---

## 六、NestJS + FastifyAdapter 启动入口关键代码参考

> 避坑关键点：用 `@fastify/multipart` 代替 Express `multer`，用 `WsAdapter` 代替 `socket.io`。

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { WsAdapter } from '@nestjs/platform-ws';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: process.env.NODE_ENV !== 'production',
      bodyLimit: 20 * 1024 * 1024, // 允许 20MB 大型工程 JSON & Base64 缩略图发布
    }),
  );

  // 1. 允许 SCADA 宿主域跨域访问 API 与 GLB 静态文件
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // 2. Fastify 原生流式上传（用于 .glb 模型文件，最大 50MB）
  await app.register(fastifyMultipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  // 3. 静态文件托管（模型文件直接通过 /uploads/models/xxx.glb 访问）
  await app.register(fastifyStatic, {
    root: join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });

  // 4. 挂载原生轻量 WebSocket 适配器
  app.useWebSocketAdapter(new WsAdapter(app));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}
void bootstrap();
```

---

## 七、轻量化部署与 Jenkins Linux 流水线规范

### 7.1 推荐依赖包（轻量干净，零原生编译坑）
- 核心：`@nestjs/common` `@nestjs/core` `@nestjs/platform-fastify` `fastify` `reflect-metadata` `rxjs`
- Fastify 插件：`@fastify/multipart` `@fastify/static` `@fastify/cors` `@nestjs/jwt`
- 数据库与校验：`drizzle-orm` `postgres` `zod` `bcryptjs`
- 实时与协议：`@nestjs/websockets` `@nestjs/platform-ws` `ws` `mqtt`
- 开发工具：`drizzle-kit` `tsx` `typescript`

### 7.2 多阶段轻量 Dockerfile（最终镜像约 `145MB`）

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 运行阶段（仅保留生产依赖 + 编译产物）
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/uploads/models
EXPOSE 3000
CMD ["node", "--max-old-space-size=256", "dist/main.js"]
```

### 7.3 `docker-compose.yml`（后端 + 极轻量 MQTT Broker）

```yaml
services:
  mosquitto:
    image: eclipse-mosquitto:2-alpine
    container_name: plant-mosquitto
    restart: unless-stopped
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
    # 内存占用仅 ~8-15MB

  plant-3d-api:
    image: ${HARBOR_IMAGE}:${BUILD_NUMBER}
    container_name: plant-3d-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      DATABASE_URL: ${DATABASE_URL} # 指向现有 PostgreSQL 测试/生产库
      JWT_SECRET: ${JWT_SECRET}
      MQTT_URL: mqtt://mosquitto:1883
    volumes:
      - /data/plant-3d/uploads:/app/uploads
```

### 7.4 `Jenkinsfile` 流水线模板

```groovy
pipeline {
  agent any
  environment {
    APP_NAME = 'plant-3d-api'
    IMAGE_TAG = "registry.company.local/iot/${APP_NAME}:${env.BUILD_NUMBER}"
  }
  stages {
    stage('Install & TypeCheck & Build') {
      steps {
        sh 'npm ci'
        sh 'npx tsc --noEmit'
        sh 'npm run build'
      }
    }
    stage('Build & Push Docker Image') {
      steps {
        sh "docker build -t ${IMAGE_TAG} ."
        sh "docker push ${IMAGE_TAG}"
      }
    }
    stage('Deploy to Linux Server') {
      steps {
        sshagent(['linux-deploy-key']) {
          sh """
            ssh -o StrictHostKeyChecking=no deploy@target-linux-ip '
              cd /opt/plant-3d-server &&
              BUILD_NUMBER=${env.BUILD_NUMBER} docker compose pull plant-3d-api &&
              BUILD_NUMBER=${env.BUILD_NUMBER} docker compose up -d plant-3d-api &&
              docker image prune -f
            '
          """
        }
      }
    }
  }
}
```

---

## 八、前端切换联调步骤清单

后端按本方案跑起后，前端只需做极小配置即可完全接管：
1. 在控制台 **「系统与权限 → 系统设置」** 或 **「数据集成 → SCADA 联调中心」** 中：
   - 将发布存储模式切换为 **`remote-api`**，Base URL 指向 `http://<服务地址>:3000/api/scene3d`；
   - 或在前端 `.env.production` 中直接固化：
     ```env
     VITE_AUTH_API_BASE=http://<服务地址>:3000/api/auth
     VITE_SCENE_API_BASE=http://<服务地址>:3000/api/scene3d
     ```
2. 在大屏 **「数据源管理」** 中新增一条 `websocket` 数据源，地址填 `ws://<服务地址>:3000/ws/telemetry?stationCode=STATION_201`，Parser 保持默认 `array` 模式（字段映射 `id / value / quality / ts`），点击“测试连接”即可实时预览来自 Mosquitto 的测点流！
