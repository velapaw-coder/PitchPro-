import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr } from '@/lib/resp';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const items = await pitch.ensureDesignConcepts(user.id, id);
    return respData(items);
  } catch (e: any) {
    return respErr(e.message || 'Failed to list designs');
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const items = await pitch.ensureDesignConcepts(user.id, id, {
      force: body.force === true || body.action === 'regenerate',
    });
    return respData(items);
  } catch (e: any) {
    return respErr(e.message || 'Failed to generate designs');
  }
}
