import { z } from 'zod';
import { DomainError } from '@shree/domain';
import { authClient } from '@/server/auth';
import {
  internalLoginEmail,
  queueStaffRequest,
  registrationInput,
  registerStaff,
  staffLogin,
} from '@/server/registration';
import { signInToTestRole, testRoles } from '@/server/test-sign-in';
import { body, failure, json, requestId, verifyOrigin } from '@/server/http';
const credentials = z.object({ login: staffLogin, password: z.string().min(1).max(256) }).strict();
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const id = requestId();
  try {
    verifyOrigin(request);
    const { action } = await context.params;
    if (action === 'test-sign-in') {
      const { role } = z
        .object({ role: z.enum(testRoles) })
        .strict()
        .parse(await body(request));
      await signInToTestRole(request.headers.get('host'), role);
      return json({ redirect: '/workspace' }, id);
    }
    const auth = await authClient(true);
    if (action === 'sign-out') {
      const { error } = await auth.auth.signOut();
      if (error)
        throw new DomainError('SIGN_OUT_FAILED', 'Sign out could not be completed. Retry.', 502);
      return json({ signedOut: true }, id);
    }
    const input = await body(request);
    if (action === 'register') {
      const parsed = registrationInput.safeParse(input);
      if (!parsed.success)
        throw new DomainError(
          'VALIDATION_ERROR',
          parsed.error.issues.some((issue) => issue.path[0] === 'contactPhone')
            ? 'Enter a valid contact phone number or leave it blank.'
            : 'Enter a name, username or email-style login, and a password of at least 12 characters.',
          422,
        );
      await registerStaff(parsed.data, id);
      return json(
        {
          message:
            'Request submitted. An administrator must approve it and assign your role before you can sign in.',
        },
        id,
      );
    }
    if (action === 'sign-in') {
      const parsed = credentials.safeParse(input);
      if (!parsed.success)
        throw new DomainError('VALIDATION_ERROR', 'Enter your login and password.', 422);
      const { login, password } = parsed.data;
      let result = await auth.auth.signInWithPassword({
        email: internalLoginEmail(login),
        password,
      });
      if (result.error?.code === 'invalid_credentials' && z.email().safeParse(login).success) {
        result = await auth.auth.signInWithPassword({ email: login, password });
      }
      if (result.error || !result.data.user)
        throw new DomainError(
          'SIGN_IN_FAILED',
          'Sign in failed. Check your credentials or contact your administrator.',
          401,
        );
      try {
        if (await queueStaffRequest(result.data.user, id)) {
          await auth.auth.signOut({ scope: 'local' });
          return json({ redirect: '/login?notice=access-pending' }, id);
        }
      } catch (error) {
        await auth.auth.signOut({ scope: 'local' });
        throw error;
      }
      return json({ redirect: '/workspace' }, id);
    }
    if (action === 'recover') {
      const parsed = z.object({ email: z.email() }).strict().safeParse(input);
      if (!parsed.success)
        throw new DomainError('VALIDATION_ERROR', 'Enter a valid email address.', 422);
      const { error } = await auth.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: new URL('/auth/callback', process.env.APP_URL).toString(),
      });
      if (error)
        throw new DomainError(
          'RECOVERY_UNAVAILABLE',
          'Recovery is unavailable. Try again later.',
          502,
        );
      return json(
        { message: 'If this account is eligible, a password recovery email will arrive shortly.' },
        id,
      );
    }
    if (action === 'reset') {
      const { data, error: identityError } = await auth.auth.getUser();
      if (identityError || !data.user)
        throw new DomainError('UNAUTHENTICATED', 'Open a valid recovery link first.', 401);
      const parsed = z
        .object({ password: z.string().min(12).max(256) })
        .strict()
        .safeParse(input);
      if (!parsed.success)
        throw new DomainError('VALIDATION_ERROR', 'Use a password of at least 12 characters.', 422);
      const { error } = await auth.auth.updateUser({ password: parsed.data.password });
      if (error)
        throw new DomainError(
          'RESET_FAILED',
          'Password could not be updated. Request a new recovery link.',
          422,
        );
      await auth.auth.signOut();
      return json({ message: 'Password updated. Sign in with your new password.' }, id);
    }
    throw new DomainError('NOT_FOUND', 'Unknown authentication action.', 404);
  } catch (error) {
    return failure(error, id);
  }
}
