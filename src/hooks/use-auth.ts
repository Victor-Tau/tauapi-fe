import { useSyncExternalStore } from "react"

import { apiClient } from "@/api/request"

/** Auth state lives in ApiClient (memory only); this hook just subscribes. */
export function useAuth() {
  const state = useSyncExternalStore(apiClient.subscribe, apiClient.getSnapshot)
  return {
    ...state,
    login: apiClient.login,
    verifyLogin: apiClient.verifyLogin,
    logout: apiClient.logout,
    restore: apiClient.restore,
  }
}
