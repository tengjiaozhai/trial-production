/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOCAL_AUTH_MODE?: 'sso' | 'bypass';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
