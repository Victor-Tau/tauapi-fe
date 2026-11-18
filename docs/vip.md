# VIP 充值成长（前端 Demo）

本文记录 `/wallet` 页 VIP 卡片的等级设计、成长值规则、已核对的充值接口与后端待办。接口总览见 `newapi_backend_api_reference_for_claude.md`。

位于 `/wallet`（2026-11-17 从 `/profile` 移来；最初在 `/profile` 替换了「基本信息」「额度与用量」两张卡片）。相关文件：

- `src/utils/vip.ts`：等级表、成长值、进度计算、分组判断
- `src/pages/wallet/vip-card.tsx`：卡片（进度、等级阶梯、最近充值流水）
- `src/pages/profile/vip-badges.tsx`：等级图标与徽章（`VipBadge`、`GroupBadge`、`TierIcon`）
- `src/api/user.ts` 的 `getOwnTopUps`，hook 为 `useOwnTopUps`，query key 为 `queryKeys.topUps`

### 等级表（前端写死，待后端下发）

| 等级 | 分组 key | 累计门槛（站点充值单位） | 充值倍率 | 返利 | 图标 |
|---|---|---|---|---|---|
| VIP0 入门 | `default` | 0 | 1 | 无 | 幼苗 `SproutIcon` |
| VIP1 青铜 | `vip1` | 500 | 0.99 | 1% | 奖牌 `MedalIcon` |
| VIP2 白银 | `vip2` | 2,000 | 0.97 | 3% | 勋章 `AwardIcon` |
| VIP3 黄金 | `vip3` | 5,000 | 0.95 | 5% | 奖杯 `TrophyIcon` |
| VIP4 铂金 | `vip4` | 20,000 | 0.92 | 8% | 宝石 `GemIcon` |
| VIP5 钻石 | `vip5` | 50,000 | 0.90 | 10% | 皇冠 `CrownIcon` |

- 倍率对应后端 `TopupGroupRatio`：实付 = 充值金额 × `Price` × 倍率（`controller/topup.go`）。
- 特殊分组 `大学生优惠` 使用学位帽图标（`GraduationCapIcon`），与等级互不影响。

### 成长值与分组规则

- **成长值**（demo 估算）：`(quota + used_quota) / quota_per_unit`，即累计到账额度。这包含兑换码和管理员加额度，**不是真实的累计充值**。
- **等级判定**：`user.group` 是 `default` 或 `vipN` 时，以分组为准（后端自动分组上线后的预期行为）；否则按成长值计算等级，分组只显示为独立徽章。
- 当前 `test1`（分组 `大学生优惠`，成长值约 ¥8）显示为 VIP0 + 大学生优惠。

### 后端待办（前端契约）

1. **自动分组**：充值到账后按累计充值把 `user.group` 改为对应 `vipN`。未决问题：VIP 分组与 `大学生优惠` 等特殊分组如何共存（`user.group` 是单值，改成 `vipN` 会丢失特殊分组的模型倍率）。
2. **累计充值字段**：建议在 `/api/user/self` 返回到账总额（如 `topup_total`），替换 `growthAmount` 的估算。
3. **等级表下发**：建议由 `/api/status` 或 `/api/user/topup/info` 返回门槛和倍率，前端删除 `VIP_TIERS` 中写死的数值。

### 已核对的充值接口（test1，只读）

- `GET /api/user/topup/self?p=&page_size=`：**只返回近 30 天**的订单（`model/topup.go` 的 `topUpQueryWindowSeconds`）。字段：`id`、`amount`（充值额，站点单位）、`money`（实付）、`payment_method`、`payment_provider`、`create_time`、`complete_time`、`status`。线上已见 `pending`；到账状态为后端常量 `TopUpStatusSuccess`，前端按 `success` 过滤。
- `GET /api/user/topup/info`：返回 `amount_options`、`min_topup`、`pay_methods`、`discount` 等，本次 demo 未使用。
- `GET /api/log/self?type=1`：充值类日志（兑换、管理员加额度等），受 `log_max_range_days`（线上为 7 天）限制，本次未使用。
