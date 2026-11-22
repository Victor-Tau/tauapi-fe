import type { LoginInput, SelfProfile } from '@/types/api'
import { ApiError, asApiError } from './errors'
import { serverErrorMessage } from './messages'
import { authBundleSchema, encryptionSchema, parseData, rotationSchema, type AuthBundle } from './schema'
import { encryptedPasswordFields } from './password'
import { queryString } from './shared'

export { ApiError, errorMessage } from './errors'

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface AuthState {
  status: 'loading' | 'authenticated' | 'anonymous' | 'error'
  user: SelfProfile | null
  error: ApiError | null
}

interface RequestOptions {
  method?: Method
  body?: unknown
  signal?: AbortSignal
  auth?: boolean
  /** Return the whole response object, for endpoints with fields beside `data`. */
  envelope?: boolean
  /** One-time `X-Security-Proof` from POST /api/verify, for step-up actions. */
  proof?: string
}

/** A password login either finishes or asks for a second factor. */
export type LoginResult =
  | { kind: 'done' }
  | { kind: 'challenge'; flowToken: string; expiresAt?: number }

interface Envelope {
  success: boolean
  message?: string
  code?: string
  data?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The one place that owns credentials. It never uses Web Storage. */
export class ApiClient {
  private bundle: AuthBundle | null = null
  private snapshot: AuthState = { status: 'loading', user: null, error: null }
  private listeners = new Set<() => void>()
  private identityListeners = new Set<() => void>()
  private refreshFlight: Promise<void> | null = null
  private restoreFlight: Promise<void> | null = null
  private loginFlight: Promise<LoginResult> | null = null
  private logoutFlight: Promise<void> | null = null
  private authQueue: Promise<void> = Promise.resolve()
  private restored = false
  private generation = 0
  private identityRevision = 0
  private bundleGeneration = -1
  private readonly fetcher: FetchLike
  private readonly timeoutMs: number

  constructor(options: { fetcher?: FetchLike; timeoutMs?: number } = {}) {
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init))
    this.timeoutMs = options.timeoutMs ?? 20_000
  }

  getSnapshot = (): AuthState => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onIdentityChange = (listener: () => void): (() => void) => {
    this.identityListeners.add(listener)
    return () => this.identityListeners.delete(listener)
  }

  private publish(state: AuthState): void {
    if ((this.snapshot.user?.id ?? null) !== (state.user?.id ?? null)) {
      // Cancel private reads before exposing a different identity to the UI.
      this.identityListeners.forEach((listener) => listener())
    }
    this.snapshot = state
    this.listeners.forEach((listener) => listener())
  }

  private accept(bundle: AuthBundle): void {
    if (this.bundle?.user.id !== bundle.user.id || this.bundle?.session.sid !== bundle.session.sid) this.identityRevision++
    this.bundle = bundle
    this.bundleGeneration = this.generation
    this.restored = true
    this.publish({ status: 'authenticated', user: bundle.user, error: null })
  }

  private forget(error: ApiError | null = null): void {
    if (this.bundle || this.snapshot.user) this.identityRevision++
    this.bundle = null
    this.publish({ status: 'anonymous', user: null, error })
  }

  /** All Cookie-mutating auth calls are ordered within this tab. */
  private serializeAuth<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.authQueue.then(operation, operation)
    this.authQueue = result.then(() => undefined, () => undefined)
    return result
  }

  private assertIdentity(generation: number, revision: number): void {
    if (generation !== this.generation || revision !== this.identityRevision || !this.bundle) {
      throw new ApiError('会话已变更，请重新执行操作。', 401, 'AUTH_CHANGED')
    }
  }

  private async raw(path: string, options: RequestOptions = {}, token?: string, sid?: string): Promise<unknown> {
    if (!path.startsWith('/api/') || path.startsWith('//') || path.includes('://')) {
      throw new ApiError('管理接口必须使用 /api/ 相对路径。', 0, 'INVALID_API_PATH')
    }
    if (options.signal?.aborted) throw new ApiError('请求已取消。', 0, 'ABORTED')
    const controller = new AbortController()
    const cancel = () => controller.abort()
    options.signal?.addEventListener('abort', cancel, { once: true })
    let timedOut = false
    const timeout = setTimeout(() => { timedOut = true; controller.abort() }, this.timeoutMs)
    const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': 'zh-CN' }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    if (sid) headers['X-Auth-Session'] = sid
    if (options.proof) headers['X-Security-Proof'] = options.proof

    try {
      const response = await this.fetcher(path, {
        method: options.method ?? 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers,
        signal: controller.signal,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      })
      const text = await response.text()
      if (controller.signal.aborted) {
        throw new ApiError(timedOut ? '请求超时，请检查网络后重试。' : '请求已取消。', 0, timedOut ? 'TIMEOUT' : 'ABORTED')
      }
      let json: unknown
      try { json = JSON.parse(text) } catch {
        // Rate limiters answer with an empty body and a Retry-After header.
        if (response.status === 429) {
          const seconds = Number(response.headers.get('Retry-After'))
          const wait = seconds > 0 ? `请 ${Math.ceil(seconds / 60)} 分钟后再试` : '请稍后再试'
          throw new ApiError(`请求过于频繁，${wait}。`, 429, 'RATE_LIMITED')
        }
        throw new ApiError(`服务器返回了无法解析的响应（HTTP ${response.status}）。`, response.status, 'INVALID_JSON')
      }
      const envelope = isRecord(json) ? json : null
      const serverMessage = typeof envelope?.message === 'string' ? envelope.message : ''
      const code = typeof envelope?.code === 'string' ? envelope.code : undefined
      if (!response.ok || envelope?.success === false) {
        const nested = isRecord(envelope?.error) && typeof envelope.error.message === 'string' ? envelope.error.message : ''
        const raw = serverMessage || nested
        const key = typeof envelope?.message_key === 'string' ? envelope.message_key : undefined
        const params = isRecord(envelope?.message_params) ? envelope.message_params : undefined
        throw new ApiError(serverErrorMessage({ status: response.status, code, key, params, message: raw }), response.status, code, key ?? raw)
      }
      if (!envelope || envelope.success !== true) {
        throw new ApiError('服务器响应缺少有效的 success 字段。', response.status, 'INVALID_RESPONSE')
      }
      return options.envelope ? envelope : (envelope as unknown as Envelope).data
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (controller.signal.aborted) {
        throw new ApiError(timedOut ? '请求超时，请检查网络后重试。' : '请求已取消。', 0, timedOut ? 'TIMEOUT' : 'ABORTED')
      }
      throw asApiError(error)
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', cancel)
    }
  }

  /** At most one refresh request at a time, including parallel 401 responses. */
  refresh = (): Promise<void> => {
    if (this.refreshFlight) return this.refreshFlight
    const generation = this.generation
    this.refreshFlight = this.serializeAuth(async () => {
      try {
        if (generation !== this.generation) throw new ApiError('会话已变更，请重新执行操作。', 401, 'AUTH_CHANGED')
        let data: unknown
        try {
          data = await this.raw('/api/user/auth/refresh', { method: 'POST', auth: false }, undefined, this.bundle?.session.sid)
        } catch (error) {
          if (!(error instanceof ApiError) || error.code !== 'AUTH_SESSION_MISMATCH') throw error
          if (generation !== this.generation) throw new ApiError('会话已变更，请重新执行操作。', 401, 'AUTH_CHANGED')
          // Cookie identity changed in another tab: drop the stale identity and recover once.
          if (this.bundle || this.snapshot.user) this.identityRevision++
          this.bundle = null
          this.restored = false
          this.publish({ status: 'loading', user: null, error: null })
          data = await this.raw('/api/user/auth/refresh', { method: 'POST', auth: false })
        }
        if (generation !== this.generation) throw new ApiError('会话已变更，请重新执行操作。', 401, 'AUTH_CHANGED')
        this.accept(parseData(authBundleSchema, data, '会话'))
      } catch (error) {
        const normalized = asApiError(error)
        if (generation === this.generation) {
          if (normalized.status === 401) {
            this.restored = true
            this.forget(normalized)
          } else if (!this.bundle) {
            // A network/server failure is not proof that the refresh cookie is invalid.
            this.publish({ status: 'error', user: null, error: normalized })
          }
        }
        throw normalized
      } finally {
        this.refreshFlight = null
      }
    })
    return this.refreshFlight
  }

  restore = (): Promise<void> => {
    if (this.restoreFlight) return this.restoreFlight
    if (this.restored || this.bundle) return Promise.resolve()
    this.publish({ status: 'loading', user: null, error: null })
    this.restoreFlight = this.refresh().catch((error: unknown) => {
      // An invalid or absent cookie is a normal anonymous startup state.
      if (error instanceof ApiError && error.status === 401) return
      throw error
    }).finally(() => { this.restoreFlight = null })
    return this.restoreFlight
  }

  login = (input: LoginInput): Promise<LoginResult> => {
    if (this.loginFlight) return this.loginFlight
    if (!input.username.trim() || !input.password) return Promise.reject(new ApiError('请输入用户名和密码。', 400, 'VALIDATION_ERROR'))
    const generation = ++this.generation
    this.loginFlight = this.serializeAuth(async (): Promise<LoginResult> => {
      if (generation !== this.generation) throw new ApiError('登录已取消。', 401, 'AUTH_CHANGED')
      const config = parseData(encryptionSchema, await this.raw('/api/user/login/encryption-key', { auth: false }), '登录加密配置')
      const fields = await encryptedPasswordFields(input.password, config)
      // A logout may have been requested while the encryption config was loading.
      if (generation !== this.generation) throw new ApiError('登录已取消。', 401, 'AUTH_CHANGED')
      const data = await this.raw(`/api/user/login${queryString({ turnstile: input.turnstileToken })}`, {
        method: 'POST', auth: false, body: { username: input.username.trim(), ...fields },
      })
      if (generation !== this.generation) throw new ApiError('会话已变更，请重试登录。', 401, 'AUTH_CHANGED')
      if (isRecord(data) && data.require_verification === true) {
        const methods = Array.isArray(data.methods) ? data.methods.filter(isRecord) : []
        const twoFA = methods.find((m) => m.method === '2fa')
        if (typeof data.flow_token !== 'string' || !data.flow_token || !twoFA) {
          throw new ApiError('该账户需要通过 Passkey 完成登录验证，当前页面暂不支持。', 200, 'AUTH_CHALLENGE_UNSUPPORTED')
        }
        if (twoFA.available === false) {
          throw new ApiError('两步验证失败次数过多，已暂时锁定，请稍后再试。', 429, 'SECURITY_VERIFICATION_LOCKED')
        }
        return { kind: 'challenge', flowToken: data.flow_token, expiresAt: typeof data.expires_at === 'number' ? data.expires_at : undefined }
      }
      if (!isRecord(data) || typeof data.access_token !== 'string' || !data.access_token) {
        throw new ApiError('服务器没有签发 Access JWT，可能要求额外验证。当前页面尚不支持该验证流程。', 200, 'AUTH_CHALLENGE_REQUIRED')
      }
      this.accept(parseData(authBundleSchema, data, '登录'))
      return { kind: 'done' }
    }).finally(() => { this.loginFlight = null })
    return this.loginFlight
  }

  /** Second step of a password login that the server answered with a 2FA challenge. */
  verifyLogin = (flowToken: string, code: string): Promise<LoginResult> => {
    if (this.loginFlight) return this.loginFlight
    if (!flowToken || !code.trim()) return Promise.reject(new ApiError('请输入验证码。', 400, 'VALIDATION_ERROR'))
    const generation = ++this.generation
    this.loginFlight = this.serializeAuth(async (): Promise<LoginResult> => {
      if (generation !== this.generation) throw new ApiError('登录已取消。', 401, 'AUTH_CHANGED')
      const data = await this.raw('/api/user/login/verify', {
        method: 'POST', auth: false, body: { flow_token: flowToken, method: '2fa', code: code.trim() },
      })
      if (generation !== this.generation) throw new ApiError('会话已变更，请重试登录。', 401, 'AUTH_CHANGED')
      this.accept(parseData(authBundleSchema, data, '登录'))
      return { kind: 'done' }
    }).finally(() => { this.loginFlight = null })
    return this.loginFlight
  }

  logout = (): Promise<void> => {
    if (this.logoutFlight) return this.logoutFlight
    ++this.generation
    this.logoutFlight = this.serializeAuth(async () => {
      try {
        // The queue lets an earlier login/refresh Set-Cookie settle before revocation.
        try {
          await this.raw('/api/user/auth/logout', { method: 'POST', auth: false }, this.bundle?.access_token, this.bundle?.session.sid)
        } catch (error) {
          if (!(error instanceof ApiError) || error.code !== 'AUTH_SESSION_MISMATCH') throw error
          this.forget()
          // The server explicitly says nothing was revoked; recover the Cookie SID once.
          const data = await this.raw('/api/user/auth/refresh', { method: 'POST', auth: false })
          const current = parseData(authBundleSchema, data, '会话')
          await this.raw('/api/user/auth/logout', { method: 'POST', auth: false }, current.access_token, current.session.sid)
        }
      } catch (error) {
        const normalized = asApiError(error)
        throw new ApiError(`服务器尚未确认退出：${normalized.message} 本地会话已清除，请重试退出。`, normalized.status, normalized.code)
      } finally {
        this.restored = true
        this.forget()
      }
    }).finally(() => { this.logoutFlight = null })
    return this.logoutFlight
  }

  /**
   * Security changes (e.g. a new password) bump the account's auth version
   * and answer with a fresh access token for this same session; every other
   * session is revoked. Keep the user, swap the credentials. Without a usable
   * rotation the old token is dead, so fall back to one refresh.
   */
  applyRotation = async (data: unknown, userPatch: Partial<SelfProfile> = {}): Promise<void> => {
    const current = this.bundle
    const parsed = rotationSchema.safeParse(data)
    if (!current || !parsed.success || parsed.data.session.sid !== current.session.sid) {
      await this.refresh()
      return
    }
    this.accept({ ...parsed.data, user: { ...current.user, ...userPatch } })
  }

  async request(path: string, options: RequestOptions = {}): Promise<unknown> {
    if (options.auth === false) return this.raw(path, options)
    if (options.signal?.aborted) throw new ApiError('请求已取消。', 0, 'ABORTED')
    if ((this.loginFlight || this.logoutFlight) && this.bundleGeneration !== this.generation) {
      throw new ApiError('正在切换登录会话，请稍后重试。', 401, 'AUTH_OPERATION_PENDING')
    }
    if (!this.bundle) throw new ApiError('请先登录后继续。', 401, 'AUTH_REQUIRED')
    const generation = this.generation
    const revision = this.identityRevision
    if (this.bundle.access_expires_at <= Math.floor(Date.now() / 1000) + 20) await this.refresh()
    this.assertIdentity(generation, revision)
    const attemptedToken = this.bundle?.access_token
    try {
      const result = await this.raw(path, options, attemptedToken)
      this.assertIdentity(generation, revision)
      return result
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || error.code === 'AUTH_CHANGED') throw error
      this.assertIdentity(generation, revision)
      if (attemptedToken === this.bundle?.access_token) await this.refresh()
      this.assertIdentity(generation, revision)
      if ((options.method ?? 'GET') !== 'GET') {
        throw new ApiError('会话已更新。为避免重复提交，请再次确认本次操作。', 401, 'AUTH_RETRY_REQUIRED')
      }
      // Exactly one replay for GET. Any second 401 goes to the UI without another refresh.
      const retryToken = this.bundle?.access_token
      try {
        const result = await this.raw(path, options, retryToken)
        this.assertIdentity(generation, revision)
        return result
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401 && retryError.code !== 'AUTH_CHANGED'
          && generation === this.generation && revision === this.identityRevision && retryToken === this.bundle?.access_token) this.forget(retryError)
        throw retryError
      }
    }
  }
}

export const apiClient = new ApiClient()
