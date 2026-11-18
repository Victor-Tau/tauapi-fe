/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public OpenAI-compatible base URL shown to users, e.g. https://api.example.com/v1. */
  readonly VITE_PUBLIC_MODEL_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
