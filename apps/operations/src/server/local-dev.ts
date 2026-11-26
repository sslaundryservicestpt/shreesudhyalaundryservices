import 'server-only';

export const isLoopback = (hostname: string) =>
  ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

export function localSignInRequest(host: string | null) {
  if (process.env.NODE_ENV !== 'development' || !host) return false;
  try {
    const url = new URL(process.env.APP_URL || '');
    return isLoopback(url.hostname) && url.host === host && /^https?:$/.test(url.protocol);
  } catch {
    return false;
  }
}
