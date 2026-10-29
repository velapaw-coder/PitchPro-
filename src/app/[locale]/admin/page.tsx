'use client';

import { useEffect, useState } from 'react';
import { Shield, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  const t = useTranslations('admin');
  const [stats, setStats] = useState({ users: 0, roles: 0 });

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/users').then((r) => r.json()),
      fetch('/api/admin/roles').then((r) => r.json()),
    ]).then(([usersRes, rolesRes]) => {
      setStats({
        users: usersRes.code === 0 ? usersRes.data.total : 0,
        roles: rolesRes.code === 0 ? rolesRes.data.total : 0,
      });
    });
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('stats.total_users')}
            </CardTitle>
            <Users className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('stats.roles')}
            </CardTitle>
            <Shield className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.roles}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
