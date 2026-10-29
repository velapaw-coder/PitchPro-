import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr } from '@/lib/resp';
import { safeParseAttachments, toApiChatMessage } from '@/modules/pitchpro/chat-serialize';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST: user message → volcano chat → assistant message (both persisted).
 * Body: { content: string, attachments?: ChatAttachment[], stream?: boolean }
 * Default: SSE stream (text/event-stream). Pass stream:false for legacy JSON.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const body = await req.json();
    const content = String(body.content || '').trim();
    if (!content) return respErr('content is required');

    const wantStream = body.stream !== false;

    if (!wantStream) {
      const result = await pitch.sendChatAndReply({
        userId: user.id,
        projectId: id,
        content,
        attachments: body.attachments || [],
      });

      const mapMsg = (m: typeof result.user) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachments: safeParseAttachments(m.attachments),
        createdAt: m.createdAt,
      });

      return respData({
        user: mapMsg(result.user),
        assistant: mapMsg(result.assistant),
        usedLive: result.usedLive,
        model: result.model,
        brief: result.brief,
        project: result.project,
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };
        try {
          for await (const chunk of pitch.sendChatAndReplyStream({
            userId: user.id,
            projectId: id,
            content,
            attachments: body.attachments || [],
          })) {
            send(chunk.event, chunk.data);
          }
        } catch (e: any) {
          send('error', { message: e?.message || 'Chat failed' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (e: any) {
    return respErr(e.message || 'Chat failed');
  }
}

