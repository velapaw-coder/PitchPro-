import { headers } from 'next/headers';

import { getAuth } from '@/core/auth';
import { getCurrentSubscription } from '@/modules/subscriptions/service';
import { respData, respErr } from '@/lib/resp';

export async function GET() {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return respErr('Unauthorized');

    const sub = await getCurrentSubscription(session.user.id);
    return respData(sub || null);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}
