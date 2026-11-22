/**
 * Chinese text for server errors. The backend answers many failures with
 * fixed English text: a stable `code` (security/auth), or a `message_key`
 * (its English source text, with `message_params`), or just the English
 * `message`. Nothing English from the server reaches the user.
 */

const CODE_MESSAGES: Record<string, string> = {
  // Security verification and account changes
  CURRENT_PASSWORD_INVALID: "当前登录密码不正确。",
  PASSWORD_POLICY_REJECTED: "新密码不符合要求（8–128 个字符，且不能与当前登录密码相同）。",
  SECURITY_VERIFICATION_FAILED: "验证失败：当前登录密码或验证码不正确。",
  SECURITY_VERIFICATION_LOCKED: "验证失败次数过多，请稍后再试。",
  SECURITY_VERIFICATION_FLOW_REQUIRED: "该验证方式需要单独的验证流程，当前页面暂不支持。",
  TWOFA_CODE_INVALID: "验证码不正确。",
  TWOFA_SETUP_INVALID: "两步验证设置已过期或已变化，请重新开始。",
  TWOFA_ALREADY_ENABLED: "两步验证已启用。",
  TWOFA_NOT_ENABLED: "两步验证尚未启用。",
  SECURITY_PROOF_REQUIRED: "需要先完成安全验证。",
  SECURITY_PROOF_EXPIRED: "安全验证已过期，请重新提交。",
  SECURITY_PROOF_INVALID: "安全验证已失效，请重新提交。",
  SECURITY_PROOF_CONSUMED: "安全验证已被使用，请重新提交。",
  SECURITY_PROOF_SCOPE_MISMATCH: "安全验证与本次操作不匹配，请重新提交。",
  SECURITY_PROOF_CONTEXT_MISMATCH: "安全验证与本次操作不匹配，请重新提交。",
  SECURITY_PROOF_METHOD_MISMATCH: "该验证方式不适用于本次操作。",
  SECURITY_METHOD_UNAVAILABLE: "该验证方式当前不可用。",
  SECURITY_ACTION_FORBIDDEN: "当前账户不允许执行此操作。",
  SECURITY_CONTEXT_INVALID: "请求内容无效，请检查后重试。",
  ACCOUNT_SECURITY_STATE_CHANGED: "账户安全状态已变化，请刷新页面后重试。",
  LAST_LOGIN_METHOD: "请先添加其他登录方式，再解除此绑定。",
  ACCOUNT_ALREADY_BOUND: "该外部账户已被绑定。",
  OAUTH_ACCOUNT_MISMATCH: "第三方账户与当前账户绑定的不一致。",
  PASSKEY_NOT_FOUND: "尚未注册 Passkey。",
  PASSKEY_RP_ID_UNAVAILABLE: "该 Passkey 不能在本网站使用，请换用其他验证方式。",
  EMAIL_ADDRESS_REJECTED: "该邮箱地址不可用（格式错误或不在允许的域名内）。",
  EMAIL_ALREADY_TAKEN: "该邮箱已被其他账户使用。",
  EMAIL_BINDING_DELIVERY_FAILED: "验证邮件发送失败，请稍后重试或联系管理员。",
  EMAIL_BINDING_CODE_INVALID: "邮箱验证码不正确。",
  EMAIL_BINDING_LOCKED: "验证码错误次数过多，请重新开始绑定。",
  EMAIL_BINDING_RESEND_WAIT: "发送过于频繁，请稍后再重新发送。",
  AUTH_FLOW_INVALID: "验证流程已过期，请重新开始。",
  // Sessions and credentials
  AUTH_INTERNAL_ERROR: "服务器内部错误，请稍后重试。",
  AUTH_ORIGIN_FORBIDDEN: "请求来源不被允许，请通过官方网址访问。",
  AUTH_SESSION_ID_REQUIRED: "缺少会话 ID。",
  AUTH_SESSION_NOT_FOUND: "该登录会话不存在或已退出。",
  AUTH_SESSION_REQUIRED: "需要使用控制台登录会话执行此操作。",
  AUTH_SESSION_LIMIT: "登录设备数已达上限，请先在其他设备上退出。",
  AUTH_SESSION_ISSUANCE_LIMIT: "登录过于频繁，请稍后再试。",
  AUTH_SESSION_MISMATCH: "登录状态已在其他页面变更，请刷新页面。",
  AUTH_REFRESH_RACE: "登录状态正在刷新，请重试。",
  AUTH_TOKEN_EXPIRED: "登录已过期，请重新登录。",
  AUTH_SESSION_REVOKED: "该登录会话已被退出，请重新登录。",
  AUTH_UNAUTHORIZED: "登录已失效，请重新登录。",
  AUTH_USER_DISABLED: "账户已被封禁。",
  ACCESS_TOKEN_EXPIRED: "访问令牌已过期。",
  ACCESS_TOKEN_LEGACY_RETIRED: "旧版访问令牌已停用，请在安全设置中创建新的访问令牌。",
  ACCESS_TOKEN_SCOPE_DENIED: "访问令牌没有执行此操作的权限。",
}

/** English source text (message_key or plain message) → Chinese; `{{name}}` takes message_params. */
const KEY_MESSAGES: Record<string, string> = {
  // General
  "Database error, please contact the administrator": "数据库错误，请联系管理员。",
  "Invalid parameters": "请求参数无效。",
  "Invalid request": "请求无效。",
  "Invalid request parameter format": "请求参数格式无效。",
  "Invalid input": "输入内容无效，请检查后重试。",
  "Invalid input {{error}}": "输入内容无效，请检查后重试。",
  "Invalid ID": "ID 无效。",
  "ID is empty": "ID 不能为空。",
  "ID is empty!": "ID 不能为空。",
  "Update failed": "更新失败，请稍后重试。",
  "Unsupported operation": "不支持该操作。",
  "This API is deprecated": "该接口已停用。",
  "Too many items in batch request, maximum is {{max}}": "批量操作数量过多，最多 {{max}} 项。",
  "Please try again later.": "请稍后重试。",
  "Not implemented yet": "该功能暂未开放。",
  // Sign-in and authorization
  "Password login has been disabled by administrator": "管理员已关闭密码登录。",
  "Username or password is incorrect, or user has been banned": "用户名或密码错误，或账户已被封禁。",
  "User has been banned": "账户已被封禁。",
  "User has been deleted": "账户已被注销。",
  "This user account is disabled.": "该账户已被停用。",
  "User does not exist": "用户不存在。",
  "Invalid user ID": "用户 ID 无效。",
  "Not logged in": "尚未登录，请先登录。",
  "No Authorization header": "尚未登录，请先登录。",
  "Invalid Bearer token": "登录凭据无效，请重新登录。",
  "Unauthorized, insufficient privileges": "权限不足，无法执行此操作。",
  "Unauthorized, invalid access token": "登录凭据无效，请重新登录。",
  "Unauthorized, invalid user info": "用户信息无效，请重新登录。",
  "Unauthorized, not logged in and no access token provided": "尚未登录，请先登录。",
  "Unauthorized, the access token has expired": "登录已过期，请重新登录。",
  "Legacy access tokens have been retired. Create a new access token in security settings":
    "旧版访问令牌已停用，请在安全设置中创建新的访问令牌。",
  "The access token lacks the required permission: {{scope}}": "访问令牌缺少所需权限：{{scope}}。",
  "The current sign-in method does not support security verification": "当前登录方式不支持安全验证。",
  "Turnstile token is empty": "请先完成人机验证。",
  "Turnstile verification failed, please refresh and try again!": "人机验证失败，请重新验证后重试。",
  // Registration, email and password reset
  "New user registration has been disabled by administrator": "管理员已关闭新用户注册。",
  "Password registration has been disabled by administrator, please use third-party account verification":
    "管理员已关闭密码注册，请使用第三方账户注册。",
  "Email verification is enabled, please enter email address and verification code": "请填写邮箱和邮箱验证码。",
  "Verification code is incorrect or has expired": "验证码错误或已过期。",
  "Email address is already in use": "该邮箱已被使用。",
  "Username already exists or has been deleted": "用户名已存在或已被注销。",
  "Username must be {{max}} characters or fewer": "用户名最多 {{max}} 个字符。",
  "User registration failed or user ID retrieval failed": "注册失败，请稍后重试。",
  "Failed to generate default token": "账户已创建，但默认密钥生成失败。",
  "Failed to create default token": "账户已创建，但默认密钥创建失败。",
  "Invalid email address": "邮箱地址无效。",
  "Please enter a valid email address": "请输入有效的邮箱地址。",
  "This email address is not allowed by the administrator's email policy.": "该邮箱不在管理员允许的范围内。",
  "Please wait before requesting another verification code.": "请求过于频繁，请稍后再获取验证码。",
  "Please wait {{seconds}} seconds before requesting another verification code.": "请 {{seconds}} 秒后再获取验证码。",
  "Password reset link is invalid or has expired": "密码重置链接无效或已过期。",
  "Passwords do not match": "两次输入的密码不一致。",
  // Two-factor
  "Two-factor authentication is not enabled.": "两步验证尚未启用。",
  "Failed to regenerate backup codes": "备用码重新生成失败，请稍后重试。",
  "Failed to save backup codes": "备用码保存失败，请稍后重试。",
  // Keys
  "A token can select at most {{max}} Auto groups": "每个密钥最多选择 {{max}} 个自动分组。",
  "Auto group {{group}} is duplicated": "自动分组 {{group}} 重复。",
  "Auto group {{group}} is unavailable or unauthorized": "自动分组 {{group}} 不可用或无权使用。",
  "Token name is too long": "密钥名称过长。",
  "Quota value cannot be negative": "额度不能为负数。",
  "Quota value exceeds valid range, maximum is {{max}}": "额度超出有效范围，最大为 {{max}}。",
  "Maximum number of tokens reached ({{max}})": "密钥数量已达上限（{{max}} 个）。",
  "Failed to generate token": "密钥生成失败，请稍后重试。",
  "Token has expired and cannot be enabled. Please modify the expiration time or set it to never expire":
    "密钥已过期，无法启用。请修改过期时间或设为永不过期。",
  "Token quota is exhausted and cannot be enabled. Please modify the remaining quota or set it to unlimited":
    "密钥额度已用尽，无法启用。请修改剩余额度或设为不限额度。",
  "Token ID or user ID is empty": "密钥 ID 不能为空。",
  "Token IDs cannot be empty": "密钥 ID 不能为空。",
  "Expiration time cannot be earlier than current time": "过期时间不能早于当前时间。",
  "Failed to search tokens": "搜索密钥失败，请稍后重试。",
  "Failed to get the token count": "获取密钥数量失败，请稍后重试。",
  "Token count exceeds the limit. Only exact search is allowed, do not use the % wildcard":
    "密钥数量较多，仅支持精确搜索，请勿使用 % 通配符。",
  "Fuzzy search keywords must be at least 2 characters long": "模糊搜索关键词至少需要 2 个字符。",
  "The search pattern can contain at most 2 % wildcards": "搜索条件最多包含 2 个 % 通配符。",
  "The search pattern cannot contain consecutive % wildcards": "搜索条件不能包含连续的 % 通配符。",
  // Usage logs and statistics
  "Failed to query logs": "查询日志失败，请稍后重试。",
  "Failed to query statistics": "查询统计数据失败，请稍后重试。",
  "The time range cannot exceed {{days}} days": "时间范围不能超过 {{days}} 天。",
  "invalid start_timestamp": "开始时间无效。",
  "invalid end_timestamp": "结束时间无效。",
  "invalid time range": "时间范围无效。",
  "Log export is disabled": "日志导出功能已关闭。",
  "Failed to export logs": "日志导出失败，请稍后重试。",
  "Another log export is running. Try again after it finishes.": "已有日志导出正在进行，请完成后再试。",
  // Wallet
  "Payment, redemption, subscription, and invitation reward features are disabled. The administrator must confirm compliance terms before enabling them.":
    "充值、兑换、订阅和邀请返利功能暂未开放。",
  "Invitation access is disabled": "邀请功能已关闭。",
  "Rebate access is disabled": "返利功能已关闭。",
  "Top-up is processing, please try again later": "充值正在处理中，请稍后再试。",
  "Redemption failed, please try again later": "兑换失败，请检查兑换码是否正确、未使用且未过期。",
  "Insufficient balance": "余额不足。",
  "Invalid top-up amount": "充值金额无效。",
  "Top-up amount cannot be less than {{min}}": "充值金额不能低于 {{min}}。",
  "Top-up amount cannot exceed {{max}}": "充值金额不能超过 {{max}}。",
  "Payment information has not been configured by administrator": "管理员尚未配置支付信息。",
  "Payment method does not exist": "支付方式不存在。",
  "Payment amount is too low": "支付金额过低。",
  "Failed to create order": "订单创建失败，请稍后重试。",
  "Failed to start payment": "发起支付失败，请稍后重试。",
  "Failed to get the user group": "获取用户分组失败，请稍后重试。",
  "get user group failed": "获取用户分组失败，请稍后重试。",
}

const HAN = /[㐀-鿿]/

/** Whether text is already written for Chinese readers. */
export function isChinese(text: string): boolean {
  return HAN.test(text)
}

/** A Chinese message for a bare HTTP status, when the server text is unusable. */
export function statusMessage(status: number): string {
  if (status === 400) return "请求参数有误，请检查后重试。"
  if (status === 401) return "登录已失效，请重新登录。"
  if (status === 403) return "没有权限执行此操作。"
  if (status === 404) return "请求的内容不存在。"
  if (status === 409) return "数据已发生变化，请刷新后重试。"
  if (status === 413) return "提交的内容过大。"
  if (status === 429) return "请求过于频繁，请稍后再试。"
  if (status >= 500) return "服务器暂时不可用，请稍后重试。"
  return "操作失败，请稍后重试。"
}

function fill(template: string, params: Record<string, unknown> | undefined): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = params?.[name]
    return typeof value === "string" || typeof value === "number" ? String(value) : match
  })
}

/** The Chinese message for a failed server response. */
export function serverErrorMessage(input: {
  status: number
  code?: string
  key?: string
  params?: Record<string, unknown>
  message: string
}): string {
  if (input.code && CODE_MESSAGES[input.code]) return CODE_MESSAGES[input.code]
  const template = (input.key && KEY_MESSAGES[input.key]) || KEY_MESSAGES[input.message.trim()]
  if (template) return fill(template, input.params)
  if (input.message && isChinese(input.message)) return input.message
  return statusMessage(input.status)
}
