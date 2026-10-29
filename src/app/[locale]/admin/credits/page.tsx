'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { Card, CardContent } from '@/components/ui/card';

interface Credit {
  id: string;
  userId: string;
  userEmail: string | null;
  transactionNo: string;
  transactionType: string;
  transactionScene: string | null;
  credits: number;
  remainingCredits: number;
  description: string | null;
  expiresAt: string | null;
  status: string;
  createdAt: string;
}

const PAGE_SIZE = 10;

const TABS = ['all', 'grant', 'consume'] as const;
type Tab = (typeof TABS)[number];

export default function CreditsPage() {
  const t = useTranslations('admin');
  const [credits, setCredits] = useState<Credit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCredits = useCallback(
    (p: number) => {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(PAGE_SIZE),
      });
      if (tab !== 'all') params.set('transactionType', tab);
      if (debouncedSearch) params.set('search', debouncedSearch);
      fetch(`/api/admin/credits?${params}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.code === 0) {
            setCredits(res.data.items);
            setTotal(res.data.total);
          }
        });
    },
    [tab, debouncedSearch]
  );

  useEffect(() => {
    setPage(1);
    fetchCredits(1);
  }, [tab, debouncedSearch, fetchCredits]);

  useEffect(() => {
    fetchCredits(page);
  }, [page, fetchCredits]);

  const columns: Column<Credit>[] = [
    {
      header: t('credits.transaction_no'),
      cell: (c) => <span className="font-mono text-xs">{c.transactionNo}</span>,
    },
    {
      header: t('credits.user'),
      cell: (c) => <span className="text-sm">{c.userEmail || c.userId}</span>,
    },
    {
      header: t('credits.amount'),
      cell: (c) => (
        <span
          className={cn(
            'font-medium',
            c.credits > 0 ? 'text-green-600' : 'text-red-500'
          )}
        >
          {c.credits > 0 ? `+${c.credits}` : c.credits}
        </span>
      ),
    },
    {
      header: t('credits.remaining'),
      cell: (c) => c.remainingCredits,
    },
    {
      header: t('credits.type'),
      cell: (c) => c.transactionType,
    },
    {
      header: t('credits.scene'),
      cell: (c) => c.transactionScene || '—',
    },
    {
      header: t('credits.description'),
      cell: (c) => (
        <span className="text-muted-foreground block max-w-[200px] truncate text-sm">
          {c.description || '—'}
        </span>
      ),
    },
    {
      header: t('credits.expires_at'),
      cell: (c) => (
        <span className="text-muted-foreground text-sm">
          {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      header: t('credits.created_at'),
      cell: (c) => (
        <span className="text-muted-foreground text-sm">
          {new Date(c.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('credits.title')}</h1>
        <p className="text-muted-foreground">{t('credits.description')}</p>
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
            {t(`credits.tab_${tb}`)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={credits}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(c) => c.id}
            emptyText={t('credits.no_credits')}
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => fetchCredits(page)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
