/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production'
  readonly VITE_ACCESS_TOKEN_TTL_MS: string
  readonly VITE_USER_HTTP_URL?: string
  readonly VITE_BANK_HTTP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
