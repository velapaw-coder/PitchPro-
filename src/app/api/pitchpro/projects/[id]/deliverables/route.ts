import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr } from '@/lib/resp';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const project = await pitch.getProject(user.id, id);
    if (!project) return respErr('Not found', { status: 404 });
    let items = await pitch.listDeliverables(user.id, id);
    // Pack available from proposal onward (flow A); PDP uses /pdp.
    if (
      !items.length &&
      project.lockedDesignId &&
      (project.stage === 'proposal' ||
        project.stage === 'video' ||
        project.stage === 'assets' ||
        project.stage === 'followup')
    ) {
      items = await pitch.ensureDeliverables(
        user.id,
        id,
        project.lockedDesignId
      );
    }
    let proposalChatMessage = undefined;
    let videoChatMessage = undefined;
    if (project.lockedDesignId) {
      if (
        project.stage === 'proposal' ||
        project.stage === 'video' ||
        project.stage === 'assets' ||
        project.stage === 'followup'
      ) {
        proposalChatMessage =
          (await pitch.ensureProposalChatMessage(user.id, id)) || undefined;
      }
      if (
        project.stage === 'video' ||
        project.stage === 'assets' ||
        project.stage === 'followup'
      ) {
        videoChatMessage =
          (await pitch.ensureVideoChatMessage(user.id, id)) || undefined;
      }
    }
    let videoPrecheck = undefined;
    if (
      project.lockedDesignId &&
      (project.stage === 'video' ||
        project.stage === 'assets' ||
        project.stage === 'followup')
    ) {
      videoPrecheck =
        (await pitch.getVideoRefPrecheck(user.id, id)) || undefined;
    }
    return respData({
      items,
      lockedDesignId: project.lockedDesignId,
      stage: project.stage,
      proposalChatMessage,
      videoChatMessage,
      videoPrecheck,
    });
  } catch (e: any) {
    return respErr(e.message || 'Failed to list deliverables');
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

    if (body.action === 'advance_followup') {
      const updated = await pitch.advanceToFollowup(user.id, id);
      return respData({ project: updated });
    }

    if (body.action === 'advance_assets' || body.action === 'advance-assets') {
      const updated = await pitch.advanceToAssets(user.id, id);
      return respData({ project: updated });
    }

    if (
      body.action === 'advance_video' ||
      body.action === 'advance-to-video' ||
      body.action === 'enter_video'
    ) {
      const result = await pitch.advanceToVideo(user.id, id);
      return respData(result);
    }

    if (
      body.action === 'revise-proposal' ||
      body.action === 'revise_proposal' ||
      body.action === 'refresh-proposal-chat'
    ) {
      const result = await pitch.beginProposalRevise(user.id, id);
      return respData(result);
    }

    if (
      body.action === 'confirm-proposal' ||
      body.action === 'confirm_proposal_pdf'
    ) {
      const result = await pitch.confirmProposalPdf(user.id, id);
      return respData(result);
    }

    if (
      body.action === 'confirm-video' ||
      body.action === 'confirm_video'
    ) {
      const result = await pitch.confirmVideo(user.id, id);
      return respData(result);
    }

    if (
      body.action === 'poll-video' ||
      body.action === 'poll_video' ||
      body.action === 'advance-video'
    ) {
      const result = await pitch.pollVideoJob(user.id, id);
      return respData(result);
    }

    const designId = body.designId || project.lockedDesignId;
    if (!designId) return respErr('请先锁定设计视觉');
    const force = body.force === true || body.action === 'regenerate';
    const items = await pitch.ensureDeliverables(user.id, id, designId, {
      force,
    });
    const proposalChatMessage =
      (await pitch.ensureProposalChatMessage(user.id, id, { force })) ||
      undefined;
    const videoChatMessage =
      (await pitch.ensureVideoChatMessage(user.id, id, { force })) ||
      undefined;
    return respData({
      items,
      lockedDesignId: designId,
      proposalChatMessage,
      videoChatMessage,
    });
  } catch (e: any) {
    return respErr(e.message || 'Failed to generate deliverables');
  }
}
