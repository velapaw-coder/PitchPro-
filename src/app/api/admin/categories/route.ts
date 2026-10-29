import { headers } from 'next/headers';

import { getAuth } from '@/core/auth';
import { hasPermission } from '@/modules/rbac/service';
import * as taxonomyService from '@/modules/taxonomy/service';
import { respData, respErr, respOk, respPage } from '@/lib/resp';

async function checkAdmin() {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error('Unauthorized');
  const isAdmin = await hasPermission(session.user.id, 'admin.*');
  if (!isAdmin) throw new Error('Forbidden');
  return session;
}

export async function GET(req: Request) {
  try {
    const session = await checkAdmin();
    const { searchParams } = new URL(req.url);

    // If ?all=true, return all categories (for dropdowns)
    if (searchParams.get('all') === 'true') {
      const items = await taxonomyService.getAll('category');
      return respData(items);
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '10'))
    );
    const search = searchParams.get('search') || undefined;

    const { items, total } = await taxonomyService.list({
      type: 'category',
      search,
      page,
      pageSize,
    });
    return respPage(items, total);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export async function POST(req: Request) {
  try {
    const session = await checkAdmin();
    const { slug, title, description } = await req.json();
    if (!slug || !title) return respErr('slug and title are required');
    const result = await taxonomyService.create({
      userId: session.user.id,
      slug,
      type: 'category',
      title,
      description,
    });
    return respData(result);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export async function PUT(req: Request) {
  try {
    await checkAdmin();
    const { id, slug, title, description, status } = await req.json();
    if (!id) return respErr('ID is required');
    const result = await taxonomyService.update(id, {
      slug,
      title,
      description,
      status,
    });
    return respData(result);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export async function DELETE(req: Request) {
  try {
    await checkAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return respErr('ID is required');
    await taxonomyService.remove(id);
    return respOk();
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}
