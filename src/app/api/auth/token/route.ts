import { cookies, headers } from 'next/headers';

import { getAuth } from '@/core/auth';
import { respData, respErr } from '@/lib/resp';

/**
 * GET /api/auth/token
 *
 * Returns the current session token for the logged-in user.
 * Used by the auth-callback page to pass the token to the desktop client
 * via custom protocol URL (her://auth/callback?token=xxx).
 */
export async function GET() {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return respErr('Unauthorized');
    }

    const cookieStore = await cookies();
    // Cookie name varies: __Secure- prefix when using HTTPS
    const token =
      cookieStore.get('better-auth.session_token')?.value ||
      cookieStore.get('__Secure-better-auth.session_token')?.value;

    if (!token) {
      return respErr('No session token found');
    }

    // Also return the cookie name so client knows which to use
    const cookieName = cookieStore.has('__Secure-better-auth.session_token')
      ? '__Secure-better-auth.session_token'
      : 'better-auth.session_token';

    return respData({ token, cookieName });
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}
