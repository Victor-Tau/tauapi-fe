# 邀请与充值返利 · 用户前端对接

适用版本 `v0.1.8`。调用地址以 `https://api.mltvrsai.com` 为例。文中的用户名、邀请码、金额和响应均为示例。

## 1. 接入顺序

1. 进入钱包后读取 `GET /api/user/referral/permissions`。成功拿到权限之前，邀请和返利面板都保持隐藏。
2. `invitation_enabled` 为 `true` 时显示邀请链接和邀请名单。用 `/api/user/self` 取得已有邀请码，用 `/api/user/referral/invitees` 分页加载名单。
3. `rebate_enabled` 为 `true` 时显示当前返利比例，用 `/api/user/referral/rebates` 分页加载明细。两项权限各自控制对应的面板。
4. 钱包余额继续读 `/api/user/self`。在现有充值日志中识别并展示返利记录。

用户端无需提交返利结算请求。满足条件的充值确认后，后端按实付金额和适用比例计算返利并发放到邀请人钱包。

### 公网网关状态

2026-11-21 核对时，公网 `/api/status` 返回 `v0.1.8`，`quota_per_unit` 为 `500000`。下表四个路径在后端已注册，公网请求目前被 Nginx 白名单拦截，返回 `404`。上线前需要由网关维护者添加对应的精确 `GET` 路径。

| 公网待放行路径 | 用途 |
| --- | --- |
| `GET /api/user/referral/permissions` | 钱包权限和生效比例 |
| `GET /api/user/referral/invitees` | 邀请名单 |
| `GET /api/user/referral/rebates` | 返利明细 |
| `GET /api/user/aff` | 获取或生成邀请码。前端使用该接口时需放行 |

公网已放行 `GET /api/user/self`、`GET /api/status`、`GET /api/log/self`、`POST /api/user/register`。白名单放行后，未登录访问新增的用户查询接口应返回 `401`，登录后再按用户权限返回数据。前端应把网关 `404` 当作接口不可用处理。

## 2. 请求和响应约定

- 复用现有控制台登录客户端，发送 `Authorization: Bearer <access_token>`。使用管理访问令牌的客户端需具有相应的 scope，例如邀请与返利查询需要 `wallet:read`，自己的充值日志需要 `usage:read`。
- `GET` 请求无需请求体。返利权限、邀请名单、返利明细均根据登录身份查询。分页请求只需传 `p` 和 `page_size`。
- 同时检查 HTTP 状态和响应体的 `success`。部分业务错误使用 HTTP `200` 和 `success:false`。有 `message_key` 时可结合 `message_params` 翻译，否则展示 `message`。
- 列表页码从 `1` 开始，默认每页 `10` 条，最多 `100` 条。返回的 `page`、`page_size` 为后端采用的值，`total` 为总记录数。空页的 `items` 为 `[]`。两个返利相关列表均按各自的 `id` 降序返回。
- `rate_bps` 是整数基点。换成数值百分数时除以 `100`，交给百分比格式化器时除以 `10000`。例如 `750` 显示为 `7.5%`。
- 时间戳为 Unix 秒，传给 JavaScript 的 `Date` 前乘以 `1000`。

```ts
type ApiSuccess<T> = {
  success: true
  message: string
  data: T
}

type ApiFailure = {
  success: false
  message: string
  message_key?: string
  message_params?: Record<string, unknown>
  code?: string
}

type ApiResult<T> = ApiSuccess<T> | ApiFailure

type Page<T> = {
  page: number
  page_size: number
  total: number
  items: T[]
}
```

## 3. 用户端接口详情

### 3.1 查询邀请与返利权限

```http
GET /api/user/referral/permissions
Authorization: Bearer <access_token>
```

```json
{
  "success": true,
  "message": "",
  "data": {
    "invitation_enabled": true,
    "rebate_enabled": true,
    "rate_bps": 750
  }
}
```

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `invitation_enabled` | `boolean` | 是否可以邀请新用户并查看邀请名单 |
| `rebate_enabled` | `boolean` | 是否可以查看返利明细并参与后续符合条件的返利 |
| `rate_bps` | `number`，可选 | 当前生效比例。返利开启时返回，显式 `0` 表示当前比例为 `0%` |

```ts
type ReferralPermissions = {
  invitation_enabled: boolean
  rebate_enabled: boolean
  rate_bps?: number
}
```

关闭邀请权限后，已发出的链接停止建立新的邀请关系。返利权限独立，已建立关系的后续返利按返利开关结算。关闭返利后，返利明细接口会返回 `403`，已入账余额保留。

### 3.2 获取或生成邀请码

优先读取已接入的 `GET /api/user/self` 中的 `data.aff_code`。有邀请权限且该字段为空时，可调用下面的接口。它会为没有邀请码的用户生成邀请码。

```http
GET /api/user/aff
Authorization: Bearer <access_token>
```

```json
{
  "success": true,
  "message": "",
  "data": "ABCD"
}
```

使用用户前端自己的注册页地址生成邀请链接。以下示例使用 `/sign-up`。

```ts
const invitationUrl = new URL('/sign-up', window.location.origin)
invitationUrl.searchParams.set('aff', affiliateCode)
```

注册页面读取 URL 中的 `aff`。如果流程会先展示验证或其他步骤，应保留该值到注册提交时。在现有 `POST /api/user/register` 的 JSON 请求体中增加 `aff_code`，其余字段沿用现有注册流程。

```ts
const affiliateCode = new URL(window.location.href).searchParams.get('aff')
const requestBody = {
  ...registrationFields,
  ...(affiliateCode ? { aff_code: affiliateCode } : {}),
}
```

邀请码查询被权限拒绝时返回 HTTP `403`，`message_key` 为 `Invitation access is disabled`。

### 3.3 分页查询邀请名单

```http
GET /api/user/referral/invitees?p=1&page_size=10
Authorization: Bearer <access_token>
```

```json
{
  "success": true,
  "message": "",
  "data": {
    "page": 1,
    "page_size": 10,
    "total": 1,
    "items": [
      { "id": 42, "username": "alice", "email": "a***e@example.com" }
    ]
  }
}
```

`id` 是被邀请人的用户 ID，可作为表格行键。邮箱已经由服务端脱敏，直接按文本显示。没有可展示的邮箱时返回 `""`，界面可显示 `—`。邀请权限关闭时，本接口返回 HTTP `403`，`message_key` 为 `Invitation access is disabled`。

```ts
type ReferralInvitee = {
  id: number
  username: string
  email: string
}

type InviteesResponse = ApiResult<Page<ReferralInvitee>>
```

### 3.4 分页查询返利明细

```http
GET /api/user/referral/rebates?p=1&page_size=10
Authorization: Bearer <access_token>
```

```json
{
  "success": true,
  "message": "",
  "data": {
    "page": 1,
    "page_size": 10,
    "total": 1,
    "items": [
      {
        "id": 73,
        "username": "alice",
        "paid_amount": "20",
        "paid_currency": "USD",
        "rate_bps": 750,
        "rebate_quota": 750000,
        "created_at": 1795291200,
        "credited_at": 1795291200
      }
    ]
  }
}
```

| 字段 | 类型 | 显示方式 |
| --- | --- | --- |
| `id` | `number` | 返利记录 ID，可作为表格行键 |
| `username` | `string` | 被邀请人的用户名 |
| `paid_amount` | `string` | 实付金额的十进制字符串，例如 `"20"`、`"7.35"` |
| `paid_currency` | `string` | 实付币种，例如 `USD`、`CNY`，与实付金额一起显示 |
| `rate_bps` | `number` | 这笔订单结算时使用的比例，作为历史行的显示值 |
| `rebate_quota` | `number` | 已计算的返利钱包额度，可按站点钱包显示规则格式化 |
| `created_at` | `number` | 充值完成时间 |
| `credited_at` | `number` | 返利到账时间，`0` 表示尚无到账时间 |
| `exchange_rate_pending` | `boolean`，可选 | `true` 表示等待汇率，其他情况字段通常省略 |

推荐按以下顺序判断状态。

```ts
type ReferralRebate = {
  id: number
  username: string
  paid_amount: string
  paid_currency: string
  rate_bps: number
  rebate_quota: number
  created_at: number
  credited_at: number
  exchange_rate_pending?: boolean
}

type RebatesResponse = ApiResult<Page<ReferralRebate>>

function getRebateStatus(row: ReferralRebate) {
  if (row.credited_at > 0) return '已到账'
  if (row.exchange_rate_pending === true) return '待汇率'
  if (row.rebate_quota > 0) return '待入账'
  return '—'
}
```

美元等值可用 `rebate_quota / quota_per_unit` 得到，`quota_per_unit` 读自 `GET /api/status` 的 `data`。以示例中的单位计算，`750000` 额度对应 `1.50 USD`。实付金额按原支付币种展示。返利金额以接口返回的额度为准，前端计算仅用于展示。返利权限关闭时，本接口返回 HTTP `403`，`message_key` 为 `Rebate access is disabled`。

## 4. 钱包余额和充值日志

`GET /api/user/self` 的 `data.quota` 供钱包余额使用。到账后可刷新该接口。原有的 `aff_quota` 和 `aff_history_quota` 对应邀请注册返利。充值返利直接增加钱包余额。

使用已有的充值日志接口读取返利入账记录。

```http
GET /api/log/self?p=1&page_size=10&type=1
Authorization: Bearer <access_token>
```

`type=1` 会返回充值、返利等充值类记录。返利行的 `request_id` 以 `referral-rebate-` 开头，例如 `referral-rebate-73` 对应返利记录 `73`。一条日志中的相关字段如下，其余字段沿用现有日志结构。

```json
{
  "type": 1,
  "created_at": 1795291200,
  "request_id": "referral-rebate-73",
  "content": "Referral rebate / Invited user alice / ＄1.500000",
  "other": "{\"referral_rebate_quota\":750000,\"content_parts\":[{\"key\":\"Referral rebate / Invited user {{username}} / {{quota}}\",\"params\":{\"username\":\"alice\",\"quota\":\"＄1.500000\"}}]}"
}
```

1. 先用 `request_id` 识别返利行。
2. 对 `other` 做一次 JSON 解析，数值额度读取 `referral_rebate_quota`。
3. 用 `content_parts[].key` 和 `content_parts[].params` 渲染文案。中文模板为「邀请返利 / 被邀用户 {{username}} / {{quota}}」。`params.quota` 已格式化，可直接展示。旧日志缺少结构化字段、解析失败或缺少翻译时可回退到 `content`。

## 5. 联调检查

| 场景 | 预期行为 |
| --- | --- |
| 权限请求加载中 | 等待权限结果再显示面板 |
| 两项权限都关闭 | 隐藏两块面板和邀请链接，无需发起列表请求 |
| 仅邀请开启 | 显示链接和邀请名单，名单里的邮箱已脱敏 |
| 仅返利开启 | 显示当前比例和返利明细 |
| 当前比例为 `0` | 返利面板仍可显示比例 `0%` |
| 列表为空 | 根据空的 `items` 显示空状态 |
| 列表接口返回 `403` | 刷新权限，根据新结果更新面板 |
| 接口返回 `401` | 交给现有登录刷新或会话失效流程处理 |
| 接口返回公网 `404` | 检查精确方法和路径是否在网关白名单 |
| 返利已到账 | 明细中 `credited_at > 0`，刷新后可在钱包余额和 `type=1` 充值日志看到入账 |

使用请求缓存时，把当前用户 ID 和分页参数纳入查询键。切换账号或退出后，应清理或隔离旧账号的邀请与返利数据。

## 代码参考

- [用户路由](../router/api-router.go#L122) · [权限与分页处理](../controller/referral.go#L19) · [邀请和返利数据结构](../model/referral.go#L31)
- [钱包权限查询](../web/src/features/wallet/hooks/use-affiliate.ts#L43) · [名单与返利表格示例](../web/src/features/wallet/components/referral-details.tsx#L48)
- [用户资料余额字段](../controller/user.go#L544) · [站点额度单位](../controller/misc.go#L77) · [返利日志写入](../model/referral.go#L285)
