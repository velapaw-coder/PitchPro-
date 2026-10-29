'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, MoreHorizontal, Pencil, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/core/i18n/navigation';
import { cn } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Subscription = {
  id: string;
  subscriptionNo: string;
  status: string;
  paymentProvider: string;
  planName?: string | null;
  productName?: string | null;
  interval?: string | null;
  intervalCount?: number | null;
  amount?: number | null;
  currency?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  canceledAt?: string | null;
  canceledEndAt?: string | null;
  canceledReason?: string | null;
  createdAt?: string | null;
};

const TABS = [
  'all',
  'active',
  'trialing',
  'paused',
  'expired',
  'pending_cancel',
  'canceled',
] as const;
type Tab = (typeof TABS)[number];

const PAGE_SIZE = 20;

function formatAmount(amount: number, currency: string) {
  const normalized = (currency || 'usd').toUpperCase();
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: normalized,
  }).format(amount / 100);
}

function statusVariant(
  status?: string | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'trialing') return 'default';
  if (s === 'canceled' || s === 'expired') return 'destructive';
  return 'secondary';
}

function isCancellable(status?: string | null) {
  const s = (status || '').toLowerCase();
  return s === 'active' || s === 'trialing';
}

export default function BillingPage() {
  const t = useTranslations('settings.billing');
  const [current, setCurrent] = useState<Subscription | null>(null);
  const [currentLoaded, setCurrentLoaded] = useState(false);
  const [rows, setRows] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<Subscription | null>(null);
  const [canceling, setCanceling] = useState<Subscription | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchCurrent = useCallback(() => {
    fetch('/api/user/subscriptions/current')
      .then((r) => r.json())
      .then((res) => {
        if (res?.code === 0) setCurrent(res.data || null);
        setCurrentLoaded(true);
      })
      .catch(() => setCurrentLoaded(true));
  }, []);

  const fetchList = useCallback(async (p: number, tb: Tab, s: string) => {
    const params = new URLSearchParams({
      page: String(p),
      pageSize: String(PAGE_SIZE),
    });
    if (tb !== 'all') params.set('status', tb);
    if (s) params.set('search', s);
    const res = await fetch(`/api/user/subscriptions?${params}`)
      .then((r) => r.json())
      .catch(() => null);
    if (res?.code === 0) {
      setRows(res.data.items);
      setTotal(res.data.total);
    }
  }, []);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  useEffect(() => {
    const timer = setTimeout(() => fetchList(page, tab, search), 300);
    return () => clearTimeout(timer);
  }, [page, tab, search, fetchList]);

  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  async function confirmCancel() {
    if (!canceling) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionNo: canceling.subscriptionNo }),
      });
      const data = await res.json();
      if (data.code === 0) {
        toast.success(t('cancel_success'));
        setCanceling(null);
        fetchCurrent();
        fetchList(page, tab, search);
      } else {
        toast.error(data.message || t('cancel_failed'));
      }
    } catch {
      toast.error(t('cancel_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<Subscription>[] = [
    {
      header: t('subscription_no'),
      cell: (r) => (
        <span className="font-mono text-xs">{r.subscriptionNo}</span>
      ),
    },
    {
      header: t('plan'),
      cell: (r) => (
        <span className="font-medium">
          {r.planName || r.productName || '—'}
        </span>
      ),
    },
    {
      header: t('interval'),
      cell: (r) =>
        r.interval ? (
          <span className="text-sm">
            {r.intervalCount ? `${r.intervalCount} ` : ''}
            {r.interval}
          </span>
        ) : (
          '—'
        ),
    },
    {
      header: t('status'),
      cell: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge>,
    },
    {
      header: t('amount'),
      cell: (r) =>
        r.amount && r.currency ? (
          <span className="tabular-nums">
            {formatAmount(r.amount, r.currency)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      header: t('current_period'),
      cell: (r) => (
        <span className="text-muted-foreground text-xs whitespace-pre-line">
          {r.currentPeriodStart && r.currentPeriodEnd
            ? `${new Date(r.currentPeriodStart).toLocaleDateString()}\n~ ${new Date(r.currentPeriodEnd).toLocaleDateString()}`
            : '—'}
        </span>
      ),
    },
    {
      header: t('end_time'),
      cell: (r) => (
        <span className="text-muted-foreground text-sm">
          {r.canceledEndAt
            ? new Date(r.canceledEndAt).toLocaleDateString()
            : '—'}
        </span>
      ),
    },
    {
      header: t('date'),
      cell: (r) => (
        <span className="text-muted-foreground text-sm">
          {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      header: t('actions_col'),
      className: 'w-[80px]',
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="size-7">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setViewing(r)}>
              <Eye className="size-4" />
              {t('view')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => isCancellable(r.status) && setCanceling(r)}
              disabled={!isCancellable(r.status)}
            >
              <XCircle className="size-4" />
              {t('cancel')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('subscription')}</CardTitle>
            <Link
              href="/pricing"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'gap-2'
              )}
            >
              <Pencil className="size-4" />
              {current ? t('adjust') : t('subscribe')}
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!currentLoaded ? (
            <p className="text-muted-foreground text-sm">…</p>
          ) : current ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold">
                  {current.planName || current.productName || '—'}
                </p>
                <Badge variant={statusVariant(current.status)}>
                  {current.status}
                </Badge>
              </div>
              {current.amount && current.currency && (
                <p className="text-muted-foreground text-sm">
                  {formatAmount(current.amount, current.currency)}
                  {current.interval ? ` / ${current.interval}` : ''}
                </p>
              )}
              {current.canceledEndAt ? (
                <p className="text-destructive text-sm">
                  {t('ends_on', {
                    date: new Date(current.canceledEndAt).toLocaleDateString(),
                  })}
                </p>
              ) : current.currentPeriodEnd ? (
                <p className="text-muted-foreground text-sm">
                  {t('renews_on', {
                    date: new Date(
                      current.currentPeriodEnd
                    ).toLocaleDateString(),
                  })}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-3xl font-bold">
              {t('no_subscription')}
            </p>
          )}
        </CardContent>
      </Card>

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
            {t(`tab_${tb}` as `tab_${Tab}`)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={rows}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(r) => r.id}
            emptyText={t('no_subscription')}
            search={search}
            onSearchChange={setSearch}
            onRefresh={async () => {
              fetchCurrent();
              await fetchList(page, tab, search);
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('subscription_details')}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {viewing?.subscriptionNo}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 py-2 text-sm">
              <DetailRow label={t('plan')}>
                {viewing.planName || viewing.productName || '—'}
              </DetailRow>
              <DetailRow label={t('status')}>
                <Badge variant={statusVariant(viewing.status)}>
                  {viewing.status}
                </Badge>
              </DetailRow>
              <DetailRow label={t('amount')}>
                {viewing.amount && viewing.currency
                  ? `${formatAmount(viewing.amount, viewing.currency)}${
                      viewing.interval ? ` / ${viewing.interval}` : ''
                    }`
                  : '—'}
              </DetailRow>
              <DetailRow label={t('provider')}>
                {viewing.paymentProvider}
              </DetailRow>
              <DetailRow label={t('period_start')}>
                {viewing.currentPeriodStart
                  ? new Date(viewing.currentPeriodStart).toLocaleString()
                  : '—'}
              </DetailRow>
              <DetailRow label={t('period_end')}>
                {viewing.currentPeriodEnd
                  ? new Date(viewing.currentPeriodEnd).toLocaleString()
                  : '—'}
              </DetailRow>
              {viewing.canceledAt && (
                <DetailRow label={t('canceled_at')}>
                  {new Date(viewing.canceledAt).toLocaleString()}
                </DetailRow>
              )}
              {viewing.canceledEndAt && (
                <DetailRow label={t('canceled_end_at')}>
                  {new Date(viewing.canceledEndAt).toLocaleString()}
                </DetailRow>
              )}
              {viewing.canceledReason && (
                <DetailRow label={t('canceled_reason')}>
                  {viewing.canceledReason}
                </DetailRow>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!canceling} onOpenChange={(v) => !v && setCanceling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancel_title')}</DialogTitle>
            <DialogDescription>
              {t('cancel_description', {
                plan: canceling?.planName || canceling?.productName || '—',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCanceling(null)}
              disabled={submitting}
            >
              {t('cancel_back')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={submitting}
            >
              {submitting ? t('canceling') : t('cancel_confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}
