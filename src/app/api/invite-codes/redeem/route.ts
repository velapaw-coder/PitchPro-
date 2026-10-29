import { headers } from 'next/headers';

import { getAuth } from '@/core/auth';
import { redeemInviteCode } from '@/modules/invite-codes/service';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';

export async function POST(req: Request) {
  const limited = enforceMinIntervalRateLimit(req, {
    intervalMs: 1000,
    keyPrefix: 'invite-redeem',
  });
  if (limited) return limited;

  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return respErr('Unauthorized');

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || '').trim();
    if (!code) return respErr('Invite code is required');

    const result = await redeemInviteCode({
      userId: session.user.id,
      code,
    });

    if (!result.ok) {
      return respErr(result.error || 'Invalid invite code');
    }

    return respData({ trialEndsAt: result.trialEndsAt });
  } catch (e: any) {
    console.log('redeem invite code failed:', e);
    return respErr(e?.message || 'Redeem failed');
  }
}
