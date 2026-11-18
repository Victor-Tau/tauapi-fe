/**
 * The OpenAI-compatible base URL users point their SDKs at. The backend's own
 * `server_address` setting is not reliable (it can be localhost), so this is
 * a build setting, defaulting to the same origin as the console.
 */
export function modelBaseUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_MODEL_BASE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, "")
  return `${window.location.origin}/v1`
}
