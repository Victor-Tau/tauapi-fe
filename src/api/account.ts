import { z } from 'zod'
import { apiClient } from './request'
import { parseData } from './schema'
import { queryString } from './shared'

/** Mails a 6-digit code for registration (only when email verification is on). */
export async function sendRegisterCode(email: string) {
  await apiClient.request(`/api/verification${queryString({ email })}`, { auth: false })
}

export interface RegisterInput {
  username: string
  password: string
  email?: string
  verification_code?: string
  /** Inviter's affiliate code, from `?aff=`. */
  aff_code?: string
}

/** Creates the account; it does not sign in. */
export async function registerAccount(input: RegisterInput) {
  await apiClient.request('/api/user/register', { method: 'POST', auth: false, body: input })
}

/** Always succeeds, so it never reveals whether the address has an account. */
export async function sendPasswordReset(email: string) {
  await apiClient.request(`/api/reset_password${queryString({ email })}`, { auth: false })
}

/** Consumes the mailed link; the server sets and returns a random new password. */
export async function confirmPasswordReset(email: string, token: string) {
  return parseData(
    z.string().min(1),
    await apiClient.request('/api/user/reset', { method: 'POST', auth: false, body: { email, token } }),
    '重置密码'
  )
}
