# API 接口设计

| 项 | 内容 |
| --- | --- |
| 版本 | v1.0 |
| 基础路径 | `http://localhost:3000/api` |
| 协议 | HTTP + JSON（`multipart/form-data` 仅用于上传） |
| 日期 | 2026-09-24 |
| 状态 | **字段冻结后前后端方可并行开发；任何字段变更需更新本文档并通知全部角色** |

---

## 1. 通用约定

### 1.1 统一响应结构

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

- `code = 0` 表示成功，其余为错误码；
- 分页接口 `data` 固定为 `{ list, page, pageSize, total }`；
- HTTP 状态码与业务码配合：参数错误 400、未授权 401、资源不存在 404、系统错误 500。

### 1.2 错误码

| code | HTTP | 含义 |
| --- | --- | --- |
| 0 | 200 | 成功 |
| 1000 | 400 | 参数错误（message 中说明具体字段） |
| 1001 | 401 | 未登录或登录已失效 |
| 1002 | 403 | 无权限 |
| 2001 | 404 | 资源不存在 |
| 2002 | 409 | 资源冲突（如分类名重复） |
| 3001 | 400 | 文件类型不支持 |
| 3002 | 400 | 文件超过大小限制 |
| 5000 | 500 | 服务器内部错误 |

### 1.3 鉴权

- C 端接口 `/api/categories`、`/api/dishes`、`/api/recommendations`、`/api/menus`：**无需鉴权**；
- 后台接口 `/api/admin/**`（除 `POST /api/admin/login`）：**需要鉴权**；
- 请求头：`Authorization: Bearer <token>`。

### 1.4 分页参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| page | int | 1 | 从 1 开始 |
| pageSize | int | 20 | 最大 100 |

---

## 2. C 端接口（免登录）

### 2.1 分类列表

`GET /api/categories`

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    { "id": 1, "name": "荤菜", "sort": 10 },
    { "id": 2, "name": "素菜", "sort": 20 }
  ]
}
```

说明：只返回 `status = 1` 的分类，按 `sort` 升序。

### 2.2 菜品列表（总菜单）

`GET /api/dishes?page=1&pageSize=20&categoryId=1&keyword=鸡蛋`

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| categoryId | 否 | 不传或传 0 表示全部 |
| keyword | 否 | 匹配菜名或食材名 |

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": 12,
        "name": "番茄炒蛋",
        "categoryId": 1,
        "categoryName": "荤菜",
        "coverUrl": "/uploads/2026/09/abc.jpg",
        "thumbUrl": "/uploads/2026/09/abc-thumb.jpg",
        "description": "家常快手菜，酸甜下饭",
        "spicyLevel": 0,
        "cookMinutes": 10,
        "ingredients": [{ "id": 3, "name": "鸡蛋", "amountNote": "2 个" }]
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 32
  }
}
```

说明：只返回 `deleted_at IS NULL AND status = 1` 的菜品；按 `sort` 升序、`id` 降序。

### 2.3 菜品详情

`GET /api/dishes/:id`

返回 `data` 为单个菜品对象（字段同 2.2 列表项）。

- 菜品不存在、已删除或已下架 → `404 / 2001`。

### 2.4 推荐菜单

`GET /api/recommendations?size=4&exclude=12,15`

| 参数 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| size | 否 | 4 | 推荐数量 |
| exclude | 否 | 空 | 本轮已展示过的菜品 id，逗号分隔；换一批时传入 |

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      { "id": 5, "name": "红烧肉", "categoryId": 1, "categoryName": "荤菜", "coverUrl": "...", "thumbUrl": "...", "description": "..." }
    ],
    "notice": ""
  }
}
```

说明：

- 规则：排除最近 7 天已点 → 排除 `exclude` → 分类分散（同分类最多 2 个）→ 按日期种子随机；
- 候选不足时放宽条件，并在 `notice` 中返回提示，如「菜品较少，已为你放宽推荐条件」；
- 菜品库为空时 `list` 为 `[]`，`notice` 为「还没有菜品，请先到后台添加」。

### 2.5 创建菜单记录（提交今日菜单）

`POST /api/menus`

请求体：

```json
{
  "mealDate": "2026-09-24",
  "remark": "",
  "items": [
    { "dishId": 5, "quantity": 1 },
    { "dishId": 12, "quantity": 2 }
  ]
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| items | 是 | 至少 1 项，最多 50 项 |
| items[].dishId | 是 | 必须是上架且未删除的菜品 |
| items[].quantity | 是 | 1~99 |
| mealDate | 否 | 默认服务端当天日期 |
| remark | 否 | ≤ 200 字 |

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": { "id": 31, "mealDate": "2026-09-24", "itemCount": 3 }
}
```

错误：菜品不存在或已下架 → `400 / 1000`，message 指明哪个菜品不可用。

### 2.6 历史菜单列表

`GET /api/menus?page=1&pageSize=20&startDate=2026-09-01&endDate=2026-09-24`

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": 31,
        "mealDate": "2026-09-24",
        "itemCount": 3,
        "createdAt": "2026-09-24T12:10:00.000Z",
        "preview": [
          { "dishName": "红烧肉", "coverUrl": "...", "quantity": 1 }
        ]
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 8
  }
}
```

`preview` 最多返回 3 项。

### 2.7 菜单详情

`GET /api/menus/:id`

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 31,
    "mealDate": "2026-09-24",
    "itemCount": 3,
    "items": [
      { "dishId": 5, "dishName": "红烧肉", "coverUrl": "...", "quantity": 1 }
    ]
  }
}
```

---

## 3. 后台接口（需鉴权）

### 3.1 登录

`POST /api/admin/login`

请求：`{ "username": "admin", "password": "***" }`

返回：

```json
{ "code": 0, "message": "ok", "data": { "token": "eyJhbGciOi...", "expiresIn": 43200, "username": "admin" } }
```

- 账号或密码错误 → `400 / 1000`，message 固定为「账号或密码错误」。

### 3.2 当前管理员

`GET /api/admin/profile` → `{ "code": 0, "data": { "id": 1, "username": "admin", "lastLoginAt": "..." } }`

### 3.3 分类管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/categories` | 全部分类（含停用），按 sort 升序 |
| POST | `/api/admin/categories` | 新增 `{ name, sort?, status? }` |
| PUT | `/api/admin/categories/:id` | 修改 |
| DELETE | `/api/admin/categories/:id` | 删除；该分类下菜品 `category_id` 置 NULL，返回 `{ affectedDishes: 3 }` |

- 名称重复 → `409 / 2002`。

### 3.4 菜品管理

`GET /api/admin/dishes?page&pageSize&categoryId&keyword&status&includeDeleted`

| 参数 | 说明 |
| --- | --- |
| status | `1` 上架 / `0` 下架 / 不传为全部 |
| includeDeleted | `true` 时包含已删除 |

返回列表项字段：`id, name, categoryId, categoryName, coverUrl, thumbUrl, description, spicyLevel, cookMinutes, status, sort, updatedAt, deletedAt`。

`GET /api/admin/dishes/:id` → 单条，含 `ingredients: [{ id, name, amountNote }]`。

`POST /api/admin/dishes`：

```json
{
  "name": "番茄炒蛋",
  "categoryId": 1,
  "coverUrl": "/uploads/2026/09/abc.jpg",
  "thumbUrl": "/uploads/2026/09/abc-thumb.jpg",
  "description": "酸甜下饭",
  "spicyLevel": 0,
  "cookMinutes": 10,
  "status": 1,
  "sort": 100,
  "ingredients": [{ "name": "鸡蛋", "amountNote": "2 个" }, { "name": "西红柿" }]
}
```

- `name` 必填且 ≤ 64 字；`categoryId` 可为空；
- `ingredients[].name` 若不存在则自动创建食材；
- 返回新建菜品 `id`。

`PUT /api/admin/dishes/:id`：字段同新增，全量覆盖。

`DELETE /api/admin/dishes/:id`：逻辑删除（写 `deleted_at`）。

`PATCH /api/admin/dishes/:id/status`：

```json
{ "status": 0 }
```

### 3.5 食材查询

`GET /api/admin/ingredients?keyword=蛋`

返回：`{ "code": 0, "data": [{ "id": 3, "name": "鸡蛋" }] }`，最多 20 条，用于后台表单联想。

### 3.6 图片上传

`POST /api/admin/upload/image`（`multipart/form-data`，字段名 `file`）

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "url": "/uploads/2026/09/9f2c.jpg",
    "thumbUrl": "/uploads/2026/09/9f2c-thumb.jpg"
  }
}
```

- 类型不在 `jpg/png/webp` → `400 / 3001`；
- 超过 5MB → `400 / 3002`；
- 未登录 → `401 / 1001`；
- 静态访问：`GET /uploads/2026/09/9f2c.jpg`。

### 3.7 点菜记录

`GET /api/admin/menus?page&pageSize&startDate&endDate` → 结构同 2.6。

`GET /api/admin/menus/:id` → 结构同 2.7。

---

## 4. 前端调用约定

| 项 | 约定 |
| --- | --- |
| 请求封装 | C 端 `src/utils/request.js`：baseURL `/api`，拦截 `code !== 0` 并 toast 提示 |
| 后台请求 | `src/utils/request.js`：自动带 `Authorization`，遇 `1001` 清 Token 并跳登录页 |
| 图片地址 | 后端返回相对路径；前端直接用（同源），跨域场景用 `.env` 的 `VUE_APP_STATIC_BASE_URL` 拼接 |
| 今日菜单 | 纯前端状态，key `cooking:cart:v1`，提交时只传 `dishId + quantity` |
| 防抖 | 搜索输入 300ms 防抖 |
| 幂等 | 提交菜单按钮 loading 期间禁用，防重复提交 |

---

## 5. 接口清单汇总

| 编号 | 方法 | 路径 | 鉴权 | 对应任务 |
| --- | --- | --- | --- | --- |
| API-01 | GET | /api/categories | 否 | BE-010 |
| API-02 | GET | /api/dishes | 否 | BE-013 |
| API-03 | GET | /api/dishes/:id | 否 | BE-013 |
| API-04 | GET | /api/recommendations | 否 | BE-014 |
| API-05 | POST | /api/menus | 否 | BE-015 |
| API-06 | GET | /api/menus | 否 | BE-015 |
| API-07 | GET | /api/menus/:id | 否 | BE-015 |
| API-08 | POST | /api/admin/login | 否 | BE-004 |
| API-09 | GET | /api/admin/profile | 是 | BE-004 |
| API-10 | GET/POST/PUT/DELETE | /api/admin/categories(/:id) | 是 | BE-010 |
| API-11 | GET/POST/PUT/DELETE | /api/admin/dishes(/:id) | 是 | BE-011 |
| API-12 | PATCH | /api/admin/dishes/:id/status | 是 | BE-011 |
| API-13 | GET | /api/admin/ingredients | 是 | BE-011 |
| API-14 | POST | /api/admin/upload/image | 是 | BE-012 |
| API-15 | GET | /api/admin/menus(/:id) | 是 | BE-015 |

---

## 6. 变更规则

1. 本文档字段冻结后，前后端按文档并行开发；
2. 任何字段新增/改名/改类型，必须：更新本文档 → 更新 `decisions.md` → 通知前端与测试；
3. 接口实现与文档不一致时，以文档为准，由后端修正实现（除非评审后改文档）。
