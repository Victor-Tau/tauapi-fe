import type { LoginEncryptionInfo } from '@/types/api'
import { ApiError } from './errors'

function encodeBase64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
}

/** New API v1.0.0-rc.49 protocol, implemented with the browser's Web Crypto API. */
export async function encryptedPasswordFields(password: string, config: LoginEncryptionInfo) {
  if (!config.enabled) return { password }
  if (!config.kid || !config.public_key) {
    throw new ApiError('服务器要求密码加密，但没有提供完整的加密公钥。', 200, 'ENCRYPTION_KEY_MISSING')
  }
  if (!globalThis.crypto?.subtle) {
    throw new ApiError('服务器要求密码加密。请使用 localhost 或可信 HTTPS 环境后重试。', 0, 'WEB_CRYPTO_UNAVAILABLE')
  }
  try {
    const body = config.public_key.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '')
    const der = Uint8Array.from(atob(body), (character) => character.charCodeAt(0))
    const rsa = await crypto.subtle.importKey('spki', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
    const plain = new TextEncoder().encode(password)
    const algorithm = rsa.algorithm as RsaHashedKeyAlgorithm
    let encoded: string

    if (plain.byteLength <= algorithm.modulusLength / 8 - 66) {
      const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsa, plain)
      encoded = encodeBase64(new Uint8Array(cipher))
    } else {
      // The long-password format wraps an AES-256-GCM key with RSA-OAEP/SHA-256.
      const secret = crypto.getRandomValues(new Uint8Array(32))
      const nonce = crypto.getRandomValues(new Uint8Array(12))
      const aes = await crypto.subtle.importKey('raw', secret, 'AES-GCM', false, ['encrypt'])
      const encoder = new TextEncoder()
      const [wrapped, cipher] = await Promise.all([
        crypto.subtle.encrypt({ name: 'RSA-OAEP', label: encoder.encode('password-v2') }, rsa, secret),
        crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: encoder.encode(`password-v2:${config.kid}`) }, aes, plain),
      ])
      encoded = ['v2', encodeBase64(new Uint8Array(wrapped)), encodeBase64(nonce), encodeBase64(new Uint8Array(cipher))].join('.')
      secret.fill(0)
    }
    plain.fill(0)
    return { password_encrypted: encoded, encryption_key_id: config.kid }
  } catch {
    throw new ApiError('密码加密失败，请重新获取服务器公钥后再试。未发送明文密码。', 0, 'ENCRYPTION_FAILED')
  }
}
