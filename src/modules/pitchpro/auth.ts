import { headers } from 'next/headers';

import { getAuth } from '@/core/auth';

export async function requireUser() {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return null;
  }
  return session.user;
}
