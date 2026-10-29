'use client';

import { useEffect, useState } from 'react';
import { Activity, CreditCard, Key, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useSession } from '@/core/auth/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Subscription = {
  status: string;
  planName?: string | null;
  productName?: string | null;
};

export default function DashboardPage() {
  const t = useTranslations();
  const { data: session } = useSession();
  const [credits, setCredits] = useState<number | null>(null);
  const [apiKeys, setApiKeys] = useState<number | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    fetch('/api/credits')
      .then((r) => r.json())
      .then((res) => {
        if (res.code === 0) setCredits(res.data.balance);
      })
      .catch(() => {});

    fetch('/api/apikeys')
      .then((r) => r.json())
      .then((res) => {
        if (res.code === 0) setApiKeys(res.data.length);
      })
      .catch(() => {});

    fetch('/api/user/subscriptions/current')
      .then((r) => r.json())
      .then((res) => {
        if (res.code === 0) setSubscription(res.data || null);
      })
      .catch(() => {});
  }, []);

  const planLabel =
    subscription?.planName ||
    subscription?.productName ||
    t('settings.overview.plan_free');

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('settings.title')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('settings.welcome', {
            name: session?.user?.name || session?.user?.email || '',
          })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t('settings.overview.plan')}
            </CardTitle>
            <TrendingUp className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{planLabel}</div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('settings.overview.plan_description')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t('settings.credits.title')}
            </CardTitle>
            <CreditCard className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credits ?? '—'}</div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('settings.credits.description')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t('settings.apikeys.title')}
            </CardTitle>
            <Key className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{apiKeys ?? '—'}</div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('settings.overview.apikeys_description')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t('settings.overview.usage')}
            </CardTitle>
            <Activity className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('settings.overview.usage_description')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('settings.overview.getting_started')}
          </CardTitle>
          <CardDescription>
            {t('settings.overview.getting_started_description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-border text-muted-foreground rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm">{t('settings.placeholder')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
