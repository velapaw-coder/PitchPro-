import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr, respOk } from '@/lib/resp';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const row = await pitch.getProject(user.id, id);
    if (!row) return respErr('Not found', { status: 404 });
    const brief = await pitch.getOrCreateBrief(user.id, id);
    return respData({ project: row, brief });
  } catch (e: any) {
    return respErr(e.message || 'Failed to get project');
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const body = await req.json();

    if (body.attachBrand) {
      const result = await pitch.attachBrandToProject(
        user.id,
        id,
        body.attachBrand,
        { saveToShelf: body.saveToShelf !== false }
      );
      const brief = await pitch.getOrCreateBrief(user.id, id);
      return respData({ ...result, brief });
    }

    if (body.action === 'archive') {
      const row = await pitch.archiveProject(user.id, id);
      if (!row) return respErr('Not found', { status: 404 });
      return respData(row);
    }

    const row = await pitch.updateProject(user.id, id, body);
    if (!row) return respErr('Not found', { status: 404 });
    return respData(row);
  } catch (e: any) {
    return respErr(e.message || 'Failed to update project');
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const row = await pitch.softDeleteProject(user.id, id);
    if (!row) return respErr('Not found', { status: 404 });
    return respOk();
  } catch (e: any) {
    return respErr(e.message || 'Failed to delete project');
  }
}
