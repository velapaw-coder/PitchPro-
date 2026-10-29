import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr } from '@/lib/resp';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const brief = await pitch.getOrCreateBrief(user.id, id);
    return respData(brief);
  } catch (e: any) {
    return respErr(e.message || 'Failed to get brief');
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const body = await req.json();
    const brief = await pitch.updateBrief(user.id, id, body);
    return respData(brief);
  } catch (e: any) {
    return respErr(e.message || 'Failed to update brief');
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    if (body.action === 'reopen' || body.reopen === true) {
      const result = await pitch.reopenBrief(user.id, id);
      return respData(result);
    }
    if (body.action === 'confirm' || body.confirm === true || !body.action) {
      // Save any pending fields then confirm
      if (body.brief) {
        await pitch.updateBrief(user.id, id, body.brief);
      }
      const result = await pitch.confirmBrief(user.id, id);
      return respData(result);
    }
    return respErr('Unknown action');
  } catch (e: any) {
    return respErr(e.message || 'Failed to confirm brief');
  }
}
