import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr, respOk } from '@/lib/resp';

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const items = await pitch.listShelfBrands(user.id);
    return respData(items);
  } catch (e: any) {
    return respErr(e.message || 'Failed to list brands');
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const body = await req.json();
    if (!body.name) return respErr('name is required');
    const row = await pitch.saveBrandToShelf(user.id, body);
    return respData(row);
  } catch (e: any) {
    return respErr(e.message || 'Failed to save brand');
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return respErr('id is required');
    await pitch.removeShelfBrand(user.id, id);
    return respOk();
  } catch (e: any) {
    return respErr(e.message || 'Failed to delete brand');
  }
}
