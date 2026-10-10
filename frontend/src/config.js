const isDev = import.meta.env.DEV;

export const CHAT_WS_URL = isDev
  ? 'ws://localhost:8787'
  : import.meta.env.VITE_CHAT_WS_URL || '';
