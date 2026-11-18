import { useQuery } from "@tanstack/react-query"

import {
  getVerificationMethods,
  type VerificationMethod,
  type VerificationScope,
} from "@/api/security"

export type VerificationMode =
  | { kind: "loading" }
  | { kind: "error"; error: unknown; retry: () => void }
  | { kind: "ready"; method: Extract<VerificationMethod, "password" | "2fa"> }
  | { kind: "unsupported"; reason: string }

/**
 * Which factor the server wants for `scope`. Accounts with 2FA (or a
 * Passkey) can no longer use the password alone; this page supports the
 * password and authenticator codes, not Passkey or OAuth ceremonies.
 */
export function useVerificationMode(
  scope: VerificationScope,
  enabled: boolean
): VerificationMode {
  const query = useQuery({
    queryKey: ["verify-methods", scope],
    queryFn: ({ signal }) => getVerificationMethods(scope, signal),
    enabled,
    staleTime: 0,
    gcTime: 0,
  })
  if (query.isPending) return { kind: "loading" }
  if (query.isError) {
    return {
      kind: "error",
      error: query.error,
      retry: () => void query.refetch(),
    }
  }
  const available = query.data.methods.filter((m) => m.available)
  for (const method of ["2fa", "password"] as const) {
    if (available.some((m) => m.method === method)) {
      return { kind: "ready", method }
    }
  }
  const twoFA = query.data.methods.find((m) => m.method === "2fa")
  return {
    kind: "unsupported",
    reason: twoFA?.reason
      ? "两步验证暂时被锁定，请稍后再试。"
      : "该账户需要通过 Passkey 或第三方账号完成验证，当前页面暂不支持，请联系管理员。",
  }
}
