import { headers } from 'next/headers';

import { getAuth } from '@/core/auth';
import {
  assignPermissionsToRole,
  getRolePermissions,
  hasPermission,
} from '@/modules/rbac/service';
import { respData, respErr, respOk } from '@/lib/resp';

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
    await checkAdmin();
    const { searchParams } = new URL(req.url);
    const roleId = searchParams.get('roleId');
    if (!roleId) return respErr('roleId is required');
    const perms = await getRolePermissions(roleId);
    return respData(perms);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export async function PUT(req: Request) {
  try {
    await checkAdmin();
    const { roleId, permissionIds } = await req.json();
    if (!roleId) return respErr('roleId is required');
    await assignPermissionsToRole(roleId, permissionIds || []);
    return respOk();
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}
