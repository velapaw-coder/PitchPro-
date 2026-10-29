import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr, respOk } from '@/lib/resp';

/** Keep in sync with next.config experimental.serverActions.bodySizeLimit. */
export const MAX_ENTERPRISE_ASSET_BYTES = 25 * 1024 * 1024;
export const MAX_ENTERPRISE_ASSET_MB = 25;

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const items = await pitch.listAssets(user.id);
    return respData(items);
  } catch (e: any) {
    return respErr(e.message || 'Failed to list assets');
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      const title = String(form.get('title') || '');
      const projectId = String(form.get('projectId') || '') || null;
      if (!(file instanceof File)) {
        return respErr('file is required');
      }
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length > MAX_ENTERPRISE_ASSET_BYTES) {
        return respErr(
          `文件过大（单文件上限 ${MAX_ENTERPRISE_ASSET_MB}MB，当前 ${(buf.length / (1024 * 1024)).toFixed(1)}MB）`,
          { status: 413 }
        );
      }
      const row = await pitch.createAsset({
        userId: user.id,
        title: title || file.name,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: buf.length,
        buffer: buf,
        projectId,
      });
      return respData(row);
    }

    const body = await req.json();
    const row = await pitch.createAsset({
      userId: user.id,
      title: body.title || body.fileName || '未命名资料',
      fileName: body.fileName || 'note.txt',
      mimeType: body.mimeType || 'text/plain',
      size: (body.textContent || '').length,
      textContent: body.textContent || '',
      projectId: body.projectId || null,
    });
    return respData(row);
  } catch (e: any) {
    return respErr(e.message || 'Failed to upload asset');
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return respErr('id is required');
    await pitch.removeAsset(user.id, id);
    return respOk();
  } catch (e: any) {
    return respErr(e.message || 'Failed to delete asset');
  }
}
