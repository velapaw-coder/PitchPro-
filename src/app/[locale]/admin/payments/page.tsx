'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface Order {
  id: string;
  orderNo: string;
  userId: string;
  userEmail: string | null;
  status: string;
  amount: number;
  currency: string;
  paymentType: string | null;
  paymentProvider: string;
  productName: string | null;
  description: string | null;
  createdAt: string;
  paidAt: string | null;
}

const PAGE_SIZE = 10;

const TABS = ['all', 'subscription', 'one_time'] as const;
type Tab = (typeof TABS)[number];

export default function PaymentsPage() {
  const t = useTranslations('admin');
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchOrders = useCallback(
    (p: number) => {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(PAGE_SIZE),
      });
      if (tab === 'subscription') params.set('paymentType', 'subscription');
      if (tab === 'one_time') params.set('paymentType', 'one_time');
      if (debouncedSearch) params.set('search', debouncedSearch);
      fetch(`/api/admin/orders?${params}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.code === 0) {
            setOrders(res.data.items);
            setTotal(res.data.total);
          }
        });
    },
    [tab, debouncedSearch]
  );

  useEffect(() => {
    setPage(1);
    fetchOrders(1);
  }, [tab, debouncedSearch, fetchOrders]);

  useEffect(() => {
    fetchOrders(page);
  }, [page, fetchOrders]);

  function formatAmount(amount: number, currency: string) {
    const value = amount / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(value);
  }

  const statusVariant = (s: string) => {
    if (s === 'paid') return 'default';
    if (s === 'failed') return 'destructive';
    return 'secondary';
  };

  const columns: Column<Order>[] = [
    {
      header: t('payments.order_no'),
      cell: (o) => <span className="font-mono text-xs">{o.orderNo}</span>,
    },
    {
      header: t('payments.user'),
      cell: (o) => <span className="text-sm">{o.userEmail || o.userId}</span>,
    },
    {
      header: t('payments.amount'),
      cell: (o) => (
        <span className="font-medium">
          {formatAmount(o.amount, o.currency)}
        </span>
      ),
    },
    {
      header: t('payments.status'),
      cell: (o) => <Badge variant={statusVariant(o.status)}>{o.status}</Badge>,
    },
    {
      header: t('payments.type'),
      cell: (o) => o.paymentType || '—',
    },
    {
      header: t('payments.provider'),
      cell: (o) => o.paymentProvider,
    },
    {
      header: t('payments.created_at'),
      cell: (o) => (
        <span className="text-muted-foreground text-sm">
          {new Date(o.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('payments.title')}</h1>
        <p className="text-muted-foreground">{t('payments.description')}</p>
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
            {t(`payments.tab_${tb}`)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={orders}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(o) => o.id}
            emptyText={t('payments.no_payments')}
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => fetchOrders(page)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
