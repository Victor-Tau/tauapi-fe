# Victor API 用户门户：New API 后端接口对接参考（供 Claude Code 使用）

> **用途**：与同目录的 `newapi_frontend_demo_claude_guide.md` 配套，用于开发独立的 React / TypeScript 前端 Demo。  
> **编写日期**：2026-11-10  
> **研究基线**：[QuantumNous/new-api](https://github.com/QuantumNous/new-api)，此前分析固定提交 [`bd6bb53019fb7e21804b31ab7365c9b2097f4b6c`](https://github.com/QuantumNous/new-api/tree/bd6bb53019fb7e21804b31ab7365c9b2097f4b6c)；部分字段另与上游 `main` 源码及公开文档交叉核对。  
> **部署实例**：`http://70.39.180.109:3000`（用户提供，**实例版本和实际回包尚未经本次联网联调确认**）。  
> **测试用户名**：`test1`。**测试密码不要写入本文件、程序、环境变量、终端命令历史或测试日志；由用户在页面内手动输入。**

## 0. Claude Code 使用规则（先读）

本文件是**前端所需接口的实施参考**，**不是完整 New API 所有接口的 OpenAPI 规范，也不保证当前已部署的服务器恰好运行研究基线版本**。遇到冲突按以下顺序处理：

1. **部署实例对安全只读接口的真实返回** > 与部署版本一致的源代码 > 本文件示例 > 第三方教程/旧版文档。
2. 先用 `GET /api/status`、`GET /api/user/login/encryption-key` 做**匿名、只读**检查；其他需要登录的请求在用户**自行通过页面完成登录后**发起。
3. 不得自动调用真实后端的创建/更新/删除 API Key、改密码、充值或模型付费请求；写操作须由用户在 UI 中主动确认。
4. 原始密码、JWT、Refresh Cookie、完整 `sk-...` Key、管理 PAT **不落盘、不打印、不截图、不进入浏览器持久存储、埋点或代码仓库**。凭据仅作为运行时必要状态处理。
5. 统一封装 `ApiClient` 与运行时 DTO 校验；不允许因为示例里出现字段就断言生产数据必有该字段。记录字段差异到 `docs/API_CONTRACT.md`，只记录**脱敏结果**。
6. 浏览器只请求 `fetch('/api/...')`。开发时由 Vite `/api` 代理到已有 New API，**不应在浏览器代码中跨域直连公网 IP**。
7. 此 Demo 暂不部署 Nginx、不开发管理后台、不修改现有后端、不启用 `/api/channel`、`/api/option` 等管理员接口。

### 确认程度标记

- **[路由确认]**：在 New API 当前源码路由或之前的固定提交清单中已核对路径和方法。
- **[源码确认]**：已核对上游控制器/模型中的字段或行为。
- **[示例/待联调]**：示例仅帮助构造类型与 UI，必须根据实例真实响应调整。

---

## 1. 服务地址、代理及通用 HTTP 约定

| 配置 | 值 / 说明 |
|---|---|
| 上游 New API | `http://70.39.180.109:3000`；目前公开 HTTP，不提供传输加密 |
| 前端开发地址 | `http://localhost:5173`（Vite） |
| 前端管理接口 | **相对路径** `/api/...`，由本地 Vite 反向代理转发 |
| OpenAI 兼容模型接口（未来） | 上游 `http://70.39.180.109:3000/v1`；首版 Demo 不发真实模型请求 |
| 管理 API 鉴权 | `Authorization: Bearer <管理 JWT>` |
| 模型 API 鉴权 | `Authorization: Bearer sk-<原始模型密钥>` |
| 请求 Content-Type | 有 JSON 请求体时使用 `application/json` |
| Cookie | 登录后端下发；浏览器使用 `credentials: 'include'`，刷新/退出必须带 Cookie |
| 时间 | 后端多个字段为 **Unix 秒**；JS `Date` 需乘以 1000 |
| API 路径 | 注意结尾斜杠，例如 `/api/token/` 与 `/api/token` 不可随意互换 |

开发 `.env.local` 示例（只读连接地址，不包含任何密码或密钥）：

```dotenv
NEWAPI_PROXY_TARGET=http://70.39.180.109:3000
VITE_PUBLIC_MODEL_BASE_URL=http://70.39.180.109:3000/v1
```

Vite 参考配置（`NEWAPI_PROXY_TARGET` **只给 Node 开发进程**，不加 `VITE_` 前缀）：

```ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (!env.NEWAPI_PROXY_TARGET) throw new Error('Missing NEWAPI_PROXY_TARGET');
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: env.NEWAPI_PROXY_TARGET, changeOrigin: true },
      },
    },
  };
});
```

**重要安全提示**：Vite 代理解决同源浏览器请求，**不加密**代理到远端的 HTTP。因为目前源站未开启防火墙限制、账号为弱密码测试环境，尽量在 Vite 运行机上使用 SSH 隧道：

```bash
# 仅示意；请自行替换 SSH 登录用户。此命令不传任何业务密码。
ssh -N -L 13000:127.0.0.1:3000 <ssh-user>@70.39.180.109
# 隧道建立后：NEWAPI_PROXY_TARGET=http://127.0.0.1:13000
```

若源站启用了 `SESSION_COOKIE_SECURE=true`，浏览器必须在符合 Cookie / Origin 约束的 HTTPS 环境中运行；**不能通过前端强行取消安全校验**。此时在联调报告中指出环境前置条件。Vite 的静态生产构建**不包含开发代理**，现在只能认定为本地开发部署。

---

## 2. 接口总览：V1 页面需要什么

**标记**：`公开` 不要求登录；`JWT` 是**管理 Access JWT**，不是模型 `sk-` 密钥。除安全登录外，以下用户级接口均在后端实施用户身份鉴权。[路由确认]

| 优先级 | 方法 | 路径 | 鉴权 | 用途与约束 |
|---|---|---|---|---|
| P0 | GET | `/api/status` | 公开 | 服务器/站点公开状态和计费展示参数 |
| P0 | GET | `/api/user/login/encryption-key` | 公开 | 判断是否启用密码传输加密 |
| P0 | POST | `/api/user/login` | 公开 + 登录限制 | 用户名密码登录，可能触发附加验证 |
| P0 | POST | `/api/user/auth/refresh` | Refresh Cookie | 轮换 Refresh，返回新 JWT；已有 SID 传 `X-Auth-Session` |
| P0 | POST | `/api/user/auth/logout` | Refresh Cookie / 可附带 JWT | 撤销会话并清除 Cookie |
| P0 | GET | `/api/user/self` | JWT | 用户资料、额度、权限 |
| P0 | GET | `/api/token/` | JWT | 本人模型调用 Key 分页列表 |
| P0 | GET | `/api/token/:id` | JWT | 本人模型 Key 详情，按需获取 |
| P0 | POST | `/api/token/:id/key` | JWT | **主动显式读取**完整 Key（高敏感） |
| P0 | POST | `/api/token/` | JWT | 创建 Key；只能由用户主动提交 |
| P0 | PUT | `/api/token/` | JWT | 更新完整配置 |
| P0 | PUT | `/api/token/?status_only=true` | JWT | 仅切换启停状态（需实例核对） |
| P0 | DELETE | `/api/token/:id` | JWT | 删除自己的 Key（确认弹窗） |
| P0 | GET | `/api/log/self` | JWT | 本人日志列表、分页、条件过滤 |
| P0 | GET | `/api/log/self/stat` | JWT | 本人区间用量统计 + RPM/TPM |
| P1 | GET | `/api/user/models` | JWT | 本人可用模型选择器 |
| P1 | GET | `/api/user/self/groups` | JWT | 本人可用组列表 |
| P1 | GET | `/api/data/self` | JWT | 本人趋势统计，**先核实真实数据结构** |
| P1 | GET | `/api/token/search` | JWT | Key 搜索，可选 |
| P2 | PUT | `/api/user/self` | JWT，改密码需追加 proof | 编辑个人设置；**V1 不实现** |
| P2 | GET | `/api/verify/methods` | JWT | 敏感操作可用验证方式；**V1 不实现** |
| P2 | POST | `/api/verify` | JWT | 产生安全校验证明；**V1 不实现** |
| P2 | GET | `/api/user/sessions` | JWT | 当前设备和会话列表；**V1 不实现** |
| P2 | GET | `/api/user/topup/self` | JWT | 本人充值订单，**仅近 30 天**；钱包页 VIP 卡片使用（见 `docs/vip.md`） |

不要调用 `/api/log/self/search`：该路由虽仍注册，当前处理器已废弃。`/api/models` 与 `/api/models/` 也不是上述用户可用模型选择器的替代品。

---

## 3. HTTP 响应和错误处理

### 3.1 JSON 成功语义

大多数管理 API 采用类似结构（**示意**，并非对所有端点强制）：

```json
{
  "success": true,
  "message": "",
  "data": { "example": "value" }
}
```

常见业务失败（可能仍为 HTTP 200）：

```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

**错误判定必须同时考虑 HTTP 状态和 JSON 内容**。不能只判断 `response.ok`；也不能假设所有错误都有 `success` 字段。模型 Relay 错误可能使用 `{ "error": { "message": "...", "type": "..." } }`，登录会话错误可能额外返回 `code`。

建议前端内部统一为：

```ts
interface NormalizedApiError {
  status: number;              // HTTP 状态码，网络失败可用 0
  code?: string;               // 仅在真实回包提供时赋值
  message: string;             // 给用户看的安全、非敏感错误信息
  retriable: boolean;
}

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
};
```

### 3.2 必须考虑的状态

| HTTP / code | 前端处理 |
|---|---|
| 200 + `success: true` | 取 `data` 并进行 DTO 类型检查 |
| 200 + `success: false` | 展示后端业务错误，不误当成功 |
| 400 / 422 | 表单或请求参数错误 |
| 401 | JWT 过期可尝试**单次共享 refresh**；Refresh 本身 401 则进入匿名状态 |
| 403 | 权限不足，不能简单转为登录失败 |
| 409 / `AUTH_SESSION_MISMATCH` | 会话 SID 与 Cookie 不一致；停止盲目刷新，按会话恢复流程处理 |
| 409 / `AUTH_SESSION_LIMIT` | 活跃登录设备数达到上限 |
| 429 / `AUTH_SESSION_ISSUANCE_LIMIT` | 会话签发频率达上限；显示稍后再试 |
| 429 | 限流；不要暴力重试登录或敏感操作 |
| 5xx、网络错误 | 网络/服务端故障，保留待重试状态；**不要强制认定退出登录** |

不要自动重试 `POST /api/token/`、`PUT /api/token/`、`DELETE /api/token/:id` 等非幂等或敏感写入操作。

---

## 4. 用户登录与会话（最优先实现）

### 4.1 `GET /api/user/login/encryption-key`

用途：判断密码登录是否必须使用服务端公开密钥进行加密。[源码确认]

关闭加密时的典型响应：

```json
{ "success": true, "data": { "enabled": false } }
```

开启加密时的响应形状：

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "kid": "<KEY_ID>",
    "public_key": "<PUBLIC_KEY>"
  }
}
```

- `enabled=false`：可以按后端当前规则提交明文 `password`（**仍应通过加密传输链路**）。
- `enabled=true`：先按照与部署版本一致的加密协议生成 `password_encrypted` 与 `encryption_key_id`；**不要猜算法或把 password 明文回退提交**。必要时核对上游前端登录实现。
- 本次 Demo 如果未实现后端要求的加密策略，要明确展示“服务器要求加密登录，当前 Demo 暂不支持”，而不是伪造成功。

### 4.2 `POST /api/user/login`

未启用密码加密且无追加验证码的请求例子：

```http
POST /api/user/login HTTP/1.1
Content-Type: application/json
```

```json
{
  "username": "test1",
  "password": "<由用户手动输入的密码>"
}
```

源码支持的登录输入字段：`username`、`password`、`password_encrypted`、`encryption_key_id`；其必填组合取决于密码登录加密开关。[源码确认]

**登录完成**后的响应结构示例（省略与产品无关字段）：

```json
{
  "success": true,
  "message": "",
  "data": {
    "access_token": "<JWT>",
    "token_type": "Bearer",
    "access_expires_at": 1730000000,
    "user": {
      "id": 1,
      "username": "test1",
      "display_name": "test1"
    },
    "session": {
      "sid": "<SID>",
      "current": true,
      "login_method": "password"
    }
  }
}
```

> 示例的 ID、时间戳和字段值是占位数据，**不是该部署实例的真实用户资料**。

同时服务端设置 Refresh Cookie。附加验证（TOTP / Passkey / Turnstile / 其他验证方式）可能使密码登录只返回**待验证挑战**，而不是 JWT；前端判断“成功拿到 `data.access_token`”才允许进入登录态。若当前 `test1` 登录要求追加挑战，按实际返回更新文档或明确报告阻塞，不要绕过。

### 4.3 `POST /api/user/auth/refresh`

鉴权主要依靠浏览器的 **HttpOnly Refresh Cookie**，不依赖本地保存的密码。[源码确认]

```ts
await fetch('/api/user/auth/refresh', {
  method: 'POST',
  credentials: 'include',
  headers: sid ? { 'X-Auth-Session': sid } : {},
});
```

返回与登录成功相近的 `data.access_token`、`access_expires_at`、`user`、`session.sid`，并轮换 Refresh Cookie。

- Access JWT 默认有效期 **15 分钟**；Refresh Cookie 最长 **30 天**，具体会话仍可能被撤销。
- Refresh Cookie 名称 `new_api_refresh`，`HttpOnly`、`SameSite=Strict`、路径 `/api/user/auth`。
- `new_api_has_session=1` 仅是 UI 提示 Cookie，**不能作为登录态凭据**。
- 已有内存 SID 时传 `X-Auth-Session`；冷启动没有 SID 可以不传。
- **多请求并发 refresh 必须 single-flight**，避免各请求同时旋转 Cookie；对多标签页，可后续实现 Web Locks + BroadcastChannel。
- `SESSION_COOKIE_SECURE=true` 时，刷新和退出有严格的 Origin 校验；它与 CORS 不是同一配置。浏览器不应该人工伪造 `Origin`。
- 网络超时、502 等临时故障只显示“恢复会话失败，可重试”；确认无效 Refresh 才清理登录态。

### 4.4 `POST /api/user/auth/logout`

```ts
await fetch('/api/user/auth/logout', {
  method: 'POST',
  credentials: 'include',
  headers: {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(sid ? { 'X-Auth-Session': sid } : {}),
  },
});
```

正常退出会撤销当前会话并清除 Cookie；客户端随即清空内存的 JWT 和 SID。发生 `AUTH_SESSION_MISMATCH` 时不能假定后端已注销，须按文档的 SID 恢复规则处理。

> **前端存储策略**：管理 JWT 和 SID 仅放当前运行时内存；避免长期写入 `localStorage` / `sessionStorage`。刷新页面时通过 Cookie 恢复新 JWT。不能读取 HttpOnly Refresh Cookie；不应记录整个登录响应到控制台。

---

## 5. 个人信息及基础配置

### 5.1 `GET /api/user/self`

```http
GET /api/user/self HTTP/1.1
Authorization: Bearer <管理 JWT>
```

响应 `data` 是用户自己的安全 DTO，已确认包含下列键（有些值可能为空）：

| 字段 | 类型 | 用途 |
|---|---|---|
| `id` | number | 当前用户 ID |
| `username` | string | 登录用户名 |
| `display_name` | string | 显示昵称 |
| `email` | string | 邮箱，可能为空 |
| `group` | string | 用户组 |
| `role`、`status` | number | 权限和账号状态 |
| `quota` | number | 用户剩余额度，**内部 quota 单位** |
| `used_quota` | number | 用户累计使用额度，**内部 quota 单位** |
| `request_count` | number | 账号累计请求数 |
| `has_password` | boolean | 账号是否已设置密码 |
| `setting`、`sidebar_modules` | mixed | 偏好配置及旧控制台展示设置 |
| `permissions` | object | 服务器授权后的权限信息 |

典型响应外形：[源码确认，值均为占位]

```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 1,
    "username": "test1",
    "display_name": "Test User",
    "email": "",
    "role": 1,
    "group": "default",
    "quota": 500000,
    "used_quota": 0,
    "request_count": 0,
    "has_password": true,
    "permissions": {}
  }
}
```

**前端不要把 `quota` 写成“Token 数量”或“美元”**。它是 New API 内部额度计量值；显示金额时要依据实际站点配置换算，见第 8 章。

### 5.2 可选选择器接口

| 方法与路径 | 用途 | 备注 |
|---|---|---|
| `GET /api/user/models` | 本人可用模型列表 | 适合 Key 创建弹窗的模型选择器；支持可选 `group` 查询参数 |
| `GET /api/user/self/groups` | 本人可用分组 | 用于选择 Key 分组；以真实 `data` 为准 |
| `GET /api/status` | 站点展示配置 | 公开接口，已确认可能包含 `data.quota_per_unit` |

首期没有分组/模型选择器时，可以先只提供用户已存在 Key 的编辑功能；创建表单必须确保 `group` 与现有用户可用组一致，不能把未知分组假定成可用。

---

## 6. API 密钥（Relay Token）管理

> 重要：这一章的“API Key / Token”是用户调用模型的 `sk-...` 凭据，**不是管理 JWT，也不是 `nap_...` 面板 PAT**。这些 Key 的编辑路由由 `middleware.UserAuth()` 保护，列表和单个 Key 访问应遵循用户归属校验。[路由与模型确认]

### 6.1 `GET /api/token/` — 本人 Key 列表

示例：

```http
GET /api/token/?p=1 HTTP/1.1
Authorization: Bearer <管理 JWT>
```

典型分页外形：

```json
{
  "success": true,
  "data": {
    "page": 1,
    "page_size": 20,
    "total": 1,
    "items": [
      {
        "id": 12,
        "name": "My Key",
        "key": "abcd**********wxyz",
        "status": 1,
        "created_time": 1730000000,
        "accessed_time": 1730000000,
        "expired_time": -1,
        "remain_quota": 0,
        "used_quota": 0,
        "unlimited_quota": true,
        "model_limits_enabled": false,
        "model_limits": "",
        "allow_ips": "",
        "group": "default"
      }
    ]
  }
}
```

`items`、`total`、`page`、`page_size` 是上游分页结构；数据里的 Key 必须视为**掩码或可能敏感**，不可输出到日志。具体字段以实例响应为准。

**分页兼容性注意**：新版实现采用公共分页组件；公开旧文档出现 `p`、`size`，旧前端指导书提出 `p`、`page_size`。首版先仅传 `p=1`，再用实际实例测试设置页面大小时应采用 `size` 还是 `page_size`；不要把两个名称未经验证混用，也不要将返回 `page_size` 误认为请求参数必定同名。

### 6.2 模型 Key 对象字段

来自 Go `model.Token` 的关键字段（前端应区分**服务器返回 DTO**与**提交表单 DTO**）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | number | 令牌记录 ID，修改/删除时使用 |
| `name` | string | 用户自定义名称 |
| `key` | string | 掩码字符串或敏感原始值；默认不展示原始值 |
| `status` | number | Key 状态；在 UI 中验证实际状态枚举后再映射“启用/禁用” |
| `created_time` / `accessed_time` | number | Unix 秒 |
| `expired_time` | number | Unix 秒；`-1` 表示永不过期 |
| `remain_quota` / `used_quota` | number | 内部 quota 单位 |
| `unlimited_quota` | boolean | 是否不限制 Key 本身额度 |
| `model_limits_enabled` | boolean | 是否限制允许的模型 |
| `model_limits` | **string** | Go 模型为逗号分隔的字符串，不要直接传数组 |
| `allow_ips` | string / null | IP 限制字符串；后端支持换行分隔，UI 表单应校验 |
| `group` | string | 此 Key 可用的渠道分组 |
| `cross_group_retry` | boolean | 自动分组相关高级选项，首版可不暴露 |
| `allow_user_quota_query` | boolean | 是否允许这个 Key 查询所属用户额度；首版可不暴露 |

**旧文档陷阱**：某些旧 API 文档示例把 `model_limits` 写为 `['modelA','modelB']`，但当前 `model.Token` 的 JSON 字段为 **string**。新前端把多选模型结果转换成 `models.join(',')`，读回时再 `split(',')`，并按服务器真实处理验证。

### 6.3 `POST /api/token/` — 创建 Key

请求参考（**不是自动执行的脚本**）：

```json
{
  "name": "Victor Demo Key",
  "expired_time": -1,
  "remain_quota": 0,
  "unlimited_quota": true,
  "model_limits_enabled": false,
  "model_limits": "",
  "allow_ips": "",
  "group": "default"
}
```

- 创建之前让用户在界面确认姓名、有效期、额度/无限额和分组。
- `group=default` **仅为示例**，必须确认当前用户确实可用。
- 创建成功通常为 `{ "success": true, "message": "" }`；**不能假设响应带 `data.id` 或完整密钥**。
- **创建后重新拉取列表**，通过后端实际返回的数据确定新 Key 的 ID，再按用户要求执行显式读取。
- 若上游未来版本改变成功结构，优先按真实响应适配，不应该盲目创建第二个 Key。

### 6.4 `GET /api/token/:id` — Key 详情

```http
GET /api/token/12 HTTP/1.1
Authorization: Bearer <管理 JWT>
```

返回指定的**本人** Key 详情。前端必须把 ID 当整数校验；不得把输入字符串拼成任意路径。**详情接口不是推荐的“展示完整密钥”流程**；密钥展示应使用下一节专用接口。

### 6.5 `POST /api/token/:id/key` — 显式读取完整密钥

```http
POST /api/token/12/key HTTP/1.1
Authorization: Bearer <管理 JWT>
```

当前分析版本中，预期从 `data.key` 读取**原始密钥**，此原始值不带 `sk-` 前缀；部署实例必须核对实际回包。注意：**仅在用户主动点击“显示/复制”时调用**，列表加载、页面初始化、轮询均不触发此请求。

创建客户端完整 Key 的安全格式化：

```ts
export function toRelayKey(raw: string): string {
  const s = raw.trim();
  if (!s) throw new Error('Empty relay key');
  return s.startsWith('sk-') ? s : `sk-${s}`;
}
```

- 不能产生 `sk-sk-...`。
- 完整密钥只显示在受控弹窗中，离开弹窗后清理内存状态，默认掩码。
- 复制成功 Toast 不要包含密钥；错误日志不能包含 `data.key` 或整个 response。

### 6.6 `PUT /api/token/` — 更新 Key

完整更新示例（先拉取目标 Key 数据、确认默认值，再让用户提交）：

```json
{
  "id": 12,
  "name": "Updated Key",
  "expired_time": -1,
  "remain_quota": 0,
  "unlimited_quota": true,
  "model_limits_enabled": false,
  "model_limits": "",
  "allow_ips": "",
  "group": "default"
}
```

只修改启停状态的**已文档化候选路径**：

```http
PUT /api/token/?status_only=true HTTP/1.1
Authorization: Bearer <管理 JWT>
Content-Type: application/json
```

```json
{ "id": 12, "status": 1 }
```

- `status_only=true` 曾在上游公开文档中说明，**请以当前服务端实现和真实响应核对**。
- `status` 对应数值必须依据真实列表或源码常量确定，不要用布尔值替代。
- **完整更新不是 `PUT /api/token/:id`**，ID 在 JSON 中提供。
- 提交成功后使 Key 列表与详情缓存失效并重新读取，不能仅乐观地认为保存已生效。

### 6.7 `DELETE /api/token/:id` — 删除 Key

```http
DELETE /api/token/12 HTTP/1.1
Authorization: Bearer <管理 JWT>
```

删除前显示名称、ID 和不可恢复提示。服务端已做用户归属检查，但前端仍只允许用户操作本人列表中的 ID。取消弹窗时绝不能发送请求。**测试不得自动删除真实 Key**。

### 6.8 可选接口

| 方法 / 路径 | 用途 | V1 |
|---|---|---|
| `GET /api/token/search` | 按名称/令牌过滤 | 可选；避免在 URL 放入完整 Key |
| `GET /api/token/auto-groups` | 自动分组选择 | 不做 |
| `POST /api/token/batch` | 批量删除 | 不做 |
| `POST /api/token/batch/keys` | 批量获取完整 Key | **不做，不应用于加载列表** |

---

## 7. 用量记录与统计

### 7.1 `GET /api/log/self` — 用户日志分页

建议首版请求：

```http
GET /api/log/self?p=1&type=2 HTTP/1.1
Authorization: Bearer <管理 JWT>
```

可选查询参数：[源码确认]

| 参数 | 类型 | 含义 |
|---|---|---|
| `p` | number | 页码 |
| `size` 或 `page_size` | number | 每页数；以实例公共分页解析为准 |
| `type` | number | 日志类型；消耗日志通常为 2 |
| `start_timestamp` | number | 开始 Unix 秒 |
| `end_timestamp` | number | 结束 Unix 秒 |
| `model_name` | string | 模型名过滤 |
| `token_name` | string | 模型 Key 名称过滤 |
| `group` | string | 组过滤 |
| `request_id` | string | 按请求 ID 过滤 |
| `upstream_request_id` | string | 按上游请求 ID 过滤 |

服务端按用户 ID 过滤，普通用户还有由服务端配置控制的**最大日志时间跨度**。遇到范围超限，应提示用户缩小范围，不能静默忽略错误。

典型分页 `data` 示例（字段值为占位）：

```json
{
  "page": 1,
  "page_size": 20,
  "total": 1,
  "items": [
    {
      "id": 501,
      "created_at": 1730000000,
      "type": 2,
      "model_name": "example-model",
      "token_name": "My Key",
      "prompt_tokens": 100,
      "completion_tokens": 200,
      "quota": 1500,
      "use_time": 2,
      "is_stream": true,
      "group": "default",
      "content": ""
    }
  ]
}
```

字段说明：

- `prompt_tokens` / `completion_tokens` 是**实际计量 Token 数量**，与 `quota` **不是同一单位**。
- `quota` 是计费额度。不要把 `quota=1500` 显示为 `$1500`。
- `created_at` 是 Unix 秒；`use_time` 的单位需要结合实例实际数据确认（不要擅自标注毫秒）。
- `is_stream` 是是否流式请求；`type` 不应只根据 1/2 猜全部枚举值。
- `items` 为空是正常状态；**不要生成假记录**。

### 7.2 `GET /api/log/self/stat` — 本人区间汇总

与日志列表使用同一时间与筛选参数：

```http
GET /api/log/self/stat?type=2&start_timestamp=1730000000&end_timestamp=1730600000 HTTP/1.1
Authorization: Bearer <管理 JWT>
```

响应结构：[源码确认]

```json
{
  "success": true,
  "message": "",
  "data": {
    "quota": 50000,
    "rpm": 10,
    "tpm": 1500
  }
}
```

| 字段 | 实际语义 | UI 如何使用 |
|---|---|---|
| `quota` | 在指定筛选区间内累计**消费额度** | 用量总计卡片，按站点配额设置格式化 |
| `rpm` | 近期每分钟请求速率 | “当前 RPM”，**不能当累计请求总量** |
| `tpm` | 近期每分钟 Token 速率 | “当前 TPM”，**不能当累计 Token 总量** |

**不要**把单页 `items.length` 当“全站累计请求量”；总体请求次数优先使用 `/api/user/self` 的 `request_count`，筛选区间内若需要精确次数，可在确认过滤一致且 `total` 含义稳定后使用列表 `data.total`。这些指标的统计口径应分别标注。

### 7.3 `GET /api/data/self` — 趋势（P1）

路由存在，但当前文档**未固化其响应字段结构**。先用真实 JWT 只读获取脱敏结果，记录 JSON DTO、时间粒度和是否包含逐日额度。不能先画虚构趋势线；若未确认，V1 显示真实的汇总卡片和日志列表即可。

### 7.4 不用的旧接口

- `GET /api/log/self/search`：控制器已废弃，不调用。
- `GET /api/log/self/export`：如未来开放，返回 **NDJSON 流**（逐行 JSON + 末尾结果行），**不是**一个普通 JSON 数组；本 Demo 暂不做。
- `GET /api/log/token`、`GET /api/usage/token/`：这是**模型 Key** 的用量相关入口，不是替代 `/api/log/self` 的 JWT 个人中心接口。

---

## 8. 配额金额、时间与 Key 格式

### 8.1 内部 quota 与金额

- `GET /api/status` 的 `data.quota_per_unit` 可用于得知实例的单位换算基准（需检查它为正数）。
- 在站点计费遵循 USD 作为基准单位的情况下：`USD 金额 = 内部 quota / quota_per_unit`。
- 若管理员设置了人民币、TOKENS 或自定义显示方式，还要按站点的展示设置和汇率进一步转换；**不要将总额换算和充值价格换算混为一谈**。
- 在字段未确认、配置未取得前，宁可显示 `50000 quota` 或“配额单位待确认”，也不要凭空显示 `$50000` 或 `¥50000`。
- 当 `unlimited_quota=true` 时，Key 的剩余额度区应显示“无限额”，而不是把 `remain_quota=0` 理解为不可用；用户本身的 `quota`、模型/分组限制仍可能生效。

推荐建立单独 `formatQuota(rawQuota, siteConfig)` 模块，所有卡片、表格和图表复用同一换算函数。

### 8.2 时间戳

```ts
export function formatUnixSeconds(seconds: number | null | undefined) {
  if (seconds == null || seconds <= 0) return '—';
  return new Date(seconds * 1000).toLocaleString('zh-CN');
}

export function getUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}
```

**例外**：`expired_time=-1` 表示永久有效，需单独处理；不要把 `-1` 作为普通日期。用户选择“今天结束”时按本地时区选择区间，再转 Unix 秒；避免与 UTC 视图区间混淆。

---

## 9. TypeScript 数据契约参考（前端适配层）

以下类型以当前源码的**主要字段**为准；实际实现建议用 Zod / TypeScript 类型守卫处理缺失值。示例类型的可选成员不代表服务器一定会返回。

```ts
export interface SessionInfo {
  sid: string;
  current?: boolean;
  login_method?: string;
  created_at?: number;
  expires_at?: number;
}

export interface SelfProfile {
  id: number;
  username: string;
  display_name?: string;
  email?: string;
  role?: number;
  status?: number;
  group?: string;
  quota?: number;
  used_quota?: number;
  request_count?: number;
  has_password?: boolean;
  permissions?: Record<string, unknown>;
}

export interface AuthBundleData {
  access_token: string;
  token_type: 'Bearer' | string;
  access_expires_at: number; // Unix 秒
  user: SelfProfile;
  session: SessionInfo;
}

export interface ModelApiToken {
  id: number;
  name: string;
  key?: string;                // 敏感！通常是掩码，不能假定安全
  status: number;
  created_time?: number;
  accessed_time?: number;
  expired_time?: number;       // -1 = 永久有效
  remain_quota?: number;
  used_quota?: number;
  unlimited_quota?: boolean;
  model_limits_enabled?: boolean;
  model_limits?: string;      // 逗号分隔；非 string[]
  allow_ips?: string | null;
  group?: string;
  cross_group_retry?: boolean;
  allow_user_quota_query?: boolean;
}

export interface PageData<T> {
  page: number;
  page_size: number;
  total: number;
  items: T[];
}

export interface UsageLog {
  id: number;
  created_at: number;
  type: number;
  model_name?: string;
  token_name?: string;
  quota?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  use_time?: number;
  is_stream?: boolean;
  group?: string;
  content?: string;
}

export interface UsageStat {
  quota: number;
  rpm: number;
  tpm: number;
}

export interface LoginEncryptionInfo {
  enabled: boolean;
  kid?: string;
  public_key?: string;
}
```

### 9.1 服务函数清单（建议封装）

```ts
// src/lib/api/auth.ts
getLoginEncryptionKey(): Promise<LoginEncryptionInfo>;
loginWithPassword(input: { username: string; password: string }): Promise<AuthBundleData>;
refreshSession(sid?: string): Promise<AuthBundleData>;
logoutSession(sid?: string): Promise<void>;

// src/lib/api/profile.ts
getSelf(): Promise<SelfProfile>;
getUserModels(group?: string): Promise<unknown>;
getSelfGroups(): Promise<unknown>;

// src/lib/api/keys.ts
listKeys(params?: { p?: number }): Promise<PageData<ModelApiToken>>;
getKey(id: number): Promise<ModelApiToken>;
createKey(input: CreateKeyRequest): Promise<void>;
updateKey(input: UpdateKeyRequest): Promise<void>;
setKeyStatus(id: number, status: number): Promise<void>;
deleteKey(id: number): Promise<void>;
revealKey(id: number): Promise<string>;

// src/lib/api/usage.ts
listOwnLogs(filters: UsageLogFilters): Promise<PageData<UsageLog>>;
getOwnUsageStat(filters: UsageLogFilters): Promise<UsageStat>;
```

> 上述是**前端建议函数签名**，不是服务端真实返回的 TypeScript 类型声明。`CreateKeyRequest` / `UpdateKeyRequest` 由实际表单字段独立定义，绝不传入 `key` 原始密钥。

### 9.2 HTTP 客户端约定

- 默认 `credentials: 'include'`，后端同域 Cookie 经 Vite 代理设置/刷新。
- 仅在请求管理 JWT 接口时添加 `Authorization: Bearer <JWT>`；登录/刷新不强制附加已失效 JWT。
- 严禁将模型 `sk-...` Key 当 JWT 使用。
- 处理 `response.ok`、`success`，解析文本 / JSON 异常；返回没有 `data` 时根据当前接口的合同处理，不要通用地抛空指针异常。
- JWT 401 后由**唯一一次**共享 refresh Promise 恢复；成功后最多重试一次**只读**请求，写入请求不可无条件重发。
- 初始化阶段通过 `POST /api/user/auth/refresh` 尝试恢复会话，不能仅凭 `new_api_has_session` 判定已登录。
- 组件不要直接拼接后端 IP，统一通过 `apiClient` 访问 `/api` 相对路径。

---

## 10. 推荐的最小真实联调顺序

> 本文创建时**没有使用测试密码登陆或向公网实例发送带密钥的请求**。下表属于 Claude Code 在用户操作配合下应完成的验收计划，不是已经通过的测试报告。

| 步骤 | 请求 | 自动化能否执行 | 成功标准 |
|---|---|---|---|
| 1 | `GET /api/status` | 可以，匿名 GET | 返回有效 JSON；记录 `quota_per_unit` 等公开字段 |
| 2 | `GET /api/user/login/encryption-key` | 可以，匿名 GET | 确认 `enabled` 与加密登录前置条件 |
| 3 | `POST /api/user/login` | 仅用户在页面手动提交 | 获得真实 `data.access_token` 或明确追加验证挑战 |
| 4 | `GET /api/user/self` | 登录后只读 | 显示 `test1` 的真实资料，不输出整个回包 |
| 5 | `POST /api/user/auth/refresh` | 登录后仅进行必要会话恢复 | JWT 更新，Cookie 轮换，且无无限循环 |
| 6 | `GET /api/token/?p=1` | 登录后只读 | 分页 Key 列表，默认遮罩 |
| 7 | `GET /api/log/self?p=1` | 登录后只读 | 实际记录/真实空数据 |
| 8 | `GET /api/log/self/stat` | 登录后只读 | 显示真实 `quota`、`rpm`、`tpm` |
| 9 | Key 创建 / 编辑 / 启停 / 删除 | **禁止无人确认的自动测试** | UI 表单、确认弹窗与错误处理正确；可由用户手动联调 |
| 10 | 显式读取 Key | 用户点击后执行 | 前端只显示/复制目标 Key，**不泄漏** |
| 11 | 退出 / 页面重载 | 用户交互测试 | 退出后不再可访问保护页面；重载后会话可恢复 |

如实例当前版本较旧，无法匹配本文件的 JWT / Refresh Cookie 约定，**不要盲目兼容旧式 `New-Api-User`**。先将部署版本和差异记录清楚，再由用户决定是否升级后端或开发兼容层。

### 10.1 API 联调记录模板（Claude Code 在项目中另建 `docs/API_CONTRACT.md`）

```md
| 方法 | 路径 | 预期字段 | 实际已确认字段（脱敏） | 结果 | 差异说明 |
|---|---|---|---|---|---|
| GET | /api/status | success, data | ... | 未测试 | ... |
| GET | /api/user/self | id, username, quota | ... | 未测试 | 需先用户登录 |
```

仅保留字段名、类型、状态码、错误码；不复制真实密码、JWT、Cookies、完整 Key、令牌密文或个人隐私值。

---

## 11. 常见坑和禁止事项（Claude Code 必看）

1. **不要把 `New-Api-User` 当成当前版本面板鉴权必需头**。新版面板使用 JWT / PAT；老文档尚未全部更新。
2. **不要用 `sk-...` Key 调用 `/api/user/self`**；也不要用面板 JWT 调用 `/v1/chat/completions`。
3. **不要误删 `/api/token/` 的末尾斜杠**；`GET /api/token/:id` 与 `PUT /api/token/` 不同。
4. **不要假定 `POST /api/token/` 创建时返回完整 Key**；请按读取列表 → 取得 ID → 用户显式揭示的流程。
5. **不要将 `model_limits` 数组直接提交当前 Go 模型**；以逗号字符串和真实接口适配结果为准。
6. **不要在列表加载时自动执行 `/api/token/:id/key`**，即使接口可用也不应该泄露全部密钥。
7. **不要把 RPM / TPM 当累计用量**；`quota` 不等于 Token 数量，也不等于直接美元金额。
8. **不要用 `/api/log/self/search`**；废弃路由不能视为可用搜索 API。
9. **不要用 `GET /api/models/` 构建普通用户模型选择器**；使用 `/api/user/models` 并检查组限制。
10. **不要用 `GET /api/token/search?token=<完整密钥>`** 做默认搜索，避免 URL、日志和监控记录真实 Key。
11. **不要把网络 5xx 当成用户已退出**；只在认证确实失败时清理状态。
12. **不要为了让当前公网 HTTP 通过登录而绕过 Cookie 安全属性、加密或额外验证**。
13. **不要对 `test1` 账号自动做真实写操作或模型付费测试**。
14. **不要把 Mock 数据默认为真实服务成功**；Mock 只在显式开关下运行，并标识“模拟数据”。
15. **不要修改/重启/升级服务器上的 New API**；本轮任务仅实现独立前端 Demo。
16. **不要用 `/api/user/topup/self` 计算历史累计充值**：接口只返回近 30 天订单。VIP 成长值目前用 `quota + used_quota` 估算，含兑换与赠送，需等后端提供累计充值字段（见 `docs/vip.md`）。

---

## 12. 源码与参考链接

优先看仓库源代码；**旧文档的请求头和字段定义可能落后于源码**：

- [New API 项目](https://github.com/QuantumNous/new-api)
- [固定提交：API 注册路由](https://github.com/QuantumNous/new-api/blob/bd6bb53019fb7e21804b31ab7365c9b2097f4b6c/router/api-router.go)
- [当前 API 注册路由](https://github.com/QuantumNous/new-api/blob/main/router/api-router.go)
- [用户登录、个人资料 DTO](https://github.com/QuantumNous/new-api/blob/main/controller/user.go)
- [登录会话与 Refresh 控制器](https://github.com/QuantumNous/new-api/blob/main/controller/auth_session.go)
- [认证设计与 Cookie/Origin 限制](https://github.com/QuantumNous/new-api/blob/main/docs/authentication.md)
- [模型 Key 路由处理](https://github.com/QuantumNous/new-api/blob/main/controller/token.go)
- [模型 Key 数据字段定义](https://github.com/QuantumNous/new-api/blob/main/model/token.go)
- [本人日志及统计控制器](https://github.com/QuantumNous/new-api/blob/main/controller/log.go)
- [额度转换参考](https://github.com/QuantumNous/new-api/blob/main/web/src/lib/currency.ts)
- [公开 Token 管理文档（含旧版示例，**不要复制旧鉴权头**）](https://doc.newapi.pro/api/fei-token-management/)
- [Vite `server.proxy`](https://vite.dev/config/server-options/#server-proxy)

### 交给 Claude Code 的下一条指令

> 请同时阅读 `newapi_frontend_demo_claude_guide.md` 和 `newapi_backend_api_reference_for_claude.md`。以本接口文档作为前端 API 适配层的参考，但以实际后端只读回包为准确认部署版本。先完成 Vite 代理、JWT 登录/Refresh、个人资料和用量只读接口，再开发 API Key CRUD。不得硬编码测试密码，不得自动对真实后端执行写操作，不得打印 JWT/Cookie/完整 Key。遇到字段和版本差异时记录到 `docs/API_CONTRACT.md`，不要伪造成功数据。完成后运行测试、类型检查、构建，并列明已实际联调和未联调的接口。
