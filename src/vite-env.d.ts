/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TS_HOST: string;
  readonly VITE_TS_WORKSHEET_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
