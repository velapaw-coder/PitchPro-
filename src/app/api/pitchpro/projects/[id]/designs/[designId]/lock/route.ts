import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr } from '@/lib/resp';

type Ctx = { params: Promise<{ id: string; designId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id, designId } = await ctx.params;
    const result = await pitch.lockDesignConcept(user.id, id, designId);
    return respData(result);
  } catch (e: any) {
    return respErr(e.message || 'Failed to lock design');
  }
}
