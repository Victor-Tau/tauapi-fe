import { isChinese } from './messages'

/** Never attach response bodies, credentials, or fetch request options to errors. */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  /** The server's English source text, for matching specific failures; never shown. */
  readonly key?: string
  readonly retriable: boolean

  constructor(message: string, status = 0, code?: string, key?: string) {
    super(safeMessage(message))
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.key = key
    this.retriable = status === 0 || status === 429 || status >= 500
  }
}

function safeMessage(message: string): string {
  return message
    .replace(/\bsk-[a-zA-Z0-9_-]{8,}\b/g, '[密钥已隐藏]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[凭据已隐藏]')
    .slice(0, 600)
}

export function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  return new ApiError('无法连接服务器，请检查网络后重试。', 0, 'NETWORK_ERROR')
}

/** User-facing text for any caught error; English internals never reach the UI. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && isChinese(error.message)) return safeMessage(error.message)
  return '操作失败，请稍后重试。'
}
