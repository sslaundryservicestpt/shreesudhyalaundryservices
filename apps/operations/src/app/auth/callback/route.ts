import { NextResponse } from 'next/server';
import { authClient } from '@/server/auth';
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get('code'),
    tokenHash = url.searchParams.get('token_hash'),
    type = url.searchParams.get('type');
  const origin = process.env.APP_URL;
  if (!origin) return new Response('Authentication callback is not configured.', { status: 503 });
  if (tokenHash && (type === 'invite' || type === 'recovery')) {
    const auth = await authClient(true);
    const { error } = await auth.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL('/reset-password', origin));
  }
  if (code) {
    const auth = await authClient(true);
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/reset-password', origin));
  }
  return NextResponse.redirect(new URL('/login?notice=recovery-expired', origin));
}
