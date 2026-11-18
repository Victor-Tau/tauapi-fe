/** Display text for a user's account status. */
export function statusText(status?: number) {
  if (status === 1) return "正常"
  if (status === 2) return "已停用"
  if (status === undefined) return "未提供"
  return `状态 ${status}`
}

// new-api conventions for user roles.
const ROLE_NAMES: Record<number, string> = {
  1: "普通用户",
  10: "管理员",
  100: "超级管理员",
}

export function roleText(role?: number) {
  if (role === undefined) return "未提供"
  return ROLE_NAMES[role] ?? String(role)
}
