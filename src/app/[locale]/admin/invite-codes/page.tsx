'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Tab = 'all' | 'available' | 'used';
const TABS: Tab[] = ['all', 'available', 'used'];

interface InviteCodeRow {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  trialDays: number;
  note: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const PAGE_SIZE = 20;

export default function InviteCodesPage() {
  const t = useTranslations('admin');
  const [rows, setRows] = useState<InviteCodeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [count, setCount] = useState('1');
  const [maxUses, setMaxUses] = useState('1');
  const [trialDays, setTrialDays] = useState('15');
  const [note, setNote] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tab]);

  const fetchRows = useCallback(
    (p: number) => {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(PAGE_SIZE),
      });
      if (tab !== 'all') params.set('status', tab);
      if (debouncedSearch) params.set('search', debouncedSearch);
      fetch(`/api/admin/invite-codes?${params}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.code === 0) {
            setRows(res.data.items);
            setTotal(res.data.total);
          }
        });
    },
    [tab, debouncedSearch]
  );

  useEffect(() => {
    fetchRows(page);
  }, [page, fetchRows]);

  function resetCreateForm() {
    setCount('1');
    setMaxUses('1');
    setTrialDays('15');
    setNote('');
    setExpiresAt('');
  }

  async function submitCreate() {
    const n = parseInt(count) || 1;
    const m = parseInt(maxUses) || 1;
    const d = parseInt(trialDays) || 15;
    if (n < 1 || m < 1 || d < 1) {
      toast.error(t('invite_codes.invalid_input'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: n > 1 ? n : undefined,
          maxUses: m,
          trialDays: d,
          note: note || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        toast.success(t('invite_codes.create_success'));
        setCreateOpen(false);
        resetCreateForm();
        fetchRows(1);
        setPage(1);
      } else {
        toast.error(data.message || 'Failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/admin/invite-codes?id=${deletingId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.code === 0) {
        toast.success(t('invite_codes.delete_success'));
        setDeletingId(null);
        fetchRows(page);
      } else {
        toast.error(data.message || 'Failed');
      }
    } catch {
      toast.error('Failed');
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(
      () => toast.success(t('invite_codes.copied')),
      () => toast.error('Failed')
    );
  }

  const columns: Column<InviteCodeRow>[] = [
    {
      header: t('invite_codes.code_col'),
      cell: (r) => (
        <div className="flex items-center gap-2">
          <code className="font-mono text-sm">{r.code}</code>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => copyCode(r.code)}
          >
            <Copy className="size-3" />
          </Button>
        </div>
      ),
    },
    {
      header: t('invite_codes.usage_col'),
      className: 'w-[120px]',
      cell: (r) => (
        <span className="tabular-nums">
          {r.usedCount} / {r.maxUses}
        </span>
      ),
    },
    {
      header: t('invite_codes.trial_days_col'),
      className: 'w-[100px]',
      cell: (r) => <span className="tabular-nums">{r.trialDays}</span>,
    },
    {
      header: t('invite_codes.note_col'),
      cell: (r) => (
        <span className="text-muted-foreground">{r.note || '—'}</span>
      ),
    },
    {
      header: t('invite_codes.expires_col'),
      cell: (r) => (
        <span className="text-muted-foreground">
          {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      header: t('invite_codes.created_col'),
      cell: (r) => (
        <span className="text-muted-foreground">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: t('invite_codes.actions_col'),
      className: 'w-[80px]',
      cell: (r) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setDeletingId(r.id)}
        >
          <Trash2 className="text-destructive size-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('invite_codes.title')}</h1>
          <p className="text-muted-foreground">
            {t('invite_codes.description')}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="size-4" />
          {t('invite_codes.create_button')}
        </Button>
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
            {t(`invite_codes.tab_${tb}`)}
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
            emptyText={t('invite_codes.empty')}
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => fetchRows(page)}
          />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) resetCreateForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('invite_codes.create_title')}</DialogTitle>
            <DialogDescription>
              {t('invite_codes.create_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('invite_codes.count_label')}</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('invite_codes.max_uses_label')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('invite_codes.trial_days_label')}</Label>
              <Input
                type="number"
                min="1"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('invite_codes.expires_label')}</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('invite_codes.note_label')}</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('invite_codes.note_placeholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('invite_codes.cancel')}
            </Button>
            <Button onClick={submitCreate} disabled={submitting}>
              {submitting
                ? t('invite_codes.creating')
                : t('invite_codes.create_submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('invite_codes.delete_title')}</DialogTitle>
            <DialogDescription>
              {t('invite_codes.delete_description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              {t('invite_codes.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t('invite_codes.delete_confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
