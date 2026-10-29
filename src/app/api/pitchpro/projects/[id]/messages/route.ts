import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr } from '@/lib/resp';
import { toApiChatMessage } from '@/modules/pitchpro/chat-serialize';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const items = await pitch.listChatMessages(user.id, id);
    return respData(items.map((m) => toApiChatMessage(m)));
  } catch (e: any) {
    return respErr(e.message || 'Failed to list messages');
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const body = await req.json();
    if (!body.role || !['user', 'assistant', 'system'].includes(body.role)) {
      return respErr('role is required');
    }
    const row = await pitch.appendChatMessage({
      userId: user.id,
      projectId: id,
      role: body.role,
      content: body.content || '',
      attachments: body.attachments || [],
    });
    return respData(toApiChatMessage(row));
  } catch (e: any) {
    return respErr(e.message || 'Failed to append message');
  }
}
