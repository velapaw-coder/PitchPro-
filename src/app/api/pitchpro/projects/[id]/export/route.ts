import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respErr } from '@/lib/resp';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const format = (url.searchParams.get('format') || 'md').toLowerCase();

    if (format === 'zip' || format === 'pack') {
      const { fileName, bytes } = await pitch.buildExportZip(user.id, id);
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const { fileName, markdown } = await pitch.buildExportMarkdown(
      user.id,
      id
    );
    return new Response(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (e: any) {
    return respErr(e.message || 'Export failed');
  }
}
