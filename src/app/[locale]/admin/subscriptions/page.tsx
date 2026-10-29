'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface Subscription {
  id: string;
  subscriptionNo: string;
  userId: string;
  userEmail: string | null;
  status: string;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  paymentProvider: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  description: string | null;
  createdAt: string;
}

const PAGE_SIZE = 10;

const TABS = ['all', 'month', 'year'] as const;
type Tab = (typeof TABS)[number];

export default function SubscriptionsPage() {
  const t = useTranslations('admin');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchSubscriptions = useCallback(
    (p: number) => {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(PAGE_SIZE),
      });
      if (tab === 'month') params.set('interval', 'month');
      if (tab === 'year') params.set('interval', 'year');
      if (debouncedSearch) params.set('search', debouncedSearch);
      fetch(`/api/admin/subscriptions?${params}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.code === 0) {
            setSubscriptions(res.data.items);
            setTotal(res.data.total);
          }
        });
    },
    [tab, debouncedSearch]
  );

  useEffect(() => {
    setPage(1);
    fetchSubscriptions(1);
  }, [tab, debouncedSearch, fetchSubscriptions]);

  useEffect(() => {
    fetchSubscriptions(page);
  }, [page, fetchSubscriptions]);

  function formatAmount(amount: number | null, currency: string | null) {
    if (amount == null) return '—';
    const value = amount / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(value);
  }

  function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString();
  }

  const statusVariant = (s: string) => {
    if (s === 'active' || s === 'trialing') return 'default' as const;
    if (s === 'canceled' || s === 'expired') return 'destructive' as const;
    return 'secondary' as const;
  };

  const columns: Column<Subscription>[] = [
    {
      header: t('subscriptions.subscription_no'),
      cell: (s) => (
        <span className="font-mono text-xs">{s.subscriptionNo}</span>
      ),
    },
    {
      header: t('subscriptions.user'),
      cell: (s) => <span className="text-sm">{s.userEmail || s.userId}</span>,
    },
    {
      header: t('subscriptions.amount'),
      cell: (s) => (
        <span className="font-medium">
          {formatAmount(s.amount, s.currency)}
        </span>
      ),
    },
    {
      header: t('subscriptions.interval'),
      cell: (s) => s.interval || '—',
    },
    {
      header: t('subscriptions.status'),
      cell: (s) => <Badge variant={statusVariant(s.status)}>{s.status}</Badge>,
    },
    {
      header: t('subscriptions.provider'),
      cell: (s) => s.paymentProvider,
    },
    {
      header: t('subscriptions.period'),
      cell: (s) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(s.currentPeriodStart)} ~ {formatDate(s.currentPeriodEnd)}
        </span>
      ),
    },
    {
      header: t('subscriptions.created_at'),
      cell: (s) => (
        <span className="text-muted-foreground text-sm">
          {new Date(s.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('subscriptions.title')}</h1>
        <p className="text-muted-foreground">
          {t('subscriptions.description')}
        </p>
      </div>

      <div className="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              tab === tb
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            {t(`subscriptions.tab_${tb}`)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={subscriptions}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(s) => s.id}
            emptyText={t('subscriptions.no_subscriptions')}
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => fetchSubscriptions(page)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
