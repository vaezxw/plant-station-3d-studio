# Plant Station 3D Studio ↔ SCADA 平台接入与后端存储契约（选项 B）

本文档定义 3D 低代码平台独立部署、生成预览链接并嵌入 `scada`（`scada_IOT` 分支）时，**后端持久化接口**与 **前端 `postMessage` 实时通信** 的完整技术契约。3D 平台前端已内置 `RemoteApiPublishAdapter`（`src/api/scenePublishClient.ts`）与 `ScadaBridge`（`src/engine/ScadaBridge.ts`），待后端及 SCADA 侧按本文档实现后即可直接联调上线。

---

## 一、后端场景发布存储规范（选项 B）

前端可通过环境变量 `VITE_SCENE_API_BASE`（或在「发布中心 → 已发布场景 & 后端配置」界面）配置服务根路径（例如：`https://scada.maobaoinfo.com/hub/api/scene3d`）。
前端同时兼容 **标准 REST 裸对象** 以及 SCADA 现有后端包装格式 `{ succeeded: boolean, data: T, errors?: string }` 或 `{ code: 200 | 0, data: T, msg?: string }`。

### 1. 推荐数据库表结构（`scada_scene_3d`）

```sql
CREATE TABLE scada_scene_3d (
  scene_id               VARCHAR(64)  PRIMARY KEY COMMENT '短场景ID，重发布保持不变',
  revision               INT          NOT NULL DEFAULT 1 COMMENT '发布修订版本号，重发布递增',
  station_code           VARCHAR(64)  NULL COMMENT '关联SCADA采集点ID或厂站编码',
  title                  VARCHAR(128) NOT NULL COMMENT '大屏标题',
  share_token            VARCHAR(128) NOT NULL COMMENT '访问校验Token',
  require_token          TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '公开预览是否校验Token',
  embed_default_data_mode VARCHAR(16) NOT NULL DEFAULT 'auto' COMMENT 'auto|bridge|direct|sim',
  node_count             INT          NOT NULL DEFAULT 0,
  widget_count           INT          NOT NULL DEFAULT 0,
  thumbnail_data_url     MEDIUMTEXT   NULL COMMENT '缩略图(Base64或OSS URL)',
  schema_json            LONGTEXT     NOT NULL COMMENT '完整 ProjectSchema JSON',
  published_at           BIGINT       NOT NULL COMMENT '首次发布时间戳(ms)',
  updated_at             BIGINT       NOT NULL COMMENT '最近更新时间戳(ms)',
  INDEX idx_station_code (station_code)
);
```

### 2. 预留 REST 接口清单（4 个标准端点）

1. **发布 / 覆盖更新场景：`POST {base}/publish`**
   - **请求体（`PublishSceneInput`）**：
     ```json
     {
       "sceneId": "st-pump-201-a91f",
       "stationCode": "PUMP_201",
       "title": "重工业换热输送与综合能源站",
       "shareToken": "tk_m1k2abc",
       "requireToken": true,
       "embedDefaultDataMode": "auto",
       "thumbnailDataUrl": "data:image/jpeg;base64,...",
       "schema": { "version": 2, "nodes": [], "pipes": [], "dashboardWidgets": [] }
     }
     ```
   - **逻辑要求**：若 `sceneId` 已存在则 `revision = revision + 1` 并保留原 `publishedAt`；否则新建记录 `revision = 1`。
   - **响应**：完整 `PublishedSceneRecord`。

2. **公开预览拉取场景：`GET {base}/public/{sceneId}?token={shareToken}`**
   - **逻辑要求**：若 `require_token = 1` 且 `token != share_token`，返回 HTTP `401/403`；若不存在返回 HTTP `404`。
   - **响应**：完整 `PublishedSceneRecord`（含 `schema`）。

3. **获取已发布列表：`GET {base}/list`**
   - **响应**：`PublishedSceneSummary[]`（可省略大体积 `schema` 字段）。

4. **删除已发布场景：`DELETE {base}/{sceneId}`**
   - **响应**：成功状态即可。

---

## 二、3D 预览 URL 参数规范

SCADA 「采集点管理」中绑定下方生成的 **嵌入专用链接**：

```text
https://{3d-domain}/#/preview/{sceneId}?token={shareToken}&embed=scada&dataMode=bridge&parentOrigin=https://{scada-domain}
```

| 参数 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `#/preview/{sceneId}` | 独立只读运行路由（无任何搭建菜单、不写入工作台草稿库） | 必填 |
| `token` | 分享校验令牌 | 启用校验时必填 |
| `embed` | 设为 `scada` 时启用嵌入式精简行为、隐藏多余运行开关 | `none` |
| `dataMode` | `bridge`（走宿主 `postMessage`，自动停用本地 1.5s 仿真）；`direct`（走 3D 直连源）；`sim`（内置仿真）；`auto` | `embed=scada` 时默认 `bridge` |
| `parentOrigin` | 宿主 Origin 白名单校验值 | `*` |
| `chrome` | 设为 `0` 可进一步隐藏底部巡检视角栏 | `1` |

---

## 三、`PLANT_3D_BRIDGE` v1.0 双向 `postMessage` 协议

所有通信报文均封装固定外层：`{ channel: "PLANT_3D_BRIDGE", version: "1.0", requestId?: string, type, payload }`。

### 1. SCADA 宿主 → 3D 预览 `iframe`

- **`TELEMETRY_PUSH`（实时遥测推流，支持标准化格式或原样透传 SCADA MQTT 帧）**
  ```json
  {
    "channel": "PLANT_3D_BRIDGE",
    "version": "1.0",
    "type": "TELEMETRY_PUSH",
    "payload": {
      "items": [
        { "id": "HG-UF-101.pressure", "name": "入口压力", "unit": "kPa", "value": 4720.5, "quality": "GOOD" }
      ],
      "rawMqttFrames": [
        { "PointId": 757346108073861, "PointName": "主泵压力", "UnitName": "kPa", "IsAlarm": false, "RealtimeData": { "Value": 0.42 } }
      ]
    }
  }
  ```
- **`ALARM_PUSH`（设备告警推送 / 消警）**
  ```json
  {
    "channel": "PLANT_3D_BRIDGE",
    "type": "ALARM_PUSH",
    "payload": {
      "alarm": {
        "id": "alm-7573",
        "pointId": "757346108073861",
        "level": "critical",
        "tag": "P-201",
        "message": "出口压力超上限",
        "time": "12:30:00",
        "active": true
      }
    }
  }
  ```
- **`FOCUS_TARGET`（点击报警行驱动 3D 镜头定位设备）**
  - `payload`: `{ nodeId?, tag?, pointId?, bookmarkId?, view?: "iso" | "top" | "front" }`
- **`POINT_CATALOG_SYNC`（下发 SCADA 点表字典到 3D 绑定下拉）**
  - `payload`: `{ points: [{ id, name, unit, tag? }] }`

### 2. 3D 预览 `iframe` → SCADA 宿主

- **`READY`**：3D 场景与网格就绪后自动发出，携带 `{ sceneId, stationCode, title, dataMode, nodeCount, nodeTags, boundPointKeys }`，SCADA 宿主收到后即可下发 `api_latest_data` 首屏快照。
- **`NODE_CLICK`**：用户在 3D 中点击设备时触发，携带 `{ nodeId, tag, name, section, boundPointIds, partLabel }`，SCADA 宿主可联动过滤报警列表或弹窗查看历史曲线。
- **`BRIDGE_ACK`**：对宿主指令的处理回执 `{ ackType, ok, detail }`。
