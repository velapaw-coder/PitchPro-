import { headers } from 'next/headers';

import { getAuth } from '@/core/auth';
import { cancelUserSubscription } from '@/modules/payment/service';
import { respData, respErr } from '@/lib/resp';

export async function POST(req: Request) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return respErr('Unauthorized');

    const body = await req.json().catch(() => ({}));
    const subscriptionNo = body?.subscriptionNo;
    if (!subscriptionNo || typeof subscriptionNo !== 'string') {
      return respErr('subscriptionNo is required');
    }

    const updated = await cancelUserSubscription({
      userId: session.user.id,
      subscriptionNo,
    });

    return respData(updated);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}
