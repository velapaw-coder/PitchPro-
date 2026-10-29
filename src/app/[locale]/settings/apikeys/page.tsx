'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ApiKey {
  id: string;
  keyPrefix: string;
  title: string;
  createdAt: string;
}

const PAGE_SIZE = 10;

export default function ApiKeysPage() {
  const t = useTranslations();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchKeys = useCallback((p: number, s: string) => {
    const params = new URLSearchParams({
      page: String(p),
      pageSize: String(PAGE_SIZE),
    });
    if (s) params.set('search', s);
    fetch(`/api/apikeys?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.code === 0) {
          setKeys(res.data.items);
          setTotal(res.data.total);
        }
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchKeys(page, search), 300);
    return () => clearTimeout(timer);
  }, [page, search, fetchKeys]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newKeyName }),
      });
      const data = await res.json();
      if (data.code === 0) {
        toast.success(t('settings.apikeys.created'));
        await navigator.clipboard.writeText(data.data.key);
        toast.info(t('settings.apikeys.key_copied'));
        setOpen(false);
        setNewKeyName('');
        fetchKeys(page, search);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error(t('settings.apikeys.failed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/apikeys?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.code === 0) {
      toast.success(t('settings.apikeys.deleted'));
      fetchKeys(page, search);
    }
  }

  const columns: Column<ApiKey>[] = [
    {
      header: t('settings.apikeys.name_col'),
      cell: (k) => <span className="font-medium">{k.title}</span>,
    },
    {
      header: t('settings.apikeys.key_col'),
      cell: (k) => <span className="font-mono text-xs">{k.keyPrefix}…</span>,
    },
    {
      header: t('settings.apikeys.actions_col'),
      className: 'w-[100px]',
      cell: (k) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => handleDelete(k.id)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('settings.apikeys.title')}</h1>
          <p className="text-muted-foreground">
            {t('settings.apikeys.description')}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors">
            <Plus className="size-4" />
            {t('settings.apikeys.create_key')}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('settings.apikeys.create_title')}</DialogTitle>
              <DialogDescription>
                {t('settings.apikeys.create_description')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="key-name">{t('settings.apikeys.key_name')}</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder={t('settings.apikeys.key_name_placeholder')}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('settings.apikeys.cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading
                  ? t('settings.apikeys.creating')
                  : t('settings.apikeys.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={keys}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(k) => k.id}
            emptyText={t('settings.apikeys.no_keys')}
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => fetchKeys(page, search)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
