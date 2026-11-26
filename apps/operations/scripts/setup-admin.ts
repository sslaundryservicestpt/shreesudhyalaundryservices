import './env';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { createClient } from '@supabase/supabase-js';
// Authenticates a real invited identity; never creates a fake or public account.
let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });
try {
  if (!process.stdin.isTTY) throw Error('Run this interactive setup in your own terminal.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !process.env.DATABASE_URL)
    throw Error('Configure Supabase URL, public key and DATABASE_URL in .env.local first.');
  const email = (await rl.question('Invited, verified administrator email: ')).trim();
  const displayName = (await rl.question('Administrator display name: ')).trim();
  process.stdout.write('Password (hidden): ');
  muted = true;
  const password = await rl.question('');
  muted = false;
  process.stdout.write('\n');
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await auth.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.user || !result.data.session)
    throw Error('Sign-in failed. Accept the Supabase invitation and set your password first.');
  if (!result.data.user.email_confirmed_at) throw Error('Verify your email before setup.');
  process.env.BOOTSTRAP_AUTH_USER_ID = result.data.user.id;
  process.env.BOOTSTRAP_EMAIL = result.data.user.email;
  process.env.BOOTSTRAP_DISPLAY_NAME = displayName;
  process.env.BOOTSTRAP_ACCESS_TOKEN = result.data.session.access_token;
  rl.close();
  const { bootstrapAdmin } = await import('./bootstrap-admin');
  await bootstrapAdmin();
} catch (error) {
  muted = false;
  console.error(error instanceof Error ? error.message : 'Admin setup failed.');
  process.exitCode = 1;
} finally {
  rl.close();
  delete process.env.BOOTSTRAP_ACCESS_TOKEN;
}
