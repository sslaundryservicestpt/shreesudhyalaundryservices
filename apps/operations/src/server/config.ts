import 'server-only';
import { DomainError } from '@shree/domain';
export function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new DomainError(
      'SETUP_REQUIRED',
      'Managed authentication is not configured. Follow the local setup guide.',
      503,
    );
  return { url, key };
}
export function configured() {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export function registrationSecret() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}
export function registrationConfigured() {
  return configured() && Boolean(process.env.APP_URL && registrationSecret());
}
