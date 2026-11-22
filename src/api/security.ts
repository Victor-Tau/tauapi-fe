import { z } from 'zod'
import { ApiError, errorMessage } from './errors'
import { encryptedPasswordFields } from './password'
import { apiClient } from './request'
import { encryptionSchema, parseData } from './schema'

/** Step-up scopes used by the account settings page. */
export type VerificationScope =
  | 'account.password.change'
  | 'account.binding.bind'
  | '2fa.setup'
  | '2fa.disable'
  | '2fa.backup_codes.regenerate'
export type VerificationMethod = 'password' | '2fa' | 'passkey' | 'oauth'

const methodsSchema = z.object({
  methods: z.array(z.object({
    method: z.string(),
    available: z.boolean(),
    reason: z.string().optional(),
  })).nullable().transform((methods) => methods ?? []),
  password_encryption_enabled: z.boolean().optional(),
})

export type VerificationRequirements = z.infer<typeof methodsSchema>

/** Which factors the server accepts for `scope` (2FA/Passkey replace the password once enrolled). */
export async function getVerificationMethods(scope: VerificationScope, signal?: AbortSignal) {
  return parseData(methodsSchema, await apiClient.request(`/api/verify/methods?scope=${encodeURIComponent(scope)}`, { signal }), '验证方式')
}

/**
 * Bind-email proofs carry the normalised address as context; the server
 * lower-cases and trims it the same way before comparing.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const proofSchema = z.object({ proof_token: z.string().min(1) })

/**
 * One-time X-Security-Proof (valid for about a minute) for a single action.
 * Never retried: a proof is consumed by the action it was issued for.
 */
export async function requestProof(input: {
  scope: VerificationScope
  method: VerificationMethod
  context?: Record<string, string>
  password?: string
  code?: string
}): Promise<string> {
  const body: Record<string, unknown> = { scope: input.scope, method: input.method }
  if (input.context) body.context = input.context
  if (input.method === 'password') {
    if (!input.password) throw new ApiError('请输入当前登录密码。', 400, 'VALIDATION_ERROR')
    const config = parseData(encryptionSchema, await apiClient.request('/api/user/login/encryption-key', { auth: false }), '密码加密配置')
    Object.assign(body, await encryptedPasswordFields(input.password, config))
  } else if (input.method === '2fa') {
    if (!input.code?.trim()) throw new ApiError('请输入验证码。', 400, 'VALIDATION_ERROR')
    body.code = input.code.trim()
  } else {
    throw new ApiError('当前页面暂不支持该验证方式。', 400, 'SECURITY_METHOD_UNSUPPORTED')
  }
  return parseData(proofSchema, await apiClient.request('/api/verify', { method: 'POST', body }), '安全验证').proof_token
}

const passwordChangeSchema = z.object({ notification_warning: z.boolean().optional() }).passthrough()

/**
 * PUT /api/user/self with a new password. The server signs every other
 * session out and returns new credentials for this one.
 */
export async function changePassword(input: { current: string; next: string; proof: string }) {
  const data = await apiClient.request('/api/user/self', {
    method: 'PUT',
    proof: input.proof,
    body: { password: input.next, original_password: input.current },
  })
  await apiClient.applyRotation(data, { has_password: true })
  const parsed = passwordChangeSchema.safeParse(data)
  return { notificationWarning: parsed.success && parsed.data.notification_warning === true }
}

const emailBindingSchema = z.object({
  flow_token: z.string().min(1),
  email: z.string(),
  current_email: z.string().optional(),
  old_email_required: z.boolean().optional(),
  expires_at: z.number().int().optional(),
  resend_at: z.number().int().optional(),
  notification_warning: z.boolean().optional(),
})

export type EmailBinding = z.infer<typeof emailBindingSchema>

/** Sends a code to the new address (and, when replacing one, to the old address). */
export async function startEmailBinding(email: string, proof: string): Promise<EmailBinding> {
  return parseData(emailBindingSchema, await apiClient.request('/api/oauth/email/bind/start', {
    method: 'POST', proof, body: { email: normalizeEmail(email) },
  }), '邮箱绑定')
}

export async function resendEmailBinding(flowToken: string): Promise<EmailBinding> {
  return parseData(emailBindingSchema, await apiClient.request('/api/oauth/email/bind/resend', {
    method: 'POST', body: { flow_token: flowToken },
  }), '邮箱绑定')
}

export async function finishEmailBinding(input: { flowToken: string; newCode: string; oldCode?: string }) {
  await apiClient.request('/api/oauth/email/bind', {
    method: 'POST',
    body: { flow_token: input.flowToken, new_code: input.newCode.trim(), old_code: input.oldCode?.trim() ?? '' },
  })
}

const twoFAStatusSchema = z.object({
  enabled: z.boolean(),
  locked: z.boolean().optional(),
  backup_codes_remaining: z.number().int().nonnegative().optional(),
})

export type TwoFAStatus = z.infer<typeof twoFAStatusSchema>

export async function getTwoFAStatus(signal?: AbortSignal) {
  return parseData(twoFAStatusSchema, await apiClient.request('/api/user/2fa/status', { signal }), '两步验证状态')
}

const twoFASetupSchema = z.object({
  secret: z.string().min(1),
  qr_code_data: z.string().min(1),
  backup_codes: z.array(z.string()).nullable().transform((codes) => codes ?? []),
  flow_token: z.string().min(1),
  expires_at: z.number().int().optional(),
})

export type TwoFASetup = z.infer<typeof twoFASetupSchema>

/** Starts enrolment: a new TOTP secret and backup codes, not active until confirmed. */
export async function startTwoFASetup(proof: string): Promise<TwoFASetup> {
  return parseData(twoFASetupSchema, await apiClient.request('/api/user/2fa/setup', { method: 'POST', proof }), '两步验证设置')
}

/** Confirms enrolment with a code from the app; other sessions are signed out. */
export async function enableTwoFA(flowToken: string, code: string) {
  const data = await apiClient.request('/api/user/2fa/enable', {
    method: 'POST', body: { flow_token: flowToken, code: code.trim() },
  })
  await apiClient.applyRotation(data)
}

export async function disableTwoFA(proof: string) {
  const data = await apiClient.request('/api/user/2fa/disable', { method: 'POST', proof })
  await apiClient.applyRotation(data)
}

const backupCodesSchema = z.object({ backup_codes: z.array(z.string()).min(1) }).passthrough()

/** Replaces every backup code; the old ones stop working. */
export async function regenerateBackupCodes(proof: string): Promise<string[]> {
  const data = await apiClient.request('/api/user/2fa/backup_codes', { method: 'POST', proof })
  const codes = parseData(backupCodesSchema, data, '备用码').backup_codes
  await apiClient.applyRotation(data)
  return codes
}

/** Server errors are already translated in api/messages.ts; kept for call sites. */
export function securityErrorMessage(error: unknown): string {
  return errorMessage(error)
}
