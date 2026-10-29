import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr } from '@/lib/resp';
import { parsePdpLongImages } from '@/modules/pitchpro/pdp-copy';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const project = await pitch.getProject(user.id, id);
    if (!project) return respErr('Not found', { status: 404 });
    if (!project.lockedDesignId) {
      return respErr('请先锁定设计视觉', { status: 400 });
    }

    const items = await pitch.ensurePdpDeliverable(
      user.id,
      id,
      project.lockedDesignId,
      { generateImage: false }
    );
    const narrativeChat = await pitch.ensureNarrativeChatMessage(user.id, id);
    const pdp = items[0] || null;
    const longImages = pdp ? parsePdpLongImages(pdp.content) : null;
    return respData({
      pdp,
      project,
      lockedDesignId: project.lockedDesignId,
      stage: project.stage,
      narrativeChatMessage: narrativeChat || undefined,
      longImageUrls: longImages?.urls || (pdp?.fileUrl ? [pdp.fileUrl] : []),
      selectedLongImageUrl: longImages?.selected || pdp?.fileUrl || '',
    });
  } catch (e: any) {
    return respErr(e.message || 'Failed to load PDP');
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const project = await pitch.getProject(user.id, id);
    if (!project) return respErr('Not found', { status: 404 });
    if (!project.lockedDesignId) {
      return respErr('请先锁定设计视觉');
    }

    if (body.action === 'confirm-narrative') {
      const result = await pitch.confirmNarrative(user.id, id);
      return respData({ ...result, status: result.status || result.pdp?.status });
    }

    if (body.action === 'advance-long-images') {
      const result = await pitch.advancePdpLongImages(user.id, id);
      return respData(result);
    }

    if (body.action === 'select-long-image') {
      const result = await pitch.selectPdpLongImage(
        user.id,
        id,
        String(body.url || body.selectedUrl || '')
      );
      return respData(result);
    }

    if (body.action === 'confirm') {
      const result = await pitch.confirmPdp(user.id, id);
      return respData(result);
    }

    // regenerate / ensure — back to narrative, no long images yet
    const isRegen = body.force === true || body.action === 'regenerate';
    const items = await pitch.ensurePdpDeliverable(
      user.id,
      id,
      project.lockedDesignId,
      {
        force: isRegen,
        generateImage: false,
        status: isRegen ? 'narrative' : body.status || 'narrative',
      }
    );
    const fresh = await pitch.getProject(user.id, id);
    return respData({
      pdp: items[0] || null,
      project: fresh || project,
      lockedDesignId: project.lockedDesignId,
    });
  } catch (e: any) {
    return respErr(e.message || 'Failed to update PDP');
  }
}
