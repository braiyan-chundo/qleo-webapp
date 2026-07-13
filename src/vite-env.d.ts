/// <reference types="vite/client" />

// QL-116: versión del producto inyectada por Vite (`define` en vite.config.ts) a partir de
// `package.json`. Declarada como global tipado para consumirla sin `any` en el bundle.
declare const __APP_VERSION__: string;
