/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_ASSET_BASE_URL?: string
  readonly VITE_GOATCOUNTER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
