import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr } from '@/lib/resp';

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const items = await pitch.listProjects(user.id);
    return respData(items);
  } catch (e: any) {
    return respErr(e.message || 'Failed to list projects');
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const body = await req.json().catch(() => ({}));
    const row = await pitch.createProject({
      userId: user.id,
      brandName: body.brandName,
      country: body.country,
      track: body.track,
      brandId: body.brandId,
      note: body.note,
      pinned: body.pinned,
    });
    return respData(row);
  } catch (e: any) {
    return respErr(e.message || 'Failed to create project');
  }
}
