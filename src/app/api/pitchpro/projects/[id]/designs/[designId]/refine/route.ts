import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr } from '@/lib/resp';

type Ctx = { params: Promise<{ id: string; designId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id, designId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const instruction =
      typeof body.instruction === 'string' ? body.instruction : '';
    const mode =
      body.mode === 'regen'
        ? 'regen'
        : body.mode === 'remove-bg'
          ? 'remove-bg'
          : 'edit';
    const result = await pitch.refineDesignConcept(user.id, id, designId, {
      instruction,
      mode,
    });
    return respData(result);
  } catch (e: any) {
    return respErr(e.message || 'Failed to refine design');
  }
}
