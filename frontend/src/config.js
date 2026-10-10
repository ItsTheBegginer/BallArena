const isDev = import.meta.env.DEV;

export const CHAT_WS_URL = isDev
  ? 'ws://localhost:8787'
  : import.meta.env.VITE_CHAT_WS_URL;

if (!isDev && !CHAT_WS_URL) {
  throw new Error('VITE_CHAT_WS_URL is not set for this build');
}
