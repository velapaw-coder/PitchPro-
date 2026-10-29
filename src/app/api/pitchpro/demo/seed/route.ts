import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr } from '@/lib/resp';

export async function POST() {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const project = await pitch.seedDemoProject(user.id);
    return respData(project);
  } catch (e: any) {
    return respErr(e.message || 'Seed failed');
  }
}
