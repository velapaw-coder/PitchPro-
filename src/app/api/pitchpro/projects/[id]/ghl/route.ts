import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr } from '@/lib/resp';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const meta = pitch.getFollowupMeta();
    const preview = await pitch.previewGhlSync(user.id, id);
    const history = await pitch.listGhlSyncs(user.id, id);
    return respData({ meta, preview, history });
  } catch (e: any) {
    return respErr(e.message || 'Failed to load GHL state');
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    if (body.action === 'preview') {
      const preview = await pitch.previewGhlSync(user.id, id, body);
      return respData({
        preview,
        meta: pitch.getFollowupMeta(),
      });
    }

    const result = await pitch.runGhlSync(user.id, id, {
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      note: body.note,
    });
    return respData(result);
  } catch (e: any) {
    return respErr(e.message || 'GHL sync failed');
  }
}
