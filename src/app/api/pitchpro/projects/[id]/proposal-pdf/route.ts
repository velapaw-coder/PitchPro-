import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const { id } = await ctx.params;
    const file = await pitch.readProposalPdfBytes(user.id, id);
    return new Response(file.bytes, {
      status: 200,
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `inline; filename="${file.fileName.replace(/"/g, '')}"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ message: e?.message || 'Failed to load proposal PDF' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
